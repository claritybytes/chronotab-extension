import React, { useEffect, useState, useCallback } from 'react';
import { Button } from '../components/ui/button';
import { Play, Trash2, AlertTriangle, Info } from 'lucide-react'; // Added icons
import { Link } from 'react-router-dom'; // Added Link
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"; // Added Tooltip components

/**
 * MissedSchedulesPage component for Chronotab.
 * Displays a list of schedules that were missed (i.e., their scheduled run time passed while the browser or extension was inactive).
 * Allows users to run a missed schedule or clear it from the list. Also provides an option to clear all missed schedules.
 *
 * @returns {JSX.Element} The missed schedules page component.
 */
const MissedSchedulesPage = () => {
  const [missedSchedules, setMissedSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchMissedSchedules = useCallback(async () => {
    setLoading(true);
    setError('');
    if (chrome.storage && chrome.storage.local) {
      try {
        const result = await chrome.storage.local.get('chronotab_missed_alarms_data');
        setMissedSchedules(result.chronotab_missed_alarms_data || []);
      } catch (e) {
        console.error("Error fetching missed schedules:", e);
        setError("Could not load missed schedules.");
        setMissedSchedules([]);
      }
    } else {
      setError("Storage API not available.");
      setMissedSchedules([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchMissedSchedules();
  }, [fetchMissedSchedules]);

  const handleRunSchedule = async (scheduleId, missedRunTime) => {
    if (chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage(
        { action: "runMissedAlarm", scheduleId: scheduleId },
        async (response) => {
          if (response && response.success) {
            // Remove the specific instance of the missed schedule that was run
            const updatedMissedSchedules = missedSchedules.filter(
              schedule => !(schedule.scheduleId === scheduleId && schedule.missedRunTime === missedRunTime)
            );
            setMissedSchedules(updatedMissedSchedules);
            // Update storage with the filtered list
            if (chrome.storage && chrome.storage.local) {
              await chrome.storage.local.set({ chronotab_missed_alarms_data: updatedMissedSchedules });
            }
          } else {
            console.error("Failed to run missed schedule:", response?.error);
            setError(`Failed to run schedule: ${scheduleId}. ${response?.error || ''}`);
          }
        }
      );
    }
  };

  const handleClearSpecificSchedule = async (scheduleId, missedRunTime) => {
    const updatedMissedSchedules = missedSchedules.filter(
      schedule => !(schedule.scheduleId === scheduleId && schedule.missedRunTime === missedRunTime)
    );
    setMissedSchedules(updatedMissedSchedules);
    if (chrome.storage && chrome.storage.local) {
      await chrome.storage.local.set({ chronotab_missed_alarms_data: updatedMissedSchedules });
    }
  };
  
  const handleClearAllMissed = async () => {
    setMissedSchedules([]);
    if (chrome.storage && chrome.storage.local) {
      await chrome.storage.local.remove('chronotab_missed_alarms_data');
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-4 text-center text-lg text-muted-foreground">
        <Info size={28} className="mb-2" />
        Loading missed schedules...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-4 text-center text-red-500 text-lg">
        <AlertTriangle size={28} className="mb-2" />
        {error}
      </div>
    );
  }

  if (missedSchedules.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-4 text-center text-lg text-muted-foreground">
        <Info size={28} className="mb-2" />
        No missed schedules.
        <Link to="/" className="mt-4">
          <Button variant="outline">Back to Dashboard</Button>
        </Link>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="flex-1 flex flex-col w-full min-h-0 min-w-0 p-0 m-0 bg-background text-foreground overflow-y-auto">
        <div className="w-full max-w-3xl mx-auto p-4 sm:p-6 flex flex-col flex-1">
          <header className="mb-6 text-center">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">Missed Schedules</h1>
            <p className="text-sm sm:text-base text-muted-foreground mt-1">
              Review and manage schedules that didn&apos;t run as scheduled.
            </p>
          </header>

          {missedSchedules.length > 0 && (
            <div className="mb-4 flex justify-end">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="destructive" onClick={handleClearAllMissed} size="sm">
                    <Trash2 size={16} className="mr-2" />
                    Clear All ({missedSchedules.length})
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Clear all missed schedules from the list.</p>
                </TooltipContent>
              </Tooltip>
            </div>
          )}
          
          <div className="space-y-4">
            {missedSchedules.map((schedule, index) => (
              <div 
                key={`${schedule.scheduleId}-${schedule.missedRunTime}-${index}`} 
                className="bg-card text-card-foreground border border-border rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow duration-200 flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-3 sm:space-y-0 sm:space-x-4"
                style={{ margin: '35px auto' }} // Changed margin here
              >
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg sm:text-xl font-semibold text-foreground truncate" title={schedule.scheduleName || schedule.scheduleId}>
                    {schedule.scheduleName || schedule.scheduleId}
                  </h2>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    Originally scheduled for: {new Date(schedule.missedRunTime).toLocaleString()}
                  </p>
                </div>
                <div className="flex space-x-2 flex-shrink-0 w-full sm:w-auto">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button onClick={() => handleRunSchedule(schedule.scheduleId, schedule.missedRunTime)} size="sm" className="flex-1 sm:flex-none">
                        <Play size={16} className="mr-1 sm:mr-2" />
                        Run Now
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Run this schedule now.</p>
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="outline" onClick={() => handleClearSpecificSchedule(schedule.scheduleId, schedule.missedRunTime)} size="sm" className="flex-1 sm:flex-none">
                        <Trash2 size={16} className="mr-1 sm:mr-2" />
                        Clear
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Clear this missed schedule from the list.</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
};

export default MissedSchedulesPage;
