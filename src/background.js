// Chronotab background service worker
// console.log("Chronotab background.js loading..."); // <-- ADDED THIS LOG
import { registerAlarms, runSchedule } from './utils/scheduler.js';

/**
 * @typedef {object} Alarm
 * Represents a Chrome alarm object used by the extension.
 * @property {string} name - The name of the alarm, typically prefixed with a schedule ID.
 */

/**
 * Listener for Chrome alarms.
 *
 * When an alarm fires, this listener performs the following actions:
 * - Finds the corresponding schedule(s) based on the alarm name.
 * - Opens all URLs specified in each matched schedule.
 * - Shows a Chrome notification for each opened tab.
 * - Updates the `lastRun` timestamp for each matched schedule.
 * - If a matched schedule has `repeat` set to "once", it is removed from the stored schedules.
 *
 * If any schedules were modified (e.g., `lastRun` updated or "once" schedule removed),
 * the changes are saved back to `chrome.storage.sync`, and `registerAlarms()` is called
 * to ensure alarm states are consistent.
 *
 * @param {Alarm} alarm - The alarm object that fired.
 */
chrome.alarms.onAlarm.addListener((alarm) => {
  chrome.storage.sync.get(["schedules"], (result) => {
    let schedules = result.schedules || [];
    // Find matching schedule(s)
    const matches = schedules.filter(s => alarm.name.startsWith(s.id));
    let schedulesWereModified = false;

    matches.forEach(schedule => {
      schedule.urls.forEach(url => {
        chrome.tabs.create({ url });
        // Show notification for each opened tab
        chrome.notifications.create({
          type: "basic",
          iconUrl: chrome.runtime.getURL("icon.png"), // Use absolute path
          title: "Chronotab Schedule Triggered",
          message: `Tab opened for: ${schedule.name}`,
          priority: 2
        }, (_notificationId) => {
          if (chrome.runtime.lastError) {
            console.error('Schedule notification error:', chrome.runtime.lastError.message);
          }
        });
      });

      // Update lastRun time for the schedule
      const scheduleIndex = schedules.findIndex(s => s.id === schedule.id);
      if (scheduleIndex !== -1) {
        schedules[scheduleIndex].lastRun = Date.now();
        schedulesWereModified = true;
      }

      // Remove 'once' schedules after running
      if (schedule.repeat === "once") {
        schedules = schedules.filter(s => s.id !== schedule.id);
        // No need to clear 'calculatedWhen' as the schedule itself is removed
        schedulesWereModified = true; 
      }
    });

    // Save updated schedules if any were removed or lastRun was updated
    if (schedulesWereModified) {
      chrome.storage.sync.set({ schedules }, () => {
        // After 'once' schedule is removed, or lastRun updated, re-register alarms
        // to ensure periods are correct for recurring tasks and removed alarms are gone.
        registerAlarms(); 
      });
    }
  });
});

// --- Scheduler logic inlined from src/utils/scheduler.js ---
// [REMOVED INLINED SCHEDULER LOGIC - using imports now]
// function registerAlarms() { ... }
// function getNextOccurrence(timeStr) { ... }
// function getNextWeeklyOccurrence(timeStr, dayOfWeek) { ... }
// --- End scheduler logic ---

/**
 * Calculates the next occurrence of a given time string strictly after a specified timestamp.
 * Handles time strings in "HH:MM" format or ISO strings by extracting "HH:MM".
 * If the calculated time on the same day as fromTimestamp is in the past or same as fromTimestamp,
 * it advances to the next day.
 *
 * @param {string} timeStr - The time string, e.g., "14:30" or an ISO string like "2023-01-01T14:30:00".
 * @param {number} fromTimestamp - The timestamp (milliseconds since epoch) from which to calculate the next occurrence.
 * @returns {number|null} The timestamp of the next occurrence, or null if the time string is invalid or calculation fails.
 */
// Helper function to get the next occurrence of a time string strictly AFTER a given timestamp
function getNextOccurrenceFrom(timeStr, fromTimestamp) {
  let timeToParse = timeStr;
  if (timeStr && timeStr.includes('T')) {
    const parts = timeStr.split('T');
    if (parts.length > 1 && parts[1].includes(':')) {
      timeToParse = parts[1].substring(0, 5); // Extract HH:MM
    } else {
      console.error(`Invalid ISO time string format in getNextOccurrenceFrom: '${timeStr}'. Cannot extract time.`);
      return null;
    }
  }

  const [hStr, mStr] = timeToParse.split(":");
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);

  if (isNaN(h) || isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) {
    console.error(`Invalid time string in getNextOccurrenceFrom: '${timeStr}'. Cannot calculate next occurrence.`);
    return null;
  }

  const _fromDate = new Date(fromTimestamp);
  let next = new Date(fromTimestamp); 
  next.setHours(h, m, 0, 0);

  // If the calculated time on the same day as fromTimestamp is <= fromTimestamp, advance to the next day.
  if (isNaN(next.getTime()) || next.getTime() <= fromTimestamp) { // Added isNaN check for safety
    if (isNaN(next.getTime())) { // If date became invalid
        next = new Date(fromTimestamp); // Reset to a valid date before advancing
    }
    next.setDate(next.getDate() + 1);
    next.setHours(h, m, 0, 0); // Re-apply time for the new day
  }
  
  if (isNaN(next.getTime())) {
      console.error(`Date became invalid in getNextOccurrenceFrom for time '${timeStr}'.`);
      return null;
  }
  return next.getTime();
}

/**
 * Calculates the next weekly occurrence of a given time on specified days of the week,
 * strictly after a specified timestamp.
 * Handles time strings in "HH:MM" format or ISO strings by extracting "HH:MM".
 * It finds the earliest possible time across all specified daysOfWeek that is after fromTimestamp.
 *
 * @param {string} timeStr - The time string, e.g., "14:30" or an ISO string.
 * @param {number[]} daysOfWeek - An array of day numbers (0 for Sunday, 1 for Monday, ..., 6 for Saturday).
 * @param {number} fromTimestamp - The timestamp (milliseconds since epoch) from which to calculate the next occurrence.
 * @returns {number|null} The timestamp of the earliest next weekly occurrence, or null if inputs are invalid or no valid occurrence is found.
 */
// Helper function to get the next weekly occurrence strictly AFTER a given timestamp
function getNextWeeklyOccurrenceFrom(timeStr, daysOfWeek, fromTimestamp) {
  let timeToParse = timeStr;
  if (timeStr && timeStr.includes('T')) {
    const parts = timeStr.split('T');
    if (parts.length > 1 && parts[1].includes(':')) {
      timeToParse = parts[1].substring(0, 5); // Extract HH:MM
    } else {
      console.error(`Invalid ISO time string format in getNextWeeklyOccurrenceFrom: '${timeStr}'. Cannot extract time.`);
      return null;
    }
  }

  const [hStr, mStr] = timeToParse.split(":");
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);

  if (isNaN(h) || isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) {
    console.error(`Invalid time string in getNextWeeklyOccurrenceFrom: '${timeStr}'. Cannot calculate next occurrence.`);
    return null;
  }

  let earliestNext = Infinity;
  const baseDateForCalc = new Date(fromTimestamp); // Use this to determine current day for diff calculation

  daysOfWeek.forEach(dayOfWeek => {
    let next = new Date(fromTimestamp); // Start calculation from fromTimestamp
    
    // Set the time for the candidate 'next' date
    next.setHours(h, m, 0, 0); 

    // Calculate days to add to reach the target dayOfWeek from baseDateForCalc's day
    const currentDayOfBase = baseDateForCalc.getDay();
    let daysToAdd = (dayOfWeek - currentDayOfBase + 7) % 7;
    
    // Apply daysToAdd to a date starting from baseDateForCalc, then set time
    let candidateDate = new Date(baseDateForCalc);
    candidateDate.setDate(baseDateForCalc.getDate() + daysToAdd);
    candidateDate.setHours(h, m, 0, 0);

    // If this candidate is on or before fromTimestamp, it means we need the one in the *next* week
    if (candidateDate.getTime() <= fromTimestamp) {
      candidateDate.setDate(candidateDate.getDate() + 7);
    }
    
    // Ensure candidateDate is valid before comparing
    if (!isNaN(candidateDate.getTime()) && candidateDate.getTime() < earliestNext) {
      earliestNext = candidateDate.getTime();
    }
  });
  // Check if earliestNext remained Infinity or became NaN
  if (earliestNext === Infinity || isNaN(earliestNext)) {
    return null;
  }
  return earliestNext;
}

/**
 * Utility to prune cleared missed alarms older than a defined period (currently 30 days).
 * Filters an array of cleared missed alarm objects, removing entries whose `clearedAt`
 * timestamp is older than the pruning threshold relative to the current time.
 *
 * @param {Array<object>} clearedList - Array of cleared missed alarm objects. Each object is expected
 *                                    to have a `clearedAt` property (timestamp in milliseconds).
 * @returns {Array<object>} A new array containing only the cleared missed alarm entries
 *                          that are within the 30-day retention period.
 */
function pruneClearedMissedAlarms(clearedList) {
  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
  const now = Date.now();
  return clearedList.filter(entry => (now - entry.clearedAt) < THIRTY_DAYS_MS);
}

/**
 * Checks for schedules that should have run while the extension was inactive (e.g., browser closed).
 * If missed alarms are enabled and found, it stores them in `chrome.storage.local`
 * and displays a notification to the user.
 * For recurring schedules, it identifies the latest missed instance.
 * @async
 */
async function checkMissedAlarmsOnStartup() {
  // console.log("checkMissedAlarmsOnStartup: Entered function.");
  try {
    const settingsResult = await chrome.storage.sync.get(['chronotab_missed_alarms_enabled', 'schedules']);
    const missedAlarmsEnabled = settingsResult.chronotab_missed_alarms_enabled !== false; // Default true

    if (!missedAlarmsEnabled) {
      // console.log("checkMissedAlarmsOnStartup: Missed alarm check skipped (disabled by setting).");
      return;
    }

    const schedules = settingsResult.schedules;
    if (!schedules || schedules.length === 0) {
      // console.log("checkMissedAlarmsOnStartup: No schedules to check for missed alarms.");
      // Ensure data is cleared if no schedules exist
      await chrome.storage.local.remove('chronotab_missed_alarms_data');
      return;
    }

    const now = Date.now();
    let missedAlarmsAccumulator = [];

    for (const schedule of schedules) {
      if (!schedule.id) continue;

      if (schedule.repeat === "once") {
        if (schedule.calculatedWhen && schedule.calculatedWhen < now && (!schedule.lastRun || schedule.lastRun < schedule.calculatedWhen)) {
          missedAlarmsAccumulator.push({
            scheduleId: schedule.id,
            scheduleName: schedule.name,
            missedRunTime: schedule.calculatedWhen
          });
        }
      } else { // Daily or Weekly
        let lastActualRunTime = schedule.lastRun || 0;
        let potentialNextRunTime = lastActualRunTime;
        let latestMissedRunTimeToRecordForThisSchedule = null;

        while (potentialNextRunTime < now) {
          let calculatedNext;
          if (schedule.repeat === "daily") {
            calculatedNext = getNextOccurrenceFrom(schedule.time, potentialNextRunTime);
          } else if (schedule.repeat === "weekly" && schedule.dayOfWeek && schedule.dayOfWeek.length > 0) {
            calculatedNext = getNextWeeklyOccurrenceFrom(schedule.time, schedule.dayOfWeek, potentialNextRunTime);
          } else {
            break;
          }

          if (calculatedNext && calculatedNext < now) {
            if (!schedule.lastRun || schedule.lastRun < calculatedNext) {
              latestMissedRunTimeToRecordForThisSchedule = calculatedNext;
            }
            potentialNextRunTime = calculatedNext;
          } else {
            break;
          }
        }
        if (latestMissedRunTimeToRecordForThisSchedule) {
          missedAlarmsAccumulator.push({
            scheduleId: schedule.id,
            scheduleName: schedule.name,
            missedRunTime: latestMissedRunTimeToRecordForThisSchedule
          });
        }
      }
    }

    const uniqueMissed = Array.from(new Map(missedAlarmsAccumulator.map(m => [`${m.scheduleId}-${m.missedRunTime}`, m])).values());

    let clearedList = [];
    try {
      const clearedResult = await chrome.storage.local.get('chronotab_cleared_missed_alarms');
      clearedList = pruneClearedMissedAlarms(clearedResult.chronotab_cleared_missed_alarms || []);
      await chrome.storage.local.set({ chronotab_cleared_missed_alarms: clearedList });
    } catch (error) {
      console.error('Error accessing chronotab_cleared_missed_alarms in checkMissedAlarmsOnStartup:', error);
    }

    const activeMissedAlarms = uniqueMissed.filter(missed => {
      return !clearedList.some(cleared => cleared.scheduleId === missed.scheduleId && cleared.missedRunTime === missed.missedRunTime);
    });

    const persistedResult = await chrome.storage.local.get('chronotab_missed_alarms_data');
    const persistedMissedAlarmsData = persistedResult.chronotab_missed_alarms_data || [];

    let newMissedAlarmsData = [];
    let alarmsRequiringNotification = [];

    for (const currentMissed of activeMissedAlarms) {
      const persistedEntry = persistedMissedAlarmsData.find(
        p => p.scheduleId === currentMissed.scheduleId && p.missedRunTime === currentMissed.missedRunTime
      );

      let newEntry;
      if (persistedEntry) {
        newEntry = { ...currentMissed, hasBeenNotified: persistedEntry.hasBeenNotified };
      } else {
        newEntry = { ...currentMissed, hasBeenNotified: false };
      }
      newMissedAlarmsData.push(newEntry);

      if (!newEntry.hasBeenNotified) {
        // Add a copy to alarmsRequiringNotification to avoid issues if object references are modified later
        alarmsRequiringNotification.push({ ...newEntry });
      }
    }

    if (alarmsRequiringNotification.length > 0) {
      // console.log(`${alarmsRequiringNotification.length} new missed alarms requiring notification.`);
      chrome.notifications.create('missedAlarmsNotification', {
        type: 'basic',
        iconUrl: chrome.runtime.getURL("icon.png"),
        title: 'Chronotab: Missed Schedules',
        message: `You have ${alarmsRequiringNotification.length} new missed schedule(s). Click to review.`,
        priority: 1,
        buttons: [{ title: 'Review Missed Schedules' }]
      }, (_notificationId) => {
        if (chrome.runtime.lastError) {
          console.error('Missed schedules notification error:', chrome.runtime.lastError.message);
        }
      });

      // Update hasBeenNotified flag in newMissedAlarmsData for those that were just notified
      alarmsRequiringNotification.forEach(notifiedAlarm => {
        const entryInNewData = newMissedAlarmsData.find(
          m => m.scheduleId === notifiedAlarm.scheduleId && m.missedRunTime === notifiedAlarm.missedRunTime
        );
        if (entryInNewData) {
          entryInNewData.hasBeenNotified = true;
        }
      });
    }

    if (newMissedAlarmsData.length > 0) {
      // console.log("Saving updated missed alarms data:", newMissedAlarmsData);
      await chrome.storage.local.set({ chronotab_missed_alarms_data: newMissedAlarmsData });
    } else {
      // console.log("No active missed alarms. Removing chronotab_missed_alarms_data.");
      await chrome.storage.local.remove('chronotab_missed_alarms_data');
    }

  } catch (error) {
    console.error("Error in checkMissedAlarmsOnStartup:", error);
  }
}

/**
 * Listener for when the browser first starts up.
 * Calls `checkMissedAlarmsOnStartup` to handle any schedules missed while the browser was closed.
 * This function is asynchronous to allow `checkMissedAlarmsOnStartup` to complete its operations,
 * which may involve asynchronous calls to `chrome.storage`.
 * @async
 */
chrome.runtime.onStartup.addListener(async () => { // Make the listener async
  // console.log("onStartup: Listener fired.");
  try {
    // console.log("onStartup: Calling checkMissedAlarmsOnStartup.");
    await checkMissedAlarmsOnStartup(); // Await the async function
    // console.log("onStartup: checkMissedAlarmsOnStartup call completed successfully.");
  } catch (e) {
    // This will catch errors from checkMissedAlarmsOnStartup if they are not caught internally
    // or if checkMissedAlarmsOnStartup itself re-throws an error.
    console.error("Error during onStartup execution of checkMissedAlarmsOnStartup:", e);
  }
});

/**
 * Listener for notification clicks.
 * If the clicked notification is for missed alarms ('missedAlarmsNotification'),
 * it opens the missed alarms page in a new tab and clears the notification.
 * @param {string} notificationId - The ID of the clicked notification.
 */
chrome.notifications.onClicked.addListener((notificationId) => {
  if (notificationId === 'missedAlarmsNotification') {
    chrome.tabs.create({ url: chrome.runtime.getURL('index.html#/missed-alarms') });
    chrome.notifications.clear('missedAlarmsNotification');
  }
});

/**
 * Listener for notification button clicks.
 * Specifically, if the button clicked belongs to the 'missedAlarmsNotification'
 * and has the 'reviewMissed' button index (0), it opens the missed alarms page.
 * @param {string} notificationId - The ID of the notification.
 * @param {number} buttonIndex - The index of the button clicked on the notification.
 */
chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
  if (notificationId === 'missedAlarmsNotification' && buttonIndex === 0) { // Assuming 'Review Missed Schedules' is the first button (index 0)
    chrome.tabs.create({ url: chrome.runtime.getURL('index.html#/missed-alarms') });
    chrome.notifications.clear('missedAlarmsNotification');
  }
});

/**
 * @typedef {object} MessageRequest
 * Defines the structure of messages sent to the background script for various actions.
 * @property {string} action - The type of action to perform (e.g., "runMissedAlarm", "clearMissedAlarmEntry").
 * @property {string} [scheduleId] - The ID of the schedule, relevant for schedule-specific actions.
 * @property {number} [missedRunTime] - The specific timestamp of a missed run, used for clearing specific entries.
 */

/**
 * @typedef {function} SendResponse
 * A callback function used to send a response to a message sender in Chrome extensions.
 * @param {any} [response] - The data to be sent as a response.
 */

/**
 * Listener for messages from other parts of the extension (e.g., popup, options page).
 * Handles actions:
 * - `runMissedAlarm`: Runs a specified missed schedule, updates its lastRun time, and removes it if it's a 'once' schedule.
 * - `clearMissedAlarmEntry`: Clears a single missed alarm entry from local storage and updates the schedule's lastRun time in sync storage.
 * - `clearAllMissedAlarms`: Clears all missed alarm entries from local storage and updates the lastRun times of the corresponding schedules in sync storage.
 * @param {MessageRequest} request - The message request object.
 * @param {object} sender - Information about the sender of the message.
 * @param {SendResponse} sendResponse - Function to call to send a response.
 * @returns {boolean} Returns `true` to indicate that `sendResponse` will be called asynchronously.
 */
// Listener for messages from the MissedAlarmsPage
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "runMissedAlarm" && request.scheduleId) {
    (async () => {
      try {
        const { schedules: currentSchedules } = await chrome.storage.sync.get("schedules");
        let schedulesToUpdate = currentSchedules ? [...currentSchedules] : []; // Ensure schedulesToUpdate is an array
        
        const scheduleIndex = schedulesToUpdate.findIndex(s => s.id === request.scheduleId);
        
        if (scheduleIndex !== -1) {
           const scheduleToRun = schedulesToUpdate[scheduleIndex];
           runSchedule(scheduleToRun); // Use imported function

          // Update lastRun for the schedule
          schedulesToUpdate[scheduleIndex] = { ...scheduleToRun, lastRun: Date.now() };

          // If it was a "once" schedule, remove it
          if (scheduleToRun.repeat === "once") {
            schedulesToUpdate = schedulesToUpdate.filter(s => s.id !== request.scheduleId);
          }
          
          await chrome.storage.sync.set({ schedules: schedulesToUpdate });
          // The chrome.storage.onChanged listener will handle calling registerAlarms()
          
          sendResponse({ success: true });
        } else {
          sendResponse({ success: false, error: "Schedule not found" });
        }
      } catch (error) {
        console.error("Error running missed schedule from message:", error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true; // Indicates asynchronous response
  }

  // New handler for clearing a single missed alarm entry
  if (request.action === "clearMissedAlarmEntry" && request.scheduleId && typeof request.missedRunTime === 'number') {
    (async () => {
        try {
            // 1. Update the schedule's lastRun in chrome.storage.sync
            const syncData = await chrome.storage.sync.get("schedules");
            let schedules = syncData.schedules || [];
            const scheduleIndex = schedules.findIndex(s => s.id === request.scheduleId);
            let scheduleUpdatedInSync = false;

            if (scheduleIndex !== -1) {
              // Only update lastRun if the missedRunTime is more recent
              // or if lastRun is not set.
              if (!schedules[scheduleIndex].lastRun || request.missedRunTime > schedules[scheduleIndex].lastRun) {
                schedules[scheduleIndex].lastRun = request.missedRunTime;
                await chrome.storage.sync.set({ schedules });
                scheduleUpdatedInSync = true;
                // console.log(`[Chronotab] Updated lastRun for schedule ${request.scheduleId} to ${new Date(request.missedRunTime).toLocaleString()}`);
              }
            } else {
              console.warn(`[Chronotab] clearMissedAlarmEntry: Schedule ID ${request.scheduleId} not found in sync storage.`);
            }

            // 2. Remove the specific entry from chronotab_missed_alarms_data in chrome.storage.local
            const localResult = await chrome.storage.local.get('chronotab_missed_alarms_data');
            let missedAlarmsData = localResult.chronotab_missed_alarms_data || [];
            
            const originalLength = missedAlarmsData.length;
            const updatedMissedAlarmsData = missedAlarmsData.filter(
              alarm => !(alarm.scheduleId === request.scheduleId && alarm.missedRunTime === request.missedRunTime)
            );

            if (updatedMissedAlarmsData.length < originalLength) {
              if (updatedMissedAlarmsData.length === 0) {
                await chrome.storage.local.remove('chronotab_missed_alarms_data');
              } else {
                await chrome.storage.local.set({ chronotab_missed_alarms_data: updatedMissedAlarmsData });
              }
              // --- Add to cleared log ---
              let clearedList = [];
              try {
                const clearedResult = await chrome.storage.local.get('chronotab_cleared_missed_alarms');
                clearedList = pruneClearedMissedAlarms(clearedResult.chronotab_cleared_missed_alarms || []);
              } catch (error) {
                console.error('Error fetching chronotab_cleared_missed_alarms in clearMissedAlarmEntry:', error);
                // Proceeding with an empty clearedList, potentially losing older cleared items if this was a temporary read failure.
              }
              clearedList.push({ scheduleId: request.scheduleId, missedRunTime: request.missedRunTime, clearedAt: Date.now() });
              clearedList = pruneClearedMissedAlarms(clearedList);
              await chrome.storage.local.set({ chronotab_cleared_missed_alarms: clearedList });
              sendResponse({ success: true, message: "Missed alarm entry cleared and schedule updated." });
            } else {
              // If schedule was updated in sync but item not found in local, still a partial success.
              if (scheduleUpdatedInSync) {
                  sendResponse({ success: true, message: "Schedule lastRun updated, but alarm entry not found in local missed list (might have been cleared already)." });
              } else {
                  sendResponse({ success: false, error: "Missed alarm entry not found in local storage, and schedule not updated." });
              }
            }
        } catch (error) {
            console.error("Error in clearMissedAlarmEntry:", error);
            sendResponse({ success: false, error: error.message });
        }
    })();
    return true; // Indicates asynchronous response
  }

  // Handler for clearing ALL missed alarm entries
  if (request.action === "clearAllMissedAlarms") {
    (async () => {
      try {
        const localResult = await chrome.storage.local.get('chronotab_missed_alarms_data');
        const missedAlarmsToClear = localResult.chronotab_missed_alarms_data || [];

        if (missedAlarmsToClear.length === 0) {
          sendResponse({ success: true, message: "No missed schedules to clear." });
          return;
        }

        const syncData = await chrome.storage.sync.get("schedules");
        let schedules = syncData.schedules || [];
        let schedulesWereUpdatedInSync = false;

        for (const missedAlarm of missedAlarmsToClear) {
          const scheduleIndex = schedules.findIndex(s => s.id === missedAlarm.scheduleId);
          if (scheduleIndex !== -1) {
            if (!schedules[scheduleIndex].lastRun || missedAlarm.missedRunTime > schedules[scheduleIndex].lastRun) {
              schedules[scheduleIndex].lastRun = missedAlarm.missedRunTime;
              schedulesWereUpdatedInSync = true;
            }
          } else {
            console.warn(`[Chronotab] clearAllMissedAlarms: Schedule ID ${missedAlarm.scheduleId} not found in sync storage for missed time ${new Date(missedAlarm.missedRunTime).toLocaleString()}.`);
          }
        }

        if (schedulesWereUpdatedInSync) {
          await chrome.storage.sync.set({ schedules });
          // console.log("[Chronotab] Updated lastRun for multiple schedules during clearAllMissedAlarms.");
        }

        // Clear all from local storage by removing the key
        await chrome.storage.local.remove('chronotab_missed_alarms_data');

        // --- Add all to cleared log ---
        let clearedList = [];
        try {
          const clearedResult = await chrome.storage.local.get('chronotab_cleared_missed_alarms');
          clearedList = pruneClearedMissedAlarms(clearedResult.chronotab_cleared_missed_alarms || []);
        } catch (error) {
          console.error('Error fetching chronotab_cleared_missed_alarms in clearAllMissedAlarms:', error);
          // Proceeding with an empty clearedList, potentially losing older cleared items if this was a temporary read failure.
        }
        const now = Date.now();
        for (const missedAlarm of missedAlarmsToClear) {
          clearedList.push({ scheduleId: missedAlarm.scheduleId, missedRunTime: missedAlarm.missedRunTime, clearedAt: now });
        }
        clearedList = pruneClearedMissedAlarms(clearedList);
        await chrome.storage.local.set({ chronotab_cleared_missed_alarms: clearedList });

        sendResponse({ success: true, message: "All missed schedules cleared and schedules updated." });

      } catch (error) {
        console.error("Error in clearAllMissedAlarms:", error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true; // Indicates asynchronous response
  }
  // Ensure other message handlers are not affected if they exist below
});

/**
 * Creates and configures context menus for the extension.
 *
 * It sets up the following:
 * - A parent menu "Add current page to Chronotab" (context: `page`) with options to:
 *   - "Create New Schedule..."
 *   - Add to existing schedules (if any are present).
 * - A parent menu "Run Chronotab schedule now" (contexts: `action`, `browser_action`, `page`) with options to:
 *   - Run existing schedules (if any are present).
 *   - Shows "No schedules configured" (disabled) if none exist.
 *
 * This function first removes all existing context menus to ensure a clean setup before recreating them.
 * Schedule data is fetched from `chrome.storage.sync` to populate the menu items.
 */
// Context menu setup for adding current page to a schedule
function createContextMenus() {
  chrome.contextMenus.removeAll(() => {
    // Parent menu for adding current page to a schedule (page context)
    chrome.contextMenus.create({
      id: 'chronotab-add-to-schedule',
      title: 'Add current page to Chronotab',
      contexts: ['page']
    });

    // Parent menu for running a schedule (extension icon context)
    chrome.contextMenus.create({
      id: 'chronotab-run-schedule',
      title: 'Run Chronotab schedule now',
      contexts: ['action', 'browser_action', 'page'] // Added 'page' context
    });

    chrome.storage.sync.get(['schedules'], (result) => {
      const schedules = result.schedules || [];

      // Populate "Add current page to Chronotab" (page context)
      // Always add "Create New Schedule..." option first
      chrome.contextMenus.create({
        id: 'chronotab-add-to-schedule-new', // Handled by onClicked listener
        parentId: 'chronotab-add-to-schedule',
        title: 'Create New Schedule...',
        contexts: ['page']
      });

      if (schedules.length > 0) {
        // Add a separator if there are existing schedules to list below "Create New"
        chrome.contextMenus.create({
          id: 'chronotab-add-separator', 
          parentId: 'chronotab-add-to-schedule',
          type: 'separator',
          contexts: ['page']
        });
        // Add options to add to existing schedules
        schedules.forEach(schedule => {
          chrome.contextMenus.create({
            id: `chronotab-add-to-schedule-${schedule.id}`,
            parentId: 'chronotab-add-to-schedule',
            title: `Add to: ${schedule.name}`,
            contexts: ['page']
          });
        });
      }

      // Populate "Run Chronotab schedule now" (extension icon context)
      if (schedules.length === 0) {
        chrome.contextMenus.create({
          id: `chronotab-run-schedule-empty`,
          parentId: 'chronotab-run-schedule',
          title: 'No schedules configured',
          enabled: false,
          contexts: ['action', 'browser_action', 'page'] // Added 'page' context
        });
      } else {
        schedules.forEach(schedule => {
          chrome.contextMenus.create({
            id: `chronotab-run-now-${schedule.id}`, // Handled by onClicked listener
            parentId: 'chronotab-run-schedule',
            title: `Run: ${schedule.name}`,
            contexts: ['action', 'browser_action', 'page'] // Added 'page' context
          });
        });
      }
    });
  });
}

/**
 * @typedef {object} ContextMenuOnClickData
 * Provides information about the context menu item that was clicked.
 * @property {*} menuItemId - The ID of the menu item that was clicked.
 * @property {string} [pageUrl] - The URL of the page where the context menu was clicked.
 * @property {string} [linkUrl] - If the clicked item was a link, this is the URL of the link.
 * @property {string} [srcUrl] - If the clicked item was an image or video, this is its source URL.
 */

/**
 * @typedef {object} Tab
 * Represents a browser tab in Chrome.
 * @property {number} [id] - The unique identifier for the tab.
 * @property {string} [url] - The URL the tab is displaying.
 */

/**
 * Listener for context menu clicks.
 *
 * Handles actions based on the `menuItemId`:
 * - `chronotab-run-now-<scheduleId>`: Runs the specified schedule immediately.
 *
 * @param {ContextMenuOnClickData} info - Information about the item clicked and the context where the click occurred.
 * @param {Tab} tab - The details of the tab where the click took place (if applicable).
 */
// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId.startsWith('chronotab-add-to-schedule-')) {
    if (info.menuItemId === 'chronotab-add-to-schedule-new') {
      // Open the extension's schedule editor page to create a new schedule, passing the current tab's URL
      const urlParam = tab && tab.url ? `?url=${encodeURIComponent(tab.url)}` : '';
      chrome.tabs.create({ url: chrome.runtime.getURL(`index.html#/schedule/new${urlParam}`) });
    } else {
      // Add current page to the selected schedule
      const scheduleId = info.menuItemId.replace('chronotab-add-to-schedule-', '');
      chrome.storage.sync.get(['schedules'], (result) => {
        let schedules = result.schedules || [];
        const idx = schedules.findIndex(s => s.id === scheduleId);
        if (idx !== -1 && tab && tab.url) {
          // Prevent adding chrome:// URLs
          if (tab.url.startsWith('chrome://')) {
            chrome.notifications.create({
              type: 'basic',
              iconUrl: chrome.runtime.getURL('icon.png'),
              title: 'Chronotab',
              message: 'Cannot add chrome:// pages to a schedule.',
              priority: 0
            });
            return;
          }
          if (!schedules[idx].urls.includes(tab.url)) {
            schedules[idx].urls.push(tab.url);
            chrome.storage.sync.set({ schedules }, () => {
              chrome.notifications.create({
                type: 'basic',
                iconUrl: chrome.runtime.getURL('icon.png'),
                title: 'Chronotab',
                message: `Added to schedule: ${schedules[idx].name}`,
                priority: 1
              });
            });
          } else {
            chrome.notifications.create({
              type: 'basic',
              iconUrl: chrome.runtime.getURL('icon.png'),
              title: 'Chronotab',
              message: 'This page is already in the selected schedule.',
              priority: 0
            });
          }
        }
      });
    }
  } else if (info.menuItemId.startsWith('chronotab-run-now-')) {
    const scheduleId = info.menuItemId.replace('chronotab-run-now-', '');
    chrome.storage.sync.get(['schedules'], (result) => {
      const schedules = result.schedules || [];
      const scheduleToRun = schedules.find(s => s.id === scheduleId);
      if (scheduleToRun) {
        runSchedule(scheduleToRun); // Use imported function
      }
    });
  } else if (info.menuItemId === "open-chronotab") {
    chrome.tabs.create({ url: chrome.runtime.getURL("index.html") });
  }
});

/**
 * @typedef {object} OnInstalledDetails
 * Contains details about the installation or update event of the extension.
 * @property {string} reason - The reason for the event (e.g., "install", "update", "chrome_update").
 * @property {string} [previousVersion] - The previous version of the extension, if it was updated.
 */

/**
 * Listener for when the extension is first installed, updated to a new version,
 * or when Chrome is updated to a new version.
 * It re-registers all alarms, recreates context menus, and initializes the
 * `chronotab_missed_alarms_enabled` setting to true if it's not already set.
 * If the reason for installation is "install" or "update", it also calls `checkMissedAlarmsOnStartup`.
 * This function is asynchronous to allow `checkMissedAlarmsOnStartup` and storage operations to complete.
 * @param {OnInstalledDetails} details - Object containing details about the installation event.
 * @async
 */
// Re-register alarms on install/update
chrome.runtime.onInstalled.addListener(async (details) => {
  // console.log(`onInstalled: Listener fired. Reason: ${details.reason}`); // <-- ADDED LOG
  try {
    // console.log("onInstalled: Calling registerAlarms and createContextMenus."); // <-- ADDED LOG
    registerAlarms();
    createContextMenus();
    // console.log("onInstalled: registerAlarms and createContextMenus completed."); // <-- ADDED LOG

    const result = await chrome.storage.sync.get('chronotab_missed_alarms_enabled');
    if (typeof result.chronotab_missed_alarms_enabled === 'undefined') {
      await chrome.storage.sync.set({ chronotab_missed_alarms_enabled: true });
      // console.log("onInstalled: Default 'missed alarms enabled' setting to true.");
    }
    
    if (details.reason === "install" || details.reason === "update") {
       // console.log(`onInstalled: Reason is ${details.reason}, calling checkMissedAlarmsOnStartup.`); // <-- ADDED LOG
       checkMissedAlarmsOnStartup();
       // console.log("onInstalled: checkMissedAlarmsOnStartup call initiated for install/update."); // <-- ADDED LOG
    }
  } catch (e) {
    console.error("Error in onInstalled listener callback:", e); // <-- ADDED CATCH
  }
});

/**
 * @typedef {object} StorageChange
 * Describes the change in a single storage item, as provided by `chrome.storage.onChanged`.
 * @property {*} [oldValue] - The old value of the item, if it existed before this change.
 * @property {*} [newValue] - The new value of the item, if it was set or changed.
 */

/**
 * @typedef {object.<string, StorageChange>} StorageChanges
 * An object where each key is the name of a storage item that changed, and the value is a StorageChange object.
 */

/**
 * Listener for changes in the `chrome.storage` area.
 * If schedules in `chrome.storage.sync` are changed, it re-registers alarms
 * and recreates context menus to reflect the updated schedule list.
 * @param {StorageChanges} changes - Object describing the changes made to storage items.
 * @param {string} area - The name of the storage area that changed ("sync", "local", or "managed").
 */
// Listen for storage changes to re-register alarms
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && changes.schedules) {
    // If schedules change, re-register alarms.
    // We also need to update the `calculatedWhen` if a "once" schedule is modified.
    // The current registerAlarms handles updating calculatedWhen.
    registerAlarms();
    createContextMenus(); // Assuming this function exists
  }
  // If the missed alarm setting changes, we don't need to do anything immediately,
  // the checkMissedAlarmsOnStartup will pick it up next time.
});

/**
 * Listener for when the extension's action icon (toolbar icon) is clicked.
 * Opens the main extension page (`index.html`) in a new tab.
 * @param {Tab} tab - The details of the tab where the click originated (not typically used in this specific listener but provided by the API).
 */
// Open extension tab when the extension icon is clicked
chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: chrome.runtime.getURL('index.html') });
});

// console.log("Chronotab background.js: Initial script execution completed."); // <-- ADDED LOG AT THE VERY END
