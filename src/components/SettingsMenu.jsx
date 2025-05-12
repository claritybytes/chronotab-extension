import React, { useEffect, useState, useRef } from "react";
import { Button } from "./ui/button";
import { exportAllSchedules, importAllSchedules } from "../utils/scheduler";

const THEME_KEY = "chronotab_theme";
const MISSED_ALARMS_KEY = "chronotab_missed_alarms_enabled";

/**
 * Determines the system's preferred color scheme (dark or light).
 * Uses `window.matchMedia` to check the `prefers-color-scheme` media query.
 *
 * @returns {string} "dark" if the system prefers dark mode, "light" otherwise.
 */
function getSystemTheme() {
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return "dark";
  }
  return "light";
}

// Apply theme on load (fixes dark mode not applying until settings opened)
/**
 * Immediately-invoked function expression (IIFE) to apply the initial theme
 * on script load. This prevents a flash of unstyled content or the wrong theme
 * before the main React component mounts and manages the theme.
 * It attempts to load the theme preference from `chrome.storage.sync` (if available)
 * or falls back to `localStorage`.
 */
(function applyInitialTheme() {
  let theme = "auto";
  if (window.chrome && chrome.storage) {
    chrome.storage.sync.get([THEME_KEY], (result) => {
      theme = result[THEME_KEY] || "auto";
      let applied = theme;
      if (theme === "auto") applied = getSystemTheme();
      document.documentElement.classList.toggle("dark", applied === "dark");
      document.documentElement.classList.toggle("light", applied === "light");
    });
  } else {
    theme = localStorage.getItem(THEME_KEY) || "auto";
    let applied = theme;
    if (theme === "auto") applied = getSystemTheme();
    document.documentElement.classList.toggle("dark", applied === "dark");
    document.documentElement.classList.toggle("light", applied === "light");
  }
})();

/**
 * SettingsMenu component for Chronotab.
 * Provides UI for managing application settings, including:
 * - Theme selection (auto, light, dark).
 * - Toggling notifications for missed schedules.
 * - Exporting all schedules to a JSON file.
 * - Importing schedules from a JSON file.
 *
 * @param {object} props - The component's props.
 * @param {function} props.onClose - Callback function to close the settings menu.
 * @returns {JSX.Element} The settings menu modal.
 */
const SettingsMenu = ({ onClose }) => {
  const [theme, setTheme] = useState("auto");
  const [missedAlarmsEnabled, setMissedAlarmsEnabled] = useState(true);
  const fileInputRef = useRef(null); // Ref for file input

  useEffect(() => {
    // Load theme from chrome.storage or localStorage
    if (window.chrome && chrome.storage && chrome.storage.sync) {
      chrome.storage.sync.get([THEME_KEY, MISSED_ALARMS_KEY], (result) => {
        setTheme(result[THEME_KEY] || "auto");
        if (typeof result[MISSED_ALARMS_KEY] === 'boolean') {
          setMissedAlarmsEnabled(result[MISSED_ALARMS_KEY]);
        } else {
          setMissedAlarmsEnabled(true); // Default to true if not set
        }
      });
    } else {
      setTheme(localStorage.getItem(THEME_KEY) || "auto");
      const storedMissed = localStorage.getItem(MISSED_ALARMS_KEY);
      if (storedMissed !== null) {
        setMissedAlarmsEnabled(JSON.parse(storedMissed));
      } else {
        setMissedAlarmsEnabled(true);
      }
    }
  }, []);

  useEffect(() => {
    // Apply theme
    let applied = theme;
    if (theme === "auto") applied = getSystemTheme();
    document.documentElement.classList.toggle("dark", applied === "dark");
    document.documentElement.classList.toggle("light", applied === "light");
  }, [theme]);

  const handleThemeChange = (e) => {
    const value = e.target.value;
    setTheme(value);
    if (window.chrome && chrome.storage) {
      chrome.storage.sync.set({ [THEME_KEY]: value });
    } else {
      localStorage.setItem(THEME_KEY, value);
    }
  };

  const handleMissedAlarmsToggle = (e) => {
    const isEnabled = e.target.checked;
    setMissedAlarmsEnabled(isEnabled);
    if (window.chrome && chrome.storage && chrome.storage.sync) {
      chrome.storage.sync.set({ [MISSED_ALARMS_KEY]: isEnabled });
    } else {
      localStorage.setItem(MISSED_ALARMS_KEY, JSON.stringify(isEnabled));
    }
  };

  const handleExportAll = async () => {
    try {
      const schedulesJson = await exportAllSchedules();
      if (schedulesJson) {
        const blob = new Blob([schedulesJson], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "chronotab_all_schedules.json";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        console.log("All schedules exported successfully.");
      } else {
        console.warn("No schedules to export or export failed.");
        alert("No schedules to export.");
      }
    } catch (error) {
      console.error("Error exporting all schedules:", error);
      alert("Error exporting schedules. See console for details.");
    }
  };

  const handleImportAll = () => {
    fileInputRef.current.click(); // Trigger file input
  };

  const handleFileSelected = async (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const schedulesJson = e.target.result;
          const imported = await importAllSchedules(schedulesJson);
          if (imported) {
            console.log("Schedules imported successfully:", imported);
            alert("All schedules imported successfully!");
            // Consider a more integrated way to refresh data or notify App.jsx
            // onClose(); // Optionally close settings menu
          } else {
            alert("Failed to import schedules. Please check the file format and console for errors.");
          }
        } catch (error) {
          console.error("Error processing imported schedules:", error);
          alert("Error processing schedules file. Ensure it is a valid JSON export from Chronotab.");
        }
      };
      reader.readAsText(file);
      event.target.value = null; // Reset file input
    }
  };

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center backdrop-blur-sm">
      <div className="bg-card text-card-foreground rounded-2xl shadow-xl p-6 w-[340px] relative border border-border">
        <button
          className="absolute top-3 right-3 text-muted-foreground hover:text-foreground cursor-pointer"
          aria-label="Close settings"
          onClick={onClose}
        >
          <svg width="24" height="24" fill="none" viewBox="0 24 24"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
        <h2 className="text-xl font-bold mb-4 text-center text-foreground">Settings</h2>
        <div className="mb-4">
          <label className="block text-sm font-semibold mb-1 text-foreground">Theme</label>
          <select
            className="w-full rounded-lg border border-border bg-background text-foreground px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring text-base"
            value={theme}
            onChange={handleThemeChange}
          >
            <option value="auto">Auto (System)</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </div>
        <div className="mb-4">
          <label className="flex items-center space-x-3 cursor-pointer">
            <input
              type="checkbox"
              className="form-checkbox h-5 w-5 text-primary rounded border-border focus:ring-primary focus:ring-offset-0"
              checked={missedAlarmsEnabled}
              onChange={handleMissedAlarmsToggle}
            />
            <span className="text-sm font-semibold text-foreground">Notify about missed schedules</span>
          </label>
        </div>

        {/* Import/Export All Schedules */}
        <div className="mt-6 pt-4 border-t border-border">
          <h3 className="text-md font-semibold mb-2 text-foreground">Manage All Schedules</h3>
          <div className="space-y-2">
            <Button variant="outline" className="w-full" onClick={handleExportAll}>
              Export All Schedules
            </Button>
            <Button variant="outline" className="w-full" onClick={handleImportAll}>
              Import All Schedules
            </Button>
            <input
              type="file"
              ref={fileInputRef}
              accept=".json"
              style={{ display: "none" }}
              onChange={handleFileSelected}
            />
          </div>
        </div>

        <Button variant="outline" className="w-full mt-6" onClick={onClose}>Close</Button>
      </div>
    </div>
  );
};

export default SettingsMenu;
