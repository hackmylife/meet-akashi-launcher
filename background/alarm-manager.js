import { ALARMS, INTERVALS } from '../shared/constants.js';

export class AlarmManager {
  static async initialize() {
    await chrome.alarms.clearAll();

    chrome.alarms.create(ALARMS.MEET_CHECK, {
      delayInMinutes: 0.1, // fire soon after init
      periodInMinutes: INTERVALS.MEET_CHECK,
    });

    chrome.alarms.create(ALARMS.AKASHI_CHECK, {
      delayInMinutes: 0.1,
      periodInMinutes: INTERVALS.AKASHI_CHECK,
    });
  }

  static async ensureAlarms() {
    const alarms = await chrome.alarms.getAll();
    const names = alarms.map((a) => a.name);

    if (!names.includes(ALARMS.MEET_CHECK)) {
      chrome.alarms.create(ALARMS.MEET_CHECK, {
        delayInMinutes: 0.1,
        periodInMinutes: INTERVALS.MEET_CHECK,
      });
    }
    if (!names.includes(ALARMS.AKASHI_CHECK)) {
      chrome.alarms.create(ALARMS.AKASHI_CHECK, {
        delayInMinutes: 0.1,
        periodInMinutes: INTERVALS.AKASHI_CHECK,
      });
    }
  }
}
