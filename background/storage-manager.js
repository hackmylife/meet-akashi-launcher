import { STORAGE_KEYS, DEFAULT_SETTINGS } from '../shared/constants.js';
import { todayDateString } from '../shared/utils.js';

export class StorageManager {
  static async initializeDefaults() {
    const { [STORAGE_KEYS.SETTINGS]: settings } = await chrome.storage.sync.get(STORAGE_KEYS.SETTINGS);
    if (!settings) {
      await chrome.storage.sync.set({ [STORAGE_KEYS.SETTINGS]: DEFAULT_SETTINGS });
    }
  }

  // --- Settings (sync) ---

  static async getSettings() {
    const { [STORAGE_KEYS.SETTINGS]: settings } = await chrome.storage.sync.get(STORAGE_KEYS.SETTINGS);
    return { ...DEFAULT_SETTINGS, ...settings };
  }

  static async updateSettings(partial) {
    const current = await this.getSettings();
    const updated = { ...current, ...partial };
    await chrome.storage.sync.set({ [STORAGE_KEYS.SETTINGS]: updated });
    return updated;
  }

  // --- Akashi Status (local) ---

  static async getAkashiStatus() {
    const { [STORAGE_KEYS.AKASHI_STATUS]: status } = await chrome.storage.local.get(STORAGE_KEYS.AKASHI_STATUS);
    return status || { status: 'UNKNOWN', lastCheck: 0 };
  }

  static async setAkashiStatus(statusValue) {
    await chrome.storage.local.set({
      [STORAGE_KEYS.AKASHI_STATUS]: {
        status: statusValue,
        lastCheck: Date.now(),
      },
    });
  }

  // --- Calendar Events (local) ---

  static async getCalendarEvents() {
    const { [STORAGE_KEYS.CALENDAR_EVENTS]: events } = await chrome.storage.local.get(STORAGE_KEYS.CALENDAR_EVENTS);
    return events || [];
  }

  static async setCalendarEvents(events) {
    await chrome.storage.local.set({
      [STORAGE_KEYS.CALENDAR_EVENTS]: events,
      [STORAGE_KEYS.CALENDAR_LAST_FETCH]: Date.now(),
    });
  }

  // --- Opened Meetings (local, dedup) ---

  static async getOpenedMeetings() {
    const { [STORAGE_KEYS.OPENED_MEETINGS]: list } = await chrome.storage.local.get(STORAGE_KEYS.OPENED_MEETINGS);
    return list || [];
  }

  static async addOpenedMeeting(eventId) {
    const list = await this.getOpenedMeetings();
    if (!list.includes(eventId)) {
      list.push(eventId);
      // Keep max 100
      if (list.length > 100) list.splice(0, list.length - 100);
      await chrome.storage.local.set({ [STORAGE_KEYS.OPENED_MEETINGS]: list });
    }
  }

  static async clearOldOpenedMeetings() {
    const { [STORAGE_KEYS.OPENED_MEETINGS_CLEANUP]: lastCleanup } =
      await chrome.storage.local.get(STORAGE_KEYS.OPENED_MEETINGS_CLEANUP);
    if (Date.now() - (lastCleanup || 0) > 24 * 60 * 60 * 1000) {
      await chrome.storage.local.set({
        [STORAGE_KEYS.OPENED_MEETINGS]: [],
        [STORAGE_KEYS.OPENED_MEETINGS_CLEANUP]: Date.now(),
      });
    }
  }

  // --- Notification dedup (local) ---

  static async getNotificationSentDate() {
    const { [STORAGE_KEYS.NOTIFICATION_SENT_DATE]: date } =
      await chrome.storage.local.get(STORAGE_KEYS.NOTIFICATION_SENT_DATE);
    return date || '';
  }

  static async setNotificationSentDate(dateStr) {
    await chrome.storage.local.set({ [STORAGE_KEYS.NOTIFICATION_SENT_DATE]: dateStr });
  }

  // --- Clock-out notification dedup (local) ---

  static async getClockoutNotificationSentDate() {
    const { [STORAGE_KEYS.CLOCKOUT_NOTIFICATION_SENT_DATE]: date } =
      await chrome.storage.local.get(STORAGE_KEYS.CLOCKOUT_NOTIFICATION_SENT_DATE);
    return date || '';
  }

  static async setClockoutNotificationSentDate(dateStr) {
    await chrome.storage.local.set({ [STORAGE_KEYS.CLOCKOUT_NOTIFICATION_SENT_DATE]: dateStr });
  }

  // --- Daily attendance record (local) ---

  static async getDailyAttendance() {
    const { [STORAGE_KEYS.DAILY_ATTENDANCE]: record } =
      await chrome.storage.local.get(STORAGE_KEYS.DAILY_ATTENDANCE);
    const today = todayDateString();
    if (record && record.date === today) {
      return record;
    }
    return { date: today, clockedIn: false, clockedOut: false };
  }

  static async updateDailyAttendance(partial) {
    const current = await this.getDailyAttendance();
    const updated = { ...current, ...partial };
    await chrome.storage.local.set({ [STORAGE_KEYS.DAILY_ATTENDANCE]: updated });
    return updated;
  }

  // --- Skipped meetings (local, daily reset) ---

  static async getSkippedMeetings() {
    const { [STORAGE_KEYS.SKIPPED_MEETINGS]: record } =
      await chrome.storage.local.get(STORAGE_KEYS.SKIPPED_MEETINGS);
    const today = todayDateString();
    if (record && record.date === today) {
      return record.ids || [];
    }
    return [];
  }

  static async addSkippedMeeting(eventId) {
    const today = todayDateString();
    const ids = await this.getSkippedMeetings();
    if (!ids.includes(eventId)) {
      ids.push(eventId);
    }
    await chrome.storage.local.set({
      [STORAGE_KEYS.SKIPPED_MEETINGS]: { date: today, ids },
    });
  }

  static async removeSkippedMeeting(eventId) {
    const today = todayDateString();
    const ids = await this.getSkippedMeetings();
    const filtered = ids.filter((id) => id !== eventId);
    await chrome.storage.local.set({
      [STORAGE_KEYS.SKIPPED_MEETINGS]: { date: today, ids: filtered },
    });
  }
}
