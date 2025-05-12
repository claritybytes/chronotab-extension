// Chronotab Schedule Editor Page
import { useState, useEffect, useRef } from "react"; // Added useRef
import { Button } from "../components/ui/button";
import { ArrowLeft, Download, Upload } from 'lucide-react'; // Import icons
import { exportScheduleById, importSchedule } from "../utils/scheduler"; // Added imports

/**
 * ScheduleEditor component for Chronotab.
 * Allows users to create new schedules or edit existing ones.
 * Handles form inputs for schedule name, URLs, start date, time, repeat frequency (once, daily, weekly),
 * and days of the week (for weekly schedules).
 * Also provides functionality to export an individual schedule or import one.
 *
 * @param {object} props - The component's props.
 * @param {boolean} props.isPopup - Indicates if the component is being rendered in a popup window, affecting layout.
 * @returns {JSX.Element} The schedule editor page component.
 */
const ScheduleEditor = ({ isPopup }) => {
  // Parse schedule ID from hash (e.g. #/edit/123)
  const hash = window.location.hash;
  const editId = hash.startsWith("#/edit/") ? hash.replace("#/edit/", "") : null;

  const [name, setName] = useState("");
  const [urls, setUrls] = useState([""]);
  const [startDate, setStartDate] = useState(""); // YYYY-MM-DD
  const [time, setTime] = useState(""); // HH:mm
  const [repeat, setRepeat] = useState("once");
  const [dayOfWeek, setDayOfWeek] = useState([]);
  const [loading, setLoading] = useState(!!editId);
  const individualFileInputRef = useRef(null); // Ref for individual file input

  // Helper to format date to YYYY-MM-DD
  const formatDate = (date) => {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Helper to get current time as HH:mm
  const getCurrentTime = () => {
    const now = new Date();
    return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  };

  // Load schedule data if editing
  useEffect(() => {
    if (editId && window.chrome && chrome.storage) {
      chrome.storage.sync.get(["schedules"], (result) => {
        const schedules = result.schedules || [];
        const found = schedules.find(s => s.id === editId);
        if (found) {
          setName(found.name || "");
          setUrls(found.urls && found.urls.length ? found.urls : [""]);
          if (found.time && found.time.includes('T')) {
            const [datePart, timePart] = found.time.split('T');
            setStartDate(datePart);
            setTime(timePart.slice(0, 5)); // HH:mm
          } else if (found.time) { // Old HH:mm format
            setStartDate(formatDate(new Date())); // Default to today
            setTime(found.time);
          } else {
            setStartDate(formatDate(new Date()));
            setTime(getCurrentTime());
          }
          setRepeat(found.repeat || "once");
          setDayOfWeek(found.dayOfWeek || []);
        }
        setLoading(false);
      });
    } else if (!editId) {
      // For new schedules, default startDate to today and time to current time
      setStartDate(formatDate(new Date()));
      setTime(getCurrentTime());
    }
  }, [editId]);

  // On mount, if creating a new schedule, prefill URL from query param if present
  useEffect(() => {
    if (!editId) {
      // Try to get the url param from both search and hash (for hash-based routing)
      let url = null;
      // First, try window.location.search
      const params = new URLSearchParams(window.location.search);
      url = params.get('url');
      // If not found, try parsing from the hash (for Chrome extension routing)
      if (!url && window.location.hash.includes('?')) {
        const hashParams = new URLSearchParams(window.location.hash.split('?')[1]);
        url = hashParams.get('url');
      }
      if (url) {
        setUrls([url]);
      }
    }
  }, [editId]);

  const handleUrlChange = (idx, value) => {
    const newUrls = [...urls];
    newUrls[idx] = value;
    setUrls(newUrls);
  };

  const addUrlField = () => setUrls([...urls, ""]);
  const removeUrlField = (idx) => setUrls(urls.filter((_, i) => i !== idx));

  const handleSave = (e) => {
    e.preventDefault();
    const id = editId || crypto.randomUUID();
    // Combine startDate and time into YYYY-MM-DDTHH:mm format
    const combinedDateTime = `${startDate}T${time}`;
    const schedule = { id, name, urls: urls.filter(Boolean), time: combinedDateTime, repeat, dayOfWeek };
    chrome.storage.sync.get(["schedules"], (result) => {
      let schedules = result.schedules || [];
      if (editId) {
        schedules = schedules.map(s => s.id === id ? schedule : s);
      } else {
        schedules = [...schedules, schedule];
      }
      chrome.storage.sync.set({ schedules }, () => {
        window.location.hash = "#/";
      });
    });
  };

  const handleExportIndividual = async () => {
    if (!editId) {
      alert("Please save the schedule before exporting.");
      return;
    }
    try {
      const scheduleJson = await exportScheduleById(editId);
      if (scheduleJson) {
        const scheduleData = JSON.parse(scheduleJson);
        const blob = new Blob([scheduleJson], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        // Sanitize schedule name for filename
        const safeName = scheduleData.name ? scheduleData.name.replace(/[^a-z0-9]/gi, '_').toLowerCase() : 'schedule';
        a.download = `chronotab_schedule_${safeName}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        console.log(`Schedule ${editId} exported successfully.`);
      } else {
        alert("Failed to export schedule. It might not be saved or found.");
      }
    } catch (error) {
      console.error(`Error exporting schedule ${editId}:`, error);
      alert("Error exporting schedule. See console for details.");
    }
  };

  const handleImportIndividual = () => {
    individualFileInputRef.current.click(); // Trigger file input
  };

  const handleIndividualFileSelected = async (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const scheduleJson = e.target.result;
          const imported = await importSchedule(scheduleJson);
          if (imported) {
            console.log("Single schedule imported successfully:", imported);
            // Navigate to dashboard or refresh, as importSchedule adds to existing list
            window.location.hash = "#/";
          } else {
            alert("Failed to import schedule. Please check the file format and console for errors.");
          }
        } catch (error) {
          console.error("Error processing imported schedule:", error);
          alert("Error processing schedule file. Ensure it is a valid JSON export from Chronotab.");
        }
      };
      reader.readAsText(file);
      event.target.value = null; // Reset file input
    }
  };

  return (
    <div className={`flex flex-col h-full ${isPopup ? 'p-2 pt-1' : 'p-4'}`}>
      <div 
        className="w-full max-w-md mx-auto bg-card text-card-foreground rounded-2xl shadow-xl p-6 sm:p-8 relative flex flex-col flex-1 border border-border" 
        style={{ margin: '35px auto' }} // Changed margin here
      >
        <div className="flex items-center mb-4">
          <button
            type="button"
            aria-label="Back"
            className="mr-2 text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 p-1 rounded-md"
            onClick={() => window.location.hash = "#/"}
          >
            <ArrowLeft size={20} /> {/* Replace SVG with Lucide icon */}
          </button>
          <h1 className="text-xl font-bold text-foreground">{editId ? "Edit Schedule" : "New Schedule"}</h1>
        </div>

        {loading ? (
          <div className="text-center text-muted-foreground">Loading schedule...</div>
        ) : (
          <form onSubmit={handleSave} className="space-y-4 flex flex-col flex-1">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-foreground mb-1">Name</label>
              <input
                type="text"
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="E.g., Morning News"
                className="w-full rounded-md border border-border bg-input px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">URLs (one per line)</label>
              {urls.map((url, idx) => (
                <div key={idx} className="flex items-center space-x-2 mb-2">
                  <input
                    type="url"
                    value={url}
                    onChange={(e) => handleUrlChange(idx, e.target.value)}
                    placeholder="https://example.com"
                    className="w-full rounded-md border border-border bg-input px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    required={idx === 0} // Only first URL is required
                  />
                  {urls.length > 1 && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => removeUrlField(idx)} className="text-destructive hover:text-destructive/90 hover:bg-destructive/10">Remove</Button>
                  )}
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={addUrlField}>Add URL</Button>
            </div>

            {/* Flex container for Start Date, Time, and Repeat */}
            <div className="flex flex-col sm:flex-row sm:space-x-4 space-y-4 sm:space-y-0">
              <div className="flex-1 min-w-0"> {/* Added flex-1 and min-w-0 for responsiveness */}
                <label htmlFor="startDate" className="block text-sm font-medium text-foreground mb-1">Start Date</label>
                <input
                  type="date"
                  id="startDate"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full rounded-md border border-border bg-input px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  required
                />
              </div>

              <div className="flex-1 min-w-0"> {/* Added flex-1 and min-w-0 for responsiveness */}
                <label htmlFor="time" className="block text-sm font-medium text-foreground mb-1">Time</label>
                <input
                  type="time"
                  id="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="w-full rounded-md border border-border bg-input px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  required
                />
              </div>

              <div className="flex-1 min-w-0"> {/* Added flex-1 and min-w-0 for responsiveness */}
                <label htmlFor="repeat" className="block text-sm font-medium text-foreground mb-1">Repeat</label>
                <select
                  id="repeat"
                  value={repeat}
                  onChange={(e) => setRepeat(e.target.value)}
                  className="w-full rounded-md border border-border bg-input px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="once">Once</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                </select>
              </div>
            </div>

            {repeat === "weekly" && (
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Day of the Week</label>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day, index) => (
                    <Button
                      type="button"
                      key={day}
                      variant={dayOfWeek.includes(index + 1) ? "default" : "outline"}
                      onClick={() => {
                        const newDayOfWeek = [...dayOfWeek];
                        if (newDayOfWeek.includes(index + 1)) {
                          setDayOfWeek(newDayOfWeek.filter(d => d !== index + 1));
                        } else {
                          newDayOfWeek.push(index + 1);
                          setDayOfWeek(newDayOfWeek);
                        }
                      }}
                    >
                      {day}
                    </Button>
                  ))}
                </div>
              </div>
            )}
            <div className="mt-auto flex space-x-2 pt-4">
              <Button type="button" variant="outline" onClick={() => window.location.hash = "#/"} className="flex-1">Cancel</Button>
              <Button type="submit" className="flex-1">Save Schedule</Button>
            </div>

            {/* Individual Schedule Import/Export Buttons */}
            <div className="mt-4 pt-4 border-t border-border flex space-x-2">
              {editId && (
                <Button type="button" variant="outline" onClick={handleExportIndividual} className="flex-1 flex items-center justify-center">
                  <Download size={16} className="mr-2" /> Export Schedule
                </Button>
              )}
              <Button 
                type="button" 
                variant="outline" 
                onClick={handleImportIndividual} 
                className={`${editId ? 'flex-1' : 'w-full'} flex items-center justify-center`}
              >
                <Upload size={16} className="mr-2" /> Import Schedule
              </Button>
            </div>
            <input
              type="file"
              ref={individualFileInputRef}
              accept=".json"
              style={{ display: "none" }}
              onChange={handleIndividualFileSelected}
            />
          </form>
        )}
      </div>
    </div>
  );
};

export default ScheduleEditor;
