// Chronotab Dashboard Page
import React, { useEffect, useState } from "react";
import { Button } from "../components/ui/button";
import { DateTime } from "luxon";
import SettingsMenu from "../components/SettingsMenu";
// MODIFIED: Added Pencil, Trash2 icons and Tooltip components
// MODIFIED: Added AlertTriangle icon
// MODIFIED: Added Plus icon
import { Settings, Link, CalendarDays, Repeat, Play, Pencil, Trash2, AlertTriangle, Plus } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"; // Assuming ShadCN UI tooltip path
import { runSchedule } from "../utils/scheduler"; // Import runSchedule

/**
 * Calculates the next occurrence date and time for a given schedule.
 * Uses Luxon for date/time manipulations.
 *
 * @param {Schedule} schedule - The schedule object.
 * @returns {DateTime | null} A Luxon DateTime object representing the next occurrence, or null if not applicable (e.g., a past "once" schedule).
 */
function getNextOccurrenceDate(schedule) {
  const now = DateTime.local();
  // Ensure schedule.time is in the expected YYYY-MM-DDTHH:mm format
  if (!schedule.time || !schedule.time.includes('T')) {
    // console.warn("Invalid or old time format for schedule:", schedule.name, schedule.time);
    return null; // Or handle as an error, or try to migrate
  }

  const scheduledDateTime = DateTime.fromISO(schedule.time);

  if (schedule.repeat === "once") {
    return scheduledDateTime > now ? scheduledDateTime : null; // Only if it's in the future
  }

  if (schedule.repeat === "daily") {
    let next = scheduledDateTime;
    while (next <= now) {
      next = next.plus({ days: 1 });
    }
    return next;
  }

  if (schedule.repeat === "weekly") {
    let soonestNext = null;
    // Iterate through each selected day of the week
    schedule.dayOfWeek.forEach(dow => {
      // Luxon weekdays are 1 (Mon) to 7 (Sun)
      let nextOccurrence = scheduledDateTime;
      // Adjust to the correct day of the week for the first occurrence
      while (nextOccurrence.weekday !== dow) {
        nextOccurrence = nextOccurrence.plus({ days: 1 });
      }
      // If this first occurrence is in the past, find the next one for this DOW
      while (nextOccurrence <= now) {
        nextOccurrence = nextOccurrence.plus({ weeks: 1 });
      }
      if (!soonestNext || nextOccurrence < soonestNext) {
        soonestNext = nextOccurrence;
      }
    });
    return soonestNext;
  }
  return null;
}

/**
 * Returns the three-letter abbreviation for a given day index.
 * Assumes 0 for Sunday, 1 for Monday, etc.
 *
 * @param {number} dayIndex - The index of the day (0-6).
 * @returns {string} The abbreviation of the day (e.g., "Sun", "Mon").
 */
function getDayAbbreviation(dayIndex) {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  // Adjust for Luxon's weekday (1=Mon, 7=Sun) vs typical array (0=Sun) if needed
  // Or ensure schedule.dayOfWeek stores them in a way that's directly mappable
  return days[dayIndex % 7]; // Simple modulo, might need adjustment based on storage
}

/**
 * Dashboard component for Chronotab.
 * Displays a list of schedules, their next run times, and controls to manage them (run, edit, delete).
 * Also provides access to the settings menu and a notification for missed schedules.
 *
 * @param {object} props - The component's props.
 * @param {boolean} props.isPopup - Indicates if the component is being rendered in a popup window, affecting layout.
 * @returns {JSX.Element} The dashboard page component.
 */
const Dashboard = ({ isPopup }) => {
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(DateTime.local());
  const [showSettings, setShowSettings] = useState(false);
  const [missedSchedulesCount, setMissedSchedulesCount] = useState(0); // Added state for missed schedules count

  useEffect(() => {
    const loadSchedules = () => {
      setLoading(true);
      if (window.chrome && chrome.storage) {
        chrome.storage.sync.get(["schedules"], (result) => {
          setSchedules(result.schedules || []);
          // setLoading(false); // Defer setLoading to after missed schedules check
        });

        chrome.storage.local.get('chronotab_missed_alarms_data', (result) => {
          const missed = result.chronotab_missed_alarms_data || [];
          setMissedSchedulesCount(missed.length);
          setLoading(false); 
        });
      } else {
        setLoading(false);
      }
    };

    loadSchedules(); // Initial load

    // Listener for storage changes
    const storageChangedListener = (changes, area) => {
      if (area === 'sync' && changes.schedules) {
        // console.log("Dashboard: Detected schedule changes in chrome.storage.sync, reloading schedules.");
        loadSchedules();
      }
      // Also listen for changes to missed alarms data if needed for other parts of the dashboard
      if (area === 'local' && changes.chronotab_missed_alarms_data) {
        // console.log("Dashboard: Detected missed alarms data changes, reloading.");
        loadSchedules(); // Reload all data as missed count might affect display
      }
    };

    if (window.chrome && chrome.storage) {
      chrome.storage.onChanged.addListener(storageChangedListener);
    }

    // Cleanup listener on component unmount
    return () => {
      if (window.chrome && chrome.storage) {
        chrome.storage.onChanged.removeListener(storageChangedListener);
      }
    };
  }, []);

  // Single timer for all countdowns
  useEffect(() => {
    const interval = setInterval(() => setNow(DateTime.local()), 1000);
    return () => clearInterval(interval);
  }, []);

  const handleDelete = (id) => {
    if (!window.confirm("Are you sure you want to delete this schedule?")) return;
    const updated = schedules.filter((s) => s.id !== id);
    setSchedules(updated);
    chrome.storage.sync.set({ schedules: updated });
  };

  const handleEdit = (id) => {
    window.location.hash = `#/edit/${id}`;
  };

  const handleRunNow = (schedule) => {
    if (window.chrome && chrome.runtime) {
      runSchedule(schedule);
    } else {
      schedule.urls.forEach(url => {
        chrome.tabs.create({ url: url, active: false });
      });
    }
  };

  /**
   * Calculates a human-readable countdown string to a target date.
   *
   * @param {DateTime | null} targetDate - A Luxon DateTime object for the target date, or null.
   * @returns {string} A string representing the countdown (e.g., "5d 3h", "12h 30m", "45m 10s", "10s", "Due"), or "-" if targetDate is null.
   */
  function getCountdown(targetDate) {
    if (!targetDate) return "-";
    const diff = targetDate.diff(now, ["days", "hours", "minutes", "seconds"]).toObject();
    if (diff.seconds < 0) return "Due";
    if (diff.days >= 1) return `${Math.floor(diff.days)}d ${Math.floor(diff.hours)}h`;
    if (diff.hours >= 1) return `${Math.floor(diff.hours)}h ${Math.floor(diff.minutes)}m`;
    if (diff.minutes >= 1) return `${Math.floor(diff.minutes)}m ${Math.floor(diff.seconds)}s`;
    return `${Math.floor(diff.seconds)}s`;
  }

  return (
    <div className={`flex flex-col h-full ${isPopup ? 'p-2 pt-1' : 'p-4'}`}>
      {/* Header Section */}
      {/* ... existing code ... */}

      {/* Main Content Area */}
      <div 
        className="w-full max-w-md bg-card text-card-foreground rounded-2xl shadow-xl p-4 sm:p-6 relative flex flex-col flex-1 mx-auto border border-border" 
        style={{ margin: '35px auto' }} // Changed margin here
      >
        <TooltipProvider> {/* This TooltipProvider wraps the Settings icon and the main content */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className="absolute top-3 right-3 text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 p-1 rounded-md cursor-pointer"
                aria-label="Open settings"
                onClick={() => setShowSettings(true)}
              >
                <Settings size={20} />
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Settings</p>
            </TooltipContent>
          </Tooltip>
          <h1 className="text-2xl font-extrabold mb-2 text-center tracking-tight text-foreground">Chronotab Schedules</h1>
          
          {/* Missed Schedules CTA */} 
          {!loading && missedSchedulesCount > 0 && (
            <div 
              className="mb-4 p-3 bg-destructive/10 border border-destructive/30 rounded-lg text-sm text-destructive-foreground hover:bg-destructive/20 cursor-pointer transition-colors duration-150"
              onClick={() => window.location.hash = '#/missed-alarms'}
              role="alert"
            >
              <div className="flex items-center">
                <AlertTriangle size={18} className="mr-2 flex-shrink-0" />
                <div className="flex-grow">
                  <span className="font-semibold">You have {missedSchedulesCount} missed schedule{missedSchedulesCount === 1 ? '' : 's'}.</span>
                  <span className="block sm:inline sm:ml-1">Click here to review.</span>
                </div>
              </div>
            </div>
          )}

          {loading ? (
            <div className="text-center text-muted-foreground py-4">Loading...</div>
          ) : schedules.length === 0 && missedSchedulesCount === 0 ? ( // Also check missedSchedulesCount for this message
            <div className="text-center text-muted-foreground mb-6">No schedules yet.</div>
          ) : (
            // REMOVED inner TooltipProvider, as the outer one now covers this
            <ul className="space-y-3 mb-4">
              {schedules.map((schedule) => {
                const nextDate = getNextOccurrenceDate(schedule);
                const countdown = getCountdown(nextDate);
                let countdownColor = "text-primary";
                if (countdown === "Due") countdownColor = "text-destructive font-bold";
                else if (countdown.endsWith("s")) countdownColor = "text-accent-foreground";

                return (
                  <li
                    key={schedule.id}
                    className="bg-card-foreground/5 border border-border/50 rounded-lg p-4 flex flex-col space-y-2 shadow-sm hover:shadow-md transition-shadow duration-200"
                  >
                    <div className="flex justify-between items-start space-x-2">
                      <div className="flex-1 min-w-0">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <h2 className="text-lg font-semibold text-foreground truncate text-left" title={schedule.name}>{schedule.name}</h2>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{schedule.name}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      <div className="flex items-center space-x-1 flex-shrink-0">
                        {/* ... existing icon buttons with tooltips ... */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRunNow(schedule)}
                              className="text-green-500 hover:text-green-400 hover:bg-green-500/10 w-8 h-8"
                            >
                              <Play size={16} />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Run Now</p>
                          </TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEdit(schedule.id)}
                              className="text-muted-foreground hover:text-foreground hover:bg-muted-foreground/10 w-8 h-8"
                            >
                              <Pencil size={16} />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Edit</p>
                          </TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(schedule.id)}
                              className="text-red-500 hover:text-red-400 hover:bg-red-500/10 w-8 h-8"
                            >
                              <Trash2 size={16} />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Delete</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </div>
                    {/* RESTORED: Schedule details section */}
                    <div className="text-xs text-muted-foreground space-y-1 pt-1 border-t border-border/30">
                      <div className="flex items-center">
                        <Link size={12} className="mr-2 text-sky-500" />
                        <span>{schedule.urls.length} URL{schedule.urls.length === 1 ? '' : 's'}</span>
                      </div>
                      <div className="flex items-center">
                        <Repeat size={12} className="mr-2 text-green-500" />
                        <span>
                          {schedule.repeat === "once" && "Once"}
                          {schedule.repeat === "daily" && "Daily"}
                          {schedule.repeat === "weekly" && `Weekly: ${schedule.dayOfWeek.map(day => getDayAbbreviation(day)).join(', ')}`}
                          {' @ '}{schedule.time && schedule.time.includes('T') ? DateTime.fromISO(schedule.time).toLocaleString(DateTime.TIME_SIMPLE) : "Invalid time"}
                        </span>
                      </div>
                      {nextDate && (
                        <div className="flex items-center">
                          <CalendarDays size={12} className="mr-2 text-purple-500" />
                          <span>Next run: {nextDate.toLocaleString({...DateTime.DATETIME_MED_WITH_WEEKDAY, timeZoneName: 'short'})} <span className={`ml-1 ${countdownColor}`}>({countdown})</span></span>
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          <Button onClick={() => window.location.hash = "#/schedule/new"} className="w-full mt-auto">
            <Plus size={18} />
            Add New Schedule
          </Button>
        </TooltipProvider> {/* Corresponding closing tag for the main TooltipProvider */}
      </div>
      {showSettings && <SettingsMenu onClose={() => setShowSettings(false)} />}
    </div>
  );
};

export default Dashboard;
