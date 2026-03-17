import { AKASHI_STATUS, BADGE } from '../shared/constants.js';
import { MESSAGE_TYPES } from '../shared/message-types.js';
import { todayDateString } from '../shared/utils.js';
import { StorageManager } from './storage-manager.js';

export class AkashiManager {
  /**
   * Check Akashi status: update daily record from tab if available,
   * then evaluate badge/notification based on daily attendance defaults.
   */
  static async checkAkashiStatus() {
    const settings = await StorageManager.getSettings();

    if (!settings.enableAkashi) {
      // Clear badge when Akashi check is disabled
      await this.updateBadge(AKASHI_STATUS.CLOCKED_IN, false);
      return;
    }

    // Try to update daily attendance from Akashi tab
    await this.tryUpdateFromTab(settings);

    // Evaluate status from daily attendance record + time of day
    await this.evaluateAndNotify(settings);
  }

  /**
   * Query Akashi tab and update daily attendance record if info is available.
   */
  static async tryUpdateFromTab(settings) {
    let tabs;
    try {
      tabs = await chrome.tabs.query({ url: `${settings.akashiUrl}/*` });
    } catch {
      return;
    }
    if (tabs.length === 0) return;

    // Query ALL Akashi tabs and use the best result
    // Only trust data from pages loaded today (stale tabs show yesterday's data)
    const today = todayDateString();
    let bestClockedIn = false;
    let bestClockedOut = false;

    for (const tab of tabs) {
      let response;
      try {
        response = await chrome.tabs.sendMessage(tab.id, {
          type: MESSAGE_TYPES.REQUEST_AKASHI_STATUS,
        });
      } catch {
        continue;
      }
      if (!response || !response.status) continue;

      // Skip tabs loaded on a previous day (stale data)
      if (response.pageLoadDate && response.pageLoadDate !== today) {
        continue;
      }

      if (response.status === AKASHI_STATUS.CLOCKED_IN) {
        bestClockedIn = true;
        if (response.hasClockOut) {
          bestClockedOut = true;
          break; // Both confirmed, no need to check more tabs
        }
      }
    }

    if (bestClockedIn) {
      await StorageManager.updateDailyAttendance({ clockedIn: true });
    }
    if (bestClockedOut) {
      await StorageManager.updateDailyAttendance({ clockedOut: true });
    }
  }

  /**
   * Handle status update pushed from content script.
   */
  static async handleStatusUpdate(status, settings, hasClockOut = false) {
    if (!settings) {
      settings = await StorageManager.getSettings();
    }

    // Update daily attendance record
    if (status === AKASHI_STATUS.CLOCKED_IN) {
      await StorageManager.updateDailyAttendance({ clockedIn: true });
      if (hasClockOut) {
        await StorageManager.updateDailyAttendance({ clockedOut: true });
      }
    }

    // Re-evaluate based on updated attendance
    await this.evaluateAndNotify(settings);
  }

  /**
   * Determine effective status from daily attendance + time, then update badge/notifications.
   *
   * Rules:
   *   Before 18:00 — default: not clocked in  → "出" badge
   *   After  18:00 — default: not clocked out → "退" badge
   *   Once clockedIn / clockedOut is confirmed via content script, badge clears.
   */
  static async evaluateAndNotify(settings) {
    const attendance = await StorageManager.getDailyAttendance();
    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();
    const isAfter18 = hour >= 18;
    const isAfter2155 = hour > 21 || (hour === 21 && minute >= 55);

    let effectiveStatus;
    if (attendance.clockedOut) {
      effectiveStatus = AKASHI_STATUS.CLOCKED_OUT;
    } else if (isAfter18) {
      effectiveStatus = AKASHI_STATUS.NOT_CLOCKED_OUT;
    } else {
      effectiveStatus = attendance.clockedIn
        ? AKASHI_STATUS.CLOCKED_IN
        : AKASHI_STATUS.NOT_CLOCKED_IN;
    }

    await StorageManager.setAkashiStatus(effectiveStatus);
    await this.updateBadge(effectiveStatus, isAfter2155);

    // Notifications (each method has its own daily dedup)
    if (effectiveStatus === AKASHI_STATUS.NOT_CLOCKED_IN && settings.notifyAkashi) {
      await this.sendNotification();
    }
    if (effectiveStatus === AKASHI_STATUS.NOT_CLOCKED_OUT && settings.notifyAkashi) {
      await this.sendClockoutNotification(isAfter2155);
    }
  }

  /**
   * Update the extension badge based on Akashi status.
   */
  static async updateBadge(status, isUrgent = false) {
    try {
      if (status === AKASHI_STATUS.NOT_CLOCKED_IN) {
        await chrome.action.setBadgeText({ text: BADGE.NOT_CLOCKED_IN.text });
        await chrome.action.setBadgeBackgroundColor({ color: BADGE.NOT_CLOCKED_IN.color });
      } else if (status === AKASHI_STATUS.NOT_CLOCKED_OUT) {
        const badge = isUrgent ? BADGE.NOT_CLOCKED_OUT_URGENT : BADGE.NOT_CLOCKED_OUT;
        await chrome.action.setBadgeText({ text: badge.text });
        await chrome.action.setBadgeBackgroundColor({ color: badge.color });
      } else {
        await chrome.action.setBadgeText({ text: BADGE.CLEAR.text });
      }
    } catch {
      // chrome.action may not be available in tests
    }
  }

  /**
   * Send desktop notification for missing clock-in (once per day).
   */
  static async sendNotification() {
    const today = todayDateString();
    const lastSent = await StorageManager.getNotificationSentDate();

    if (lastSent === today) return; // Already notified today

    try {
      await chrome.notifications.create('akashi-remind', {
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title: 'Akashi: 出勤未打刻',
        message: '出勤の打刻を忘れていませんか？',
        requireInteraction: true,
      });
      await StorageManager.setNotificationSentDate(today);
    } catch {
      // Notification failure is non-critical
    }
  }

  /**
   * Send desktop notification for missing clock-out (once per day, urgent after 21:55).
   */
  static async sendClockoutNotification(isUrgent) {
    const today = todayDateString();
    const lastSent = await StorageManager.getClockoutNotificationSentDate();

    // For urgent notifications, always send. For normal, once per day.
    if (!isUrgent && lastSent === today) return;

    try {
      if (isUrgent) {
        await chrome.notifications.create('akashi-clockout-urgent', {
          type: 'basic',
          iconUrl: 'icons/icon128.png',
          title: 'Akashi: 退勤打刻が必要です！',
          message: '21:55を過ぎています。すぐに退勤打刻をしてください！',
          requireInteraction: true,
          priority: 2,
        });
      } else {
        await chrome.notifications.create('akashi-clockout-remind', {
          type: 'basic',
          iconUrl: 'icons/icon128.png',
          title: 'Akashi: 退勤未打刻',
          message: '退勤の打刻を忘れていませんか？',
        });
        await StorageManager.setClockoutNotificationSentDate(today);
      }
    } catch {
      // Notification failure is non-critical
    }
  }
}
