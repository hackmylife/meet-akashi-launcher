import { MEET_TIMING } from '../shared/constants.js';
import { validateMeetUrl } from '../shared/utils.js';
import { CalendarManager } from './calendar-manager.js';
import { StorageManager } from './storage-manager.js';

export class MeetingManager {
  /** In-memory dedup set (survives within SW lifetime). */
  static openedMeetings = new Set();

  /**
   * Check cached events and open Meet URL if within the trigger window.
   */
  static async checkUpcomingMeetings() {
    const settings = await StorageManager.getSettings();
    if (!settings.autoOpenMeet) {
      console.log('[MeetingManager] autoOpenMeet is disabled');
      return;
    }

    // Refresh calendar cache first, fall back to cached events on failure
    let events;
    let source = 'api';
    try {
      events = await CalendarManager.refreshEvents();
    } catch {
      events = null;
    }
    if (!events) {
      events = await StorageManager.getCalendarEvents();
      source = 'cache';
    }

    console.log(`[MeetingManager] ${events.length} events from ${source}`);

    const skipped = await StorageManager.getSkippedMeetings();
    const now = Date.now();

    for (const event of events) {
      if (!event.meetUrl) continue;
      if (skipped.includes(event.id)) continue;

      const startTime = new Date(event.start).getTime();
      const timeUntilStart = startTime - now;

      // Trigger window: from (setting + tolerance) before start to LATE_LIMIT after start
      const beforeStartMs = (settings.meetOpenTiming || 60) * 1000;
      if (
        timeUntilStart <= beforeStartMs + MEET_TIMING.TOLERANCE &&
        timeUntilStart >= -MEET_TIMING.LATE_LIMIT
      ) {
        console.log(`[MeetingManager] Trigger: "${event.summary}" (${Math.round(timeUntilStart / 1000)}s before)`);
        await this.openMeeting(event.id, event.meetUrl, event.summary);
      }
    }

    // Clean up old opened-meetings list periodically
    await StorageManager.clearOldOpenedMeetings();
  }

  /**
   * Open a meeting URL in a new window (with dedup).
   */
  static async openMeeting(eventId, meetUrl, title) {
    // In-memory dedup
    if (this.openedMeetings.has(eventId)) return;

    // Storage dedup (persists across SW restarts)
    const opened = await StorageManager.getOpenedMeetings();
    if (opened.includes(eventId)) {
      this.openedMeetings.add(eventId);
      return;
    }

    // Validate Meet URL before opening
    const validatedUrl = validateMeetUrl(meetUrl);
    if (!validatedUrl) {
      console.warn('[MeetingManager] Invalid Meet URL blocked:', meetUrl);
      return;
    }

    // Open in a new window with configured size
    const settings = await StorageManager.getSettings();
    try {
      await chrome.windows.create({
        url: validatedUrl,
        type: 'normal',
        focused: true,
        width: settings.meetWindowWidth || 1280,
        height: settings.meetWindowHeight || 800,
      });
    } catch (err) {
      console.error('[MeetingManager] Failed to open window:', err);
      return;
    }

    // Show notification
    try {
      await chrome.notifications.create(`meet-${eventId}`, {
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title: 'Meet を開きました',
        message: `「${title}」が間もなく開始されます`,
      });
    } catch {
      // Notification failure is non-critical
    }

    // Record opened
    this.openedMeetings.add(eventId);
    await StorageManager.addOpenedMeeting(eventId);
  }
}
