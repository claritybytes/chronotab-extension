// Utility for scheduling and managing tab opening

/**
 * @typedef {object} Schedule
 * Represents a scheduling configuration for opening URLs.
 * @property {string} id - Unique identifier for the schedule.
 * @property {string} name - User-defined name for the schedule.
 * @property {string[]} urls - List of URLs to open when the schedule runs.
 * @property {string} time - Time for the schedule to run. Can be HH:mm or ISO string YYYY-MM-DDTHH:mm.
 * @property {string} repeat - How often the schedule repeats ("once", "daily", "weekly").
 * @property {number[]} [dayOfWeek] - Days of the week for weekly schedules (0=Sun, 6=Sat). Required if repeat is 'weekly'.
 * @property {number} [lastRun] - Timestamp (ms since epoch) of when the schedule last ran.
 * @property {number} [calculatedWhen] - Timestamp (ms since epoch) calculated for the next run of a "once" schedule.
 */

/**
 * Registers all alarms for current schedules stored in `chrome.storage.sync`.
 *
 * This function performs the following steps:
 * 1. Retrieves all schedules from `chrome.storage.sync`.
 * 2. Updates the `calculatedWhen` property for any "once" schedules based on their specified time.
 *    If a "once" schedule's time is in the past, `calculatedWhen` is removed.
 *    For non-"once" schedules, `calculatedWhen` is always removed.
 * 3. Clears all existing Chrome alarms.
 * 4. Creates new alarms based on the processed schedules:
 *    - For "once" schedules, a single alarm is set at `calculatedWhen` if it's valid and in the future,
 *      and if the schedule hasn't already run (checked against `lastRun`).
 *    - For "daily" schedules, a repeating alarm is set for the next occurrence of `schedule.time` with a 24-hour period.
 *    - For "weekly" schedules, a repeating alarm is set for each specified `dayOfWeek` at `schedule.time` with a 7-day period.
 *      Unique alarm names are generated for each day of a weekly schedule (e.g., `schedule.id + "-" + dow`).
 *
 * If `calculatedWhen` was added, modified, or removed for any schedule, the updated schedules are saved back to `chrome.storage.sync`.
 * Errors during saving are logged to the console.
 *
 * @returns {void} This function does not return a value directly but operates via side effects on Chrome alarms and storage.
 */
export function registerAlarms() {
  chrome.storage.sync.get(["schedules"], (result) => {
    const originalSchedules = result.schedules || [];
    // Deep copy schedules to modify them before saving, and for creating alarms
    let schedulesToProcess = JSON.parse(JSON.stringify(originalSchedules));
    let hasChangesToPersist = false;

    // First, update schedule objects with calculatedWhen or remove it
    schedulesToProcess = schedulesToProcess.map(schedule => {
      const originalCalculatedWhen = schedule.calculatedWhen; // Store original value for comparison

      if (schedule.repeat === "once") {
        const when = getNextOccurrence(schedule.time); // Assumes getNextOccurrence is defined in this file
        if (when) {
          schedule.calculatedWhen = when;
        } else {
          // If 'when' cannot be calculated (e.g., time in past for a new 'once' schedule),
          // ensure calculatedWhen is undefined.
          delete schedule.calculatedWhen;
        }
      } else {
        // For daily/weekly, or if repeat type is not 'once', ensure calculatedWhen is removed
        delete schedule.calculatedWhen;
      }

      // Check if calculatedWhen has actually changed
      if (schedule.calculatedWhen !== originalCalculatedWhen ||
          (originalCalculatedWhen !== undefined && schedule.calculatedWhen === undefined)) {
        hasChangesToPersist = true;
      }
      return schedule;
    });

    // Now, clear all existing Chrome alarms and set new ones
    chrome.alarms.clearAll(() => {
      const now = Date.now(); // Get current time for comparison
      schedulesToProcess.forEach((schedule) => {
        if (schedule.repeat === "once") {
          // Use the potentially updated schedule.calculatedWhen from schedulesToProcess
          // Only create an alarm if calculatedWhen is valid and in the future.
          if (schedule.calculatedWhen && schedule.calculatedWhen > now) {
            // Also, ensure it hasn't effectively run already if lastRun was somehow set
            // This check might be redundant if checkMissedAlarmsOnStartup correctly handles lastRun,
            // but it's a good safeguard.
            if (!schedule.lastRun || schedule.lastRun < schedule.calculatedWhen) {
              chrome.alarms.create(schedule.id, { when: schedule.calculatedWhen });
            }
          }
        } else if (schedule.repeat === "daily") {
          const when = getNextOccurrence(schedule.time); // Assumes getNextOccurrence is defined
          if (when) {
            chrome.alarms.create(schedule.id, { when, periodInMinutes: 1440 }); // 24 * 60
          }
        } else if (schedule.repeat === "weekly" && schedule.dayOfWeek && schedule.dayOfWeek.length > 0) {
          schedule.dayOfWeek.forEach((dow) => {
            const when = getNextWeeklyOccurrence(schedule.time, dow); // Assumes getNextWeeklyOccurrence is defined
            if (when) {
              // Ensure unique alarm names for each day of the week instance for a weekly schedule
              chrome.alarms.create(`${schedule.id}-${dow}`, { when, periodInMinutes: 10080 }); // 7 * 24 * 60
            }
          });
        }
      });

      // If calculatedWhen was added, modified, or removed for any schedule, persist the changes
      if (hasChangesToPersist) {
        chrome.storage.sync.set({ schedules: schedulesToProcess }, () => {
          if (chrome.runtime.lastError) {
            console.error("Error saving schedules with calculatedWhen:", chrome.runtime.lastError.message);
          } else {
            // chrome.storage.sync.set({ schedules: updatedSchedules }, () => {
            // console.log("Schedules updated with calculatedWhen and saved to sync storage.");
            // });
          }
        });
      }
    });
  });
}

/**
 * Calculates the next occurrence timestamp (in milliseconds since epoch) for a given time string.
 * The time string can be in "HH:mm" format or an ISO string (e.g., "YYYY-MM-DDTHH:mm"), from which "HH:mm" is extracted.
 * If the calculated time for today has already passed, it returns the timestamp for that time tomorrow.
 * @param {string} timeStr - The time string (e.g., "14:30" or "2023-10-26T14:30").
 * @returns {number | null} The timestamp in milliseconds for the next occurrence, or null if the time string is invalid.
 */
export function getNextOccurrence(timeStr) {
  let timeToParse = timeStr;
  if (timeStr && timeStr.includes('T')) {
    const parts = timeStr.split('T');
    if (parts.length > 1 && parts[1].includes(':')) {
      timeToParse = parts[1].substring(0, 5); // Extract HH:MM
    } else {
      console.error(`[Chronotab] Invalid ISO time string format in getNextOccurrence: '${timeStr}'. Cannot extract time.`);
      return null;
    }
  }

  const [hStr, mStr] = timeToParse.split(':');
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);

  if (isNaN(h) || isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) {
    console.error(`[Chronotab] Invalid time string in getNextOccurrence: '${timeStr}' (parsed as '${timeToParse}'). Cannot calculate next occurrence.`);
    return null;
  }

  const now = new Date();
  const next = new Date(now);
  next.setHours(h, m, 0, 0);

  if (next.getTime() <= now.getTime()) {
    next.setDate(next.getDate() + 1);
    // Re-set time for the new day is implicitly handled as setHours was already called on 'next'
    // and only the date part was advanced.
  }
  return next.getTime();
}

/**
 * Calculates the next occurrence timestamp (in milliseconds since epoch) for a weekly schedule.
 * It considers the provided time string and the target day of the week.
 * The time string can be in "HH:mm" format or an ISO string (e.g., "YYYY-MM-DDTHH:mm"), from which "HH:mm" is extracted.
 * If the target day is today but the time has passed, it schedules for the same day next week.
 * @param {string} timeStr - The time string (e.g., "09:00" or "2023-10-26T09:00").
 * @param {number} dayOfWeek - The target day of the week (0 for Sunday, 1 for Monday, ..., 6 for Saturday).
 * @returns {number | null} The timestamp in milliseconds for the next weekly occurrence, or null if inputs are invalid.
 */
export function getNextWeeklyOccurrence(timeStr, dayOfWeek) {
  let timeToParse = timeStr;
  if (timeStr && timeStr.includes('T')) {
    const parts = timeStr.split('T');
    if (parts.length > 1 && parts[1].includes(':')) {
      timeToParse = parts[1].substring(0, 5); // Extract HH:MM
    } else {
      console.error(`[Chronotab] Invalid ISO time string format in getNextWeeklyOccurrence: '${timeStr}'. Cannot extract time.`);
      return null;
    }
  }

  const [hStr, mStr] = timeToParse.split(':');
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);

  if (isNaN(h) || isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) {
    console.error(`[Chronotab] Invalid time string in getNextWeeklyOccurrence: '${timeStr}' (parsed as '${timeToParse}'). Cannot calculate next occurrence.`);
    return null;
  }

  const now = new Date();
  let next = new Date(now);
  next.setHours(h, m, 0, 0); // Set the desired time first

  const currentDay = now.getDay(); // 0 (Sun) - 6 (Sat)
  let daysToAdd = (dayOfWeek - currentDay + 7) % 7;

  // If the target day is today, but the time has already passed, schedule for next week
  if (daysToAdd === 0 && next.getTime() <= now.getTime()) {
    daysToAdd = 7;
  }

  next.setDate(now.getDate() + daysToAdd);
  // Re-apply time after changing the date, as setDate might affect time across DST or month changes.
  // However, since we set 'next' based on 'now' and then only modify its date part relative to 'now.getDate()',
  // and setHours was called on 'next' initially, this should be fine.
  // For absolute safety, one might re-call next.setHours(h,m,0,0) here, but it's often redundant if date changes are simple day additions.
  // Let's ensure the time is correctly set for the new date.
  next.setHours(h, m, 0, 0);

  // Final safety check: if for some reason 'next' is still in the past (e.g. complex DST or edge cases),
  // advance by a week. This is more of a fallback.
  if (next.getTime() <= now.getTime()) {
    next.setDate(next.getDate() + 7);
    next.setHours(h,m,0,0); // Ensure time is correct for the new week's date
  }

  return next.getTime();
}

/**
 * Exports a single schedule as a JSON string.
 * @param {string} scheduleId - The ID of the schedule to export.
 * @returns {Promise<string|null>} A promise that resolves with the JSON string of the schedule, or null if not found.
 */
export function exportScheduleById(scheduleId) {
  return new Promise((resolve) => {
    chrome.storage.sync.get(["schedules"], (result) => {
      const schedules = result.schedules || [];
      const scheduleToExport = schedules.find(s => s.id === scheduleId);
      if (scheduleToExport) {
        // Optional: Remove runtime-specific data like lastRun or calculatedWhen if you don't want it in the export
        // const { lastRun, calculatedWhen, ...exportableSchedule } = scheduleToExport;
        // resolve(JSON.stringify(exportableSchedule));
        resolve(JSON.stringify(scheduleToExport));
      } else {
        resolve(null);
      }
    });
  });
}

/**
 * Imports a single schedule from a JSON string.
 * Assigns a new unique ID to the imported schedule and removes any existing `lastRun` or `calculatedWhen` properties.
 * The imported schedule is added to the existing list of schedules in `chrome.storage.sync`.
 * After successfully saving, it re-registers all alarms.
 *
 * @param {string} scheduleJson - The JSON string of the schedule to import.
 * @returns {Promise<Schedule|null>} A promise that resolves with the imported schedule object (with new ID and cleaned properties)
 *                                   if successful, or null if parsing or validation fails. Rejects on storage error.
 */
export function importSchedule(scheduleJson) {
  return new Promise((resolve, reject) => {
    try {
      const importedSchedule = JSON.parse(scheduleJson);
      // Basic validation (can be expanded)
      if (!importedSchedule.name || !importedSchedule.urls || !importedSchedule.time || !importedSchedule.repeat) {
        console.error("[Chronotab] Invalid schedule format for import.");
        return resolve(null);
      }

      chrome.storage.sync.get(["schedules"], (result) => {
        let schedules = result.schedules || [];
        // Assign a new unique ID
        importedSchedule.id = `schedule_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        // Remove potentially stale runtime data from the imported schedule
        delete importedSchedule.lastRun;
        delete importedSchedule.calculatedWhen;

        schedules.push(importedSchedule);
        chrome.storage.sync.set({ schedules }, () => {
          if (chrome.runtime.lastError) {
            console.error("[Chronotab] Error saving imported schedule:", chrome.runtime.lastError.message);
            reject(chrome.runtime.lastError);
          } else {
            console.log("[Chronotab] Schedule imported successfully:", importedSchedule);
            registerAlarms(); // Re-register alarms
            resolve(importedSchedule);
          }
        });
      });
    } catch (error) {
      console.error("[Chronotab] Error parsing schedule JSON for import:", error);
      resolve(null);
    }
  });
}

/**
 * Exports all schedules as a JSON string.
 * @returns {Promise<string>} A promise that resolves with the JSON string of all schedules.
 */
export function exportAllSchedules() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(["schedules"], (result) => {
      const schedules = result.schedules || [];
      // Optional: Clean schedules before export if needed
      // const exportableSchedules = schedules.map(s => {
      //   const { lastRun, calculatedWhen, ...exportableSchedule } = s;
      //   return exportableSchedule;
      // });
      // resolve(JSON.stringify(exportableSchedules));
      resolve(JSON.stringify(schedules));
    });
  });
}

/**
 * Imports multiple schedules from a JSON string, replacing all existing schedules in `chrome.storage.sync`.
 * Assigns new unique IDs to all imported schedules and removes any existing `lastRun` or `calculatedWhen` properties.
 * Basic validation is performed on each schedule; invalid schedules are skipped with a warning.
 * After successfully saving, it re-registers all alarms.
 *
 * @param {string} schedulesJson - The JSON string of the schedules array to import.
 * @returns {Promise<Schedule[]|null>} A promise that resolves with the array of successfully validated and imported schedule objects
 *                                     if successful, or null if the input is not an array or parsing fails. Rejects on storage error.
 */
export function importAllSchedules(schedulesJson) {
  return new Promise((resolve, reject) => {
    try {
      const importedSchedules = JSON.parse(schedulesJson);
      if (!Array.isArray(importedSchedules)) {
        console.error("[Chronotab] Invalid format for importing all schedules. Expected an array.");
        return resolve(null);
      }

      const validatedSchedules = [];
      for (const schedule of importedSchedules) {
        // Basic validation (can be expanded)
        if (!schedule.name || !schedule.urls || !schedule.time || !schedule.repeat) {
          console.warn("[Chronotab] Skipping invalid schedule during bulk import:", schedule);
          continue;
        }
        // Assign a new unique ID
        schedule.id = `schedule_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        // Remove potentially stale runtime data
        delete schedule.lastRun;
        delete schedule.calculatedWhen;
        validatedSchedules.push(schedule);
      }

      chrome.storage.sync.set({ schedules: validatedSchedules }, () => {
        if (chrome.runtime.lastError) {
          console.error("[Chronotab] Error saving all imported schedules:", chrome.runtime.lastError.message);
          reject(chrome.runtime.lastError);
        } else {
          console.log("[Chronotab] All schedules imported successfully.");
          registerAlarms(); // Re-register alarms
          resolve(validatedSchedules);
        }
      });
    } catch (error) {
      console.error("[Chronotab] Error parsing JSON for importing all schedules:", error);
      resolve(null);
    }
  });
}

/**
 * A utility function that calls {@link registerAlarms}.
 * This is intended to be used as a callback or event handler when schedules are changed,
 * ensuring that Chrome alarms are updated accordingly.
 * @returns {void}
 */
export function onSchedulesChanged() {
  registerAlarms();
}

/**
 * Opens all URLs specified in a given schedule object in new Chrome tabs.
 * If the schedule object is invalid, or if it contains no URLs, a warning is logged to the console.
 * @param {Schedule} schedule - The schedule object containing an array of URLs to open.
 * @returns {void}
 */
export function runSchedule(schedule) {
  if (schedule && schedule.urls && schedule.urls.length > 0) {
    schedule.urls.forEach(url => {
      chrome.tabs.create({ url });
      // Optional: Show notification for each opened tab
      // chrome.notifications.create({
      //   type: "basic",
      //   iconUrl: chrome.runtime.getURL("icon.png"),
      //   title: "Chronotab - Manual Run",
      //   message: `Tab opened for: ${schedule.name}`,
      //   priority: 2
      // });
    });
  } else {
    console.warn("Attempted to run schedule with no URLs or invalid schedule:", schedule);
  }
}
