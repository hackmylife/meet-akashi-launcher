import { ALARMS } from '../shared/constants.js';
import { MESSAGE_TYPES } from '../shared/message-types.js';
import { todayDateString } from '../shared/utils.js';
import { AlarmManager } from './alarm-manager.js';
import { CalendarManager } from './calendar-manager.js';
import { MeetingManager } from './meeting-manager.js';
import { AkashiManager } from './akashi-manager.js';
import { StorageManager } from './storage-manager.js';

// --- Extension installed / updated ---
chrome.runtime.onInstalled.addListener(async () => {
  await StorageManager.initializeDefaults();
  await AlarmManager.initialize();
});

// --- Browser startup ---
chrome.runtime.onStartup.addListener(async () => {
  await AlarmManager.initialize();
});

// --- Alarm handler ---
chrome.alarms.onAlarm.addListener(async (alarm) => {
  // Ensure alarms are healthy
  await AlarmManager.ensureAlarms();

  if (alarm.name === ALARMS.MEET_CHECK) {
    await MeetingManager.checkUpcomingMeetings();
  } else if (alarm.name === ALARMS.AKASHI_CHECK) {
    await AkashiManager.checkAkashiStatus();
  }
});

// --- Message handler ---
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender)
    .then(sendResponse)
    .catch((err) => {
      console.error('[ServiceWorker] Message handler error:', err);
      sendResponse({ error: 'Internal error' });
    });
  return true; // Keep channel open for async response
});

async function handleMessage(message, sender) {
  switch (message.type) {
    // Content script pushes Akashi status — verify sender origin
    case MESSAGE_TYPES.AKASHI_STATUS_UPDATE: {
      if (!sender.tab || !sender.url) {
        throw new Error('AKASHI_STATUS_UPDATE requires content script sender');
      }
      const senderOrigin = new URL(sender.url).origin;
      const settings = await StorageManager.getSettings();
      const akashiOrigin = new URL(settings.akashiUrl || 'https://atnd.ak4.jp').origin;
      if (senderOrigin !== akashiOrigin) {
        console.warn('[ServiceWorker] Rejected AKASHI_STATUS_UPDATE from:', senderOrigin);
        throw new Error('Untrusted sender origin');
      }
      // Ignore data from pages loaded on a previous day
      if (message.pageLoadDate && message.pageLoadDate !== todayDateString()) {
        return { ok: true, ignored: 'stale page' };
      }
      await AkashiManager.handleStatusUpdate(message.status, null, message.hasClockOut);
      return { ok: true };
    }

    // Popup requests combined status
    case MESSAGE_TYPES.GET_STATUS: {
      const [settings, akashiStatus, events, skippedMeetings] = await Promise.all([
        StorageManager.getSettings(),
        StorageManager.getAkashiStatus(),
        StorageManager.getCalendarEvents(),
        StorageManager.getSkippedMeetings(),
      ]);
      return { settings, akashiStatus, events, skippedMeetings };
    }

    // Popup requests fresh calendar data
    case MESSAGE_TYPES.REFRESH_CALENDAR: {
      const events = await CalendarManager.refreshEvents();
      return { events };
    }

    // Popup requests upcoming events
    case MESSAGE_TYPES.REQUEST_UPCOMING_EVENTS: {
      const events = await StorageManager.getCalendarEvents();
      return { events };
    }

    // Settings
    case MESSAGE_TYPES.GET_SETTINGS: {
      const settings = await StorageManager.getSettings();
      return { settings };
    }

    case MESSAGE_TYPES.UPDATE_SETTINGS: {
      const updated = await StorageManager.updateSettings(message.settings);
      return { settings: updated };
    }

    // OAuth login
    case MESSAGE_TYPES.LOGIN: {
      const token = await CalendarManager.login();
      return { ok: true, token };
    }

    // Skip / unskip meeting
    case MESSAGE_TYPES.SKIP_MEETING: {
      await StorageManager.addSkippedMeeting(message.eventId);
      return { ok: true };
    }

    case MESSAGE_TYPES.UNSKIP_MEETING: {
      await StorageManager.removeSkippedMeeting(message.eventId);
      return { ok: true };
    }

    // Akashi status request (from popup)
    case MESSAGE_TYPES.REQUEST_AKASHI_STATUS: {
      const status = await StorageManager.getAkashiStatus();
      return { status };
    }

    default:
      return { error: 'Unknown message type' };
  }
}
