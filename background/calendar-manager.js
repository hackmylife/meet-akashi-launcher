import { CALENDAR } from '../shared/constants.js';
import { extractMeetUrl } from '../shared/utils.js';
import { StorageManager } from './storage-manager.js';

export class CalendarManager {
  /**
   * Interactive login — prompts the user to select a Google account and grant access.
   * Returns access token.
   */
  static async login() {
    const token = await new Promise((resolve, reject) => {
      chrome.identity.getAuthToken({ interactive: true }, (tok) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(tok);
        }
      });
    });
    return token;
  }

  /**
   * Get a valid access token silently (non-interactive).
   * Returns null if not available.
   */
  static async getToken() {
    try {
      const token = await new Promise((resolve, reject) => {
        chrome.identity.getAuthToken({ interactive: false }, (tok) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(tok);
          }
        });
      });
      return token || null;
    } catch {
      return null;
    }
  }

  /**
   * Remove the cached token so the next getAuthToken fetches a fresh one.
   */
  static async clearToken() {
    const token = await this.getToken();
    if (token) {
      await new Promise((resolve) => {
        chrome.identity.removeCachedAuthToken({ token }, resolve);
      });
    }
  }

  /**
   * Fetch upcoming events from Google Calendar API.
   * Returns normalized event objects on success, null on failure.
   */
  static async fetchUpcomingEvents() {
    let token = await this.getToken();
    if (!token) return null;

    // Fetch all of today's events (start of day to end of day)
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

    const params = new URLSearchParams({
      timeMin: startOfDay.toISOString(),
      timeMax: endOfDay.toISOString(),
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: '50',
    });

    const url = `${CALENDAR.BASE_URL}/calendars/primary/events?${params}`;

    let response;
    try {
      response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      console.error('[CalendarManager] Network error fetching calendar');
      return null;
    }

    // Handle 401 — token expired, clear and retry once
    if (response.status === 401) {
      await this.clearToken();
      token = await this.getToken();
      if (!token) return null;

      try {
        response = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch {
        return null;
      }
      if (!response.ok) return null;
    }

    if (!response.ok) {
      console.error('[CalendarManager] Calendar API error:', response.status);
      return null;
    }

    const data = await response.json();
    const items = data.items || [];

    return items
      .filter((e) => e.status !== 'cancelled' && e.start?.dateTime)
      .map((e) => {
        const meetUrl = extractMeetUrl(e);
        return {
          id: e.id,
          summary: e.summary || '(無題)',
          start: e.start?.dateTime || e.start?.date,
          end: e.end?.dateTime || e.end?.date,
          meetUrl,
        };
      });
  }

  /**
   * Fetch and cache events in storage.
   * Only updates cache on successful fetch; returns null on failure.
   */
  static async refreshEvents() {
    const events = await this.fetchUpcomingEvents();
    if (events !== null) {
      await StorageManager.setCalendarEvents(events);
    }
    return events;
  }
}
