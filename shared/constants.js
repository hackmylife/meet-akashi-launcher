// Alarm names
export const ALARMS = {
  MEET_CHECK: 'meetCheck',
  AKASHI_CHECK: 'akashiCheck',
};

// Alarm intervals (minutes)
export const INTERVALS = {
  MEET_CHECK: 1,
  AKASHI_CHECK: 5,
};

// Akashi attendance status
export const AKASHI_STATUS = {
  CLOCKED_IN: 'CLOCKED_IN',
  CLOCKED_OUT: 'CLOCKED_OUT',
  NOT_CLOCKED_IN: 'NOT_CLOCKED_IN',
  NOT_CLOCKED_OUT: 'NOT_CLOCKED_OUT',
  UNKNOWN: 'UNKNOWN',
};

// Badge config
export const BADGE = {
  NOT_CLOCKED_IN: { text: '出', color: '#FF0000' },
  NOT_CLOCKED_OUT: { text: '退', color: '#FF9800' },
  NOT_CLOCKED_OUT_URGENT: { text: '退', color: '#FF0000' },
  CLEAR: { text: '', color: '#000000' },
};

// Meeting auto-open window (milliseconds)
export const MEET_TIMING = {
  BEFORE_START: 60 * 1000,  // 1分前
  TOLERANCE: 30 * 1000,     // ±30秒
  LATE_LIMIT: 5 * 60 * 1000, // 5分後まで
};

// Calendar API
export const CALENDAR = {
  BASE_URL: 'https://www.googleapis.com/calendar/v3',
};

// Storage keys
export const STORAGE_KEYS = {
  SETTINGS: 'settings',
  CALENDAR_EVENTS: 'calendarEvents',
  CALENDAR_LAST_FETCH: 'calendarLastFetch',
  AKASHI_STATUS: 'akashiStatus',
  OPENED_MEETINGS: 'openedMeetings',
  OPENED_MEETINGS_CLEANUP: 'openedMeetingsCleanup',
  NOTIFICATION_SENT_DATE: 'notificationSentDate',
  CLOCKOUT_NOTIFICATION_SENT_DATE: 'clockoutNotificationSentDate',
  DAILY_ATTENDANCE: 'dailyAttendance',
  SKIPPED_MEETINGS: 'skippedMeetings',
};

// Default settings
export const DEFAULT_SETTINGS = {
  enableAkashi: true,
  autoOpenMeet: true,
  notifyAkashi: true,
  meetOpenTiming: 60,       // seconds before meeting
  meetWindowWidth: 1280,
  meetWindowHeight: 800,
  akashiCheckInterval: 5,   // minutes
  akashiUrl: 'https://atnd.ak4.jp',
};
