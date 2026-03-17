import { CALENDAR } from '../shared/constants.js';
import { OAUTH_CLIENT_ID } from '../shared/config.js';
import { extractMeetUrl } from '../shared/utils.js';
import { StorageManager } from './storage-manager.js';
const REDIRECT_URI = `https://${chrome.runtime.id}.chromiumapp.org/`;
const SCOPES = 'https://www.googleapis.com/auth/calendar.readonly';
const TOKEN_KEY = 'oauth_access_token';
const TOKEN_EXPIRY_KEY = 'oauth_token_expiry';
const REFRESH_TOKEN_KEY = 'oauth_refresh_token';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';

// --- PKCE helpers ---

function base64UrlEncode(buffer) {
  let str = '';
  for (const byte of buffer) {
    str += String.fromCharCode(byte);
  }
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function generateCodeVerifier() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return base64UrlEncode(array);
}

async function generateCodeChallenge(verifier) {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(new Uint8Array(hash));
}

export class CalendarManager {
  /**
   * Launch interactive OAuth2 Authorization Code flow with PKCE.
   * Returns access token. Also stores refresh token for long-lived sessions.
   */
  static async login() {
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await generateCodeChallenge(codeVerifier);

    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.set('client_id', OAUTH_CLIENT_ID);
    authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', SCOPES);
    authUrl.searchParams.set('access_type', 'offline');
    authUrl.searchParams.set('prompt', 'consent');
    authUrl.searchParams.set('code_challenge', codeChallenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');

    const responseUrl = await new Promise((resolve, reject) => {
      chrome.identity.launchWebAuthFlow(
        { url: authUrl.toString(), interactive: true },
        (redirectUrl) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(redirectUrl);
          }
        }
      );
    });

    // Authorization code is in query params (not hash like implicit flow)
    const url = new URL(responseUrl);
    const code = url.searchParams.get('code');
    if (!code) throw new Error('No authorization code in response');

    // Exchange code for access + refresh tokens
    const tokens = await this.exchangeCode(code, codeVerifier);
    return tokens.access_token;
  }

  /**
   * Exchange authorization code for tokens at Google's token endpoint.
   */
  static async exchangeCode(code, codeVerifier) {
    const params = {
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
      client_id: OAUTH_CLIENT_ID,
      code_verifier: codeVerifier,
    };
    const response = await fetch(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(params).toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[CalendarManager] Token exchange failed:', errorText);
      throw new Error(`Token exchange failed: ${response.status}`);
    }

    const data = await response.json();
    const expiresIn = data.expires_in || 3600;

    const storageData = {
      [TOKEN_KEY]: data.access_token,
      [TOKEN_EXPIRY_KEY]: Date.now() + expiresIn * 1000,
    };
    if (data.refresh_token) {
      storageData[REFRESH_TOKEN_KEY] = data.refresh_token;
    }
    await chrome.storage.local.set(storageData);

    console.log('[CalendarManager] Token exchange succeeded, refresh_token:', !!data.refresh_token);
    return data;
  }

  /**
   * Get cached access token (non-interactive).
   * Returns null if not available or expired.
   */
  static async getCachedToken() {
    const data = await chrome.storage.local.get([TOKEN_KEY, TOKEN_EXPIRY_KEY]);
    const token = data[TOKEN_KEY];
    const expiry = data[TOKEN_EXPIRY_KEY] || 0;

    if (token && Date.now() < expiry) {
      return token;
    }
    return null;
  }

  /**
   * Silently refresh the access token.
   * 1) Try refresh_token (reliable, works indefinitely)
   * 2) Fallback: implicit flow silent refresh (works if Google session cookies alive)
   */
  static async silentRefresh() {
    // 1. Try refresh token (most reliable — works even after days)
    const { [REFRESH_TOKEN_KEY]: refreshToken } = await chrome.storage.local.get(REFRESH_TOKEN_KEY);

    if (refreshToken) {
      try {
        const params = {
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          client_id: OAUTH_CLIENT_ID,
        };
        const response = await fetch(TOKEN_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams(params).toString(),
        });

        if (response.ok) {
          const data = await response.json();
          const expiresIn = data.expires_in || 3600;
          await chrome.storage.local.set({
            [TOKEN_KEY]: data.access_token,
            [TOKEN_EXPIRY_KEY]: Date.now() + expiresIn * 1000,
          });
          console.log('[CalendarManager] Token refresh via refresh_token succeeded');
          return data.access_token;
        }

        console.warn('[CalendarManager] Refresh token rejected:', response.status);
        // Refresh token might be revoked — clear it so we don't keep retrying
        await chrome.storage.local.remove(REFRESH_TOKEN_KEY);
      } catch (e) {
        console.error('[CalendarManager] Refresh token error:', e);
      }
    }

    // 2. Fallback: implicit flow silent refresh (session-cookie based)
    try {
      const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      authUrl.searchParams.set('client_id', OAUTH_CLIENT_ID);
      authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
      authUrl.searchParams.set('response_type', 'token');
      authUrl.searchParams.set('scope', SCOPES);

      const responseUrl = await new Promise((resolve, reject) => {
        chrome.identity.launchWebAuthFlow(
          { url: authUrl.toString(), interactive: false },
          (redirectUrl) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve(redirectUrl);
            }
          }
        );
      });

      const hashParams = new URLSearchParams(new URL(responseUrl).hash.substring(1));
      const token = hashParams.get('access_token');
      const expiresIn = parseInt(hashParams.get('expires_in'), 10) || 3600;

      if (!token) return null;

      await chrome.storage.local.set({
        [TOKEN_KEY]: token,
        [TOKEN_EXPIRY_KEY]: Date.now() + expiresIn * 1000,
      });

      console.log('[CalendarManager] Silent refresh via session succeeded');
      return token;
    } catch {
      console.log('[CalendarManager] All refresh methods failed — re-login needed');
      return null;
    }
  }

  /**
   * Clear cached access token (keeps refresh token).
   */
  static async clearToken() {
    await chrome.storage.local.remove([TOKEN_KEY, TOKEN_EXPIRY_KEY]);
  }

  /**
   * Fetch upcoming events from Google Calendar API.
   * Returns normalized event objects on success, null on failure.
   */
  static async fetchUpcomingEvents() {
    let token = await this.getCachedToken();
    if (!token) {
      // Token expired or missing — try silent refresh
      token = await this.silentRefresh();
      if (!token) return null;
    }

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

    // Handle 401 — token expired mid-flight, try refresh once
    if (response.status === 401) {
      await this.clearToken();
      token = await this.silentRefresh();
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
