# Meet Akashi Launcher - システム設計書

## 1. プロジェクト概要

Google MeetとAkashi勤怠管理を統合するChrome拡張機能（Manifest V3）

### 主要機能
- Google Calendarから次の予定を取得し、開始1分前にMeet URLを自動オープン
- Akashiの出勤状態を監視し、未打刻の場合はバッジと通知で警告
- ポップアップUIで予定と出勤ステータスを表示
- カスタマイズ可能な設定画面

---

## 2. ファイル構成

```
meet-akashi-launcher/
├── manifest.json                    # 拡張機能のマニフェスト（Manifest V3）
├── background/
│   ├── service-worker.js           # Service Worker（バックグラウンド処理）
│   ├── calendar-manager.js         # Google Calendar API管理
│   ├── meeting-manager.js          # 会議オープン処理
│   ├── akashi-manager.js           # Akashi状態管理
│   ├── alarm-manager.js            # chrome.alarms管理
│   └── storage-manager.js          # chrome.storage抽象化レイヤー
├── content/
│   └── content-akashi.js           # Akashi用Content Script
├── popup/
│   ├── popup.html                  # ポップアップUI
│   ├── popup.js                    # ポップアップロジック
│   └── popup.css                   # ポップアップスタイル
├── options/
│   ├── options.html                # 設定画面
│   ├── options.js                  # 設定ロジック
│   └── options.css                 # 設定スタイル
├── shared/
│   ├── constants.js                # 定数定義
│   ├── message-types.js            # メッセージタイプ定義
│   └── utils.js                    # 共通ユーティリティ
├── icons/
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   └── icon128.png
└── docs/
    └── ARCHITECTURE.md             # このドキュメント
```

---

## 3. manifest.json 設計

```json
{
  "manifest_version": 3,
  "name": "Meet Akashi Launcher",
  "version": "1.0.0",
  "description": "Google MeetとAkashi勤怠管理を統合するChrome拡張",

  "permissions": [
    "alarms",
    "notifications",
    "storage",
    "identity"
  ],

  "host_permissions": [
    "https://www.googleapis.com/*",
    "https://atnd.ak4.jp/*"
  ],

  "background": {
    "service_worker": "background/service-worker.js",
    "type": "module"
  },

  "content_scripts": [
    {
      "matches": ["https://atnd.ak4.jp/*"],
      "js": ["shared/constants.js", "shared/message-types.js", "content/content-akashi.js"],
      "run_at": "document_idle"
    }
  ],

  "action": {
    "default_popup": "popup/popup.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "32": "icons/icon32.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },

  "options_page": "options/options.html",

  "oauth2": {
    "client_id": "YOUR_CLIENT_ID.apps.googleusercontent.com",
    "scopes": [
      "https://www.googleapis.com/auth/calendar.readonly"
    ]
  },

  "icons": {
    "16": "icons/icon16.png",
    "32": "icons/icon32.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  }
}
```

### 主要なpermissions説明
- **alarms**: 定期的なチェック（Meet: 1分間隔、Akashi: 5分間隔）
- **notifications**: デスクトップ通知
- **storage**: 設定とキャッシュデータの保存
- **identity**: Google OAuth 2.0認証

---

## 4. Service Worker (background/service-worker.js) アーキテクチャ

### 4.1 全体構造

```javascript
// service-worker.js のエントリーポイント
import { AlarmManager } from './alarm-manager.js';
import { CalendarManager } from './calendar-manager.js';
import { MeetingManager } from './meeting-manager.js';
import { AkashiManager } from './akashi-manager.js';
import { StorageManager } from './storage-manager.js';
import { MESSAGE_TYPES } from '../shared/message-types.js';

// 初期化
chrome.runtime.onInstalled.addListener(async () => {
  await AlarmManager.initialize();
  await StorageManager.initializeDefaults();
});

// Service Workerの起動時
chrome.runtime.onStartup.addListener(async () => {
  await AlarmManager.initialize();
});

// Alarm処理
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'meetCheck') {
    await MeetingManager.checkUpcomingMeetings();
  } else if (alarm.name === 'akashiCheck') {
    await AkashiManager.checkAkashiStatus();
  }
});

// メッセージ処理
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender, sendResponse);
  return true; // 非同期レスポンスのため
});
```

### 4.2 chrome.alarms 設計

```javascript
class AlarmManager {
  static async initialize() {
    // Meet チェック: 1分間隔
    await chrome.alarms.create('meetCheck', {
      periodInMinutes: 1
    });

    // Akashi チェック: 5分間隔
    await chrome.alarms.create('akashiCheck', {
      periodInMinutes: 5
    });

    // 初回実行
    await MeetingManager.checkUpcomingMeetings();
    await AkashiManager.checkAkashiStatus();
  }
}
```

### 4.3 Google Calendar API 呼び出しフロー

```javascript
class CalendarManager {
  static async getAccessToken() {
    return new Promise((resolve, reject) => {
      chrome.identity.getAuthToken({ interactive: true }, (token) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(token);
        }
      });
    });
  }

  static async fetchUpcomingEvents() {
    const token = await this.getAccessToken();
    const now = new Date().toISOString();
    const maxTime = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();

    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?` +
      `timeMin=${now}&timeMax=${maxTime}&singleEvents=true&orderBy=startTime`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!response.ok) throw new Error('Calendar API error');
    const data = await response.json();
    return data.items || [];
  }

  static extractMeetUrl(event) {
    if (event.hangoutLink) return event.hangoutLink;

    const meetPattern = /https:\/\/meet\.google\.com\/[a-z-]+/i;

    if (event.description) {
      const match = event.description.match(meetPattern);
      if (match) return match[0];
    }
    if (event.location) {
      const match = event.location.match(meetPattern);
      if (match) return match[0];
    }
    return null;
  }
}
```

### 4.4 会議オープンロジック（重複排除含む）

```javascript
class MeetingManager {
  static openedMeetings = new Set();

  static async checkUpcomingMeetings() {
    const settings = await StorageManager.getSettings();
    if (!settings.autoOpenMeet) return;

    const events = await CalendarManager.fetchUpcomingEvents();
    const now = Date.now();
    const threshold = 60 * 1000; // 1分前

    for (const event of events) {
      const meetUrl = CalendarManager.extractMeetUrl(event);
      if (!meetUrl) continue;

      const startTime = new Date(event.start.dateTime || event.start.date).getTime();
      const timeUntilStart = startTime - now;

      // 1分前 ± 30秒の範囲
      if (timeUntilStart > 30000 && timeUntilStart <= threshold + 30000) {
        await this.openMeeting(event.id, meetUrl, event.summary);
      }
    }
  }

  static async openMeeting(eventId, meetUrl, title) {
    // 重複チェック（メモリ + ストレージ）
    if (this.openedMeetings.has(eventId)) return;
    const opened = await StorageManager.getOpenedMeetings();
    if (opened.includes(eventId)) {
      this.openedMeetings.add(eventId);
      return;
    }

    // 新しいウィンドウで開く
    await chrome.windows.create({ url: meetUrl, type: 'normal', focused: true });

    // 通知
    await chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: 'Meet opened',
      message: `"${title}" が開始されます`
    });

    // 記録
    this.openedMeetings.add(eventId);
    await StorageManager.addOpenedMeeting(eventId);
  }
}
```

### 4.5 Akashi ステータス管理

```javascript
class AkashiManager {
  static currentStatus = null;

  static async checkAkashiStatus() {
    const tabs = await chrome.tabs.query({ url: 'https://atnd.ak4.jp/*' });
    if (tabs.length === 0) {
      await this.updateBadge(null);
      return;
    }

    const response = await chrome.tabs.sendMessage(tabs[0].id, {
      type: MESSAGE_TYPES.REQUEST_AKASHI_STATUS
    });
    await this.updateStatus(response.status);
  }

  static async updateStatus(status) {
    const previousStatus = this.currentStatus;
    this.currentStatus = status;

    await StorageManager.setAkashiStatus(status);
    await this.updateBadge(status);

    if (status === 'NOT_CLOCKED_IN' && previousStatus !== 'NOT_CLOCKED_IN') {
      const settings = await StorageManager.getSettings();
      if (settings.notifyAkashi) {
        await chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icons/icon128.png',
          title: 'Akashi: 出勤未打刻',
          message: '出勤の打刻を忘れていませんか？',
          requireInteraction: true
        });
      }
    }
  }

  static async updateBadge(status) {
    if (status === 'NOT_CLOCKED_IN') {
      await chrome.action.setBadgeText({ text: '出' });
      await chrome.action.setBadgeBackgroundColor({ color: '#FF0000' });
    } else {
      await chrome.action.setBadgeText({ text: '' });
    }
  }
}
```

---

## 5. Content Script (content/content-akashi.js) 設計

### 5.1 DOM解析戦略

```javascript
class AkashiDetector {
  constructor() {
    this.status = null;
    this.init();
  }

  init() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.analyze());
    } else {
      this.analyze();
    }
    this.observeDOM();
  }

  analyze() {
    this.status = this.detectClockStatus();
    chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.AKASHI_STATUS_UPDATE,
      status: this.status
    });
  }

  detectClockStatus() {
    // 戦略1: ボタンテキストで判定
    const clockInButton = this.findElementByText('button', '出勤');
    const clockOutButton = this.findElementByText('button', '退勤');

    if (clockInButton && !clockInButton.disabled) return 'NOT_CLOCKED_IN';
    if (clockOutButton && !clockOutButton.disabled) return 'CLOCKED_IN';

    // 戦略2: ステータステキストで判定
    const statusText = this.findStatusText();
    if (statusText) {
      if (statusText.includes('出勤') || statusText.includes('勤務中')) return 'CLOCKED_IN';
      if (statusText.includes('未打刻')) return 'NOT_CLOCKED_IN';
    }

    // 戦略3: データ属性やクラス名で判定
    const statusIndicator = document.querySelector('[data-status]');
    if (statusIndicator) {
      const dataStatus = statusIndicator.getAttribute('data-status');
      if (dataStatus === 'in' || dataStatus === 'working') return 'CLOCKED_IN';
      if (dataStatus === 'out' || dataStatus === 'before') return 'NOT_CLOCKED_IN';
    }

    return 'UNKNOWN';
  }

  findElementByText(tagName, text) {
    const elements = document.querySelectorAll(tagName);
    for (const el of elements) {
      if (el.textContent.trim().includes(text)) return el;
    }
    return null;
  }

  findStatusText() {
    const selectors = ['.status', '.clock-status', '[class*="status"]', '#status'];
    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el) return el.textContent.trim();
    }
    return null;
  }

  observeDOM() {
    const observer = new MutationObserver(() => this.analyze());
    observer.observe(document.body, { childList: true, subtree: true });
  }
}

// メッセージリスナー
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === MESSAGE_TYPES.REQUEST_AKASHI_STATUS) {
    sendResponse({ status: detector.status });
  }
  return true;
});

const detector = new AkashiDetector();
```

---

## 6. メッセージパッシング アーキテクチャ

### 6.1 メッセージタイプ定義

```javascript
export const MESSAGE_TYPES = {
  AKASHI_STATUS_UPDATE: 'AKASHI_STATUS_UPDATE',
  REQUEST_AKASHI_STATUS: 'REQUEST_AKASHI_STATUS',
  REQUEST_UPCOMING_EVENTS: 'REQUEST_UPCOMING_EVENTS',
  REFRESH_CALENDAR: 'REFRESH_CALENDAR',
  GET_SETTINGS: 'GET_SETTINGS',
  UPDATE_SETTINGS: 'UPDATE_SETTINGS',
  GET_STATUS: 'GET_STATUS'
};
```

### 6.2 通信フロー

- **Content Script → Service Worker**: `chrome.runtime.sendMessage()`
- **Service Worker → Content Script**: `chrome.tabs.sendMessage(tabId, ...)`
- **Popup → Service Worker**: `chrome.runtime.sendMessage()`

---

## 7. データフロー図

```
┌─────────────────────────────────────────────────────────────┐
│                      Service Worker                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ AlarmManager │  │CalendarMgr   │  │ AkashiMgr    │     │
│  │  - meetCheck │  │- API call    │  │- Badge       │     │
│  │  - akashiCk  │  │- URL extract │  │- Notify      │     │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘     │
│         │                  │                  │              │
│         └──────────────────┴──────────────────┘              │
│                            ▲                                 │
│                            │                                 │
└────────────────────────────┼─────────────────────────────────┘
                             │
            ┌────────────────┼────────────────┐
            │                │                │
            ▼                ▼                ▼
    ┌───────────┐   ┌────────────┐   ┌──────────────┐
    │  Popup    │   │  Content   │   │ chrome.      │
    │  UI       │   │  Script    │   │ storage      │
    └───────────┘   └────────────┘   └──────────────┘
```

1. **AlarmManager** が定期的に `meetCheck` (1分) と `akashiCheck` (5分) をトリガー
2. **CalendarManager** がGoogle Calendar APIを呼び出し、予定を取得
3. **MeetingManager** が1分前の予定を検出し、Meet URLを新しいウィンドウで開く
4. **AkashiManager** がContent Scriptにステータスをリクエスト
5. **Content Script** がAkashiのDOMを解析し、出勤状態を返す
6. **AkashiManager** がバッジと通知を更新
7. **Popup** がService Workerにリクエストし、現在の状態を表示

---

## 8. chrome.storage スキーマ設計

### 8.1 storage.sync（ユーザー設定）

```javascript
{
  settings: {
    autoOpenMeet: true,          // Meet自動オープン有効/無効
    notifyAkashi: true,          // Akashi通知有効/無効
    meetOpenTiming: 60,          // Meet開始何秒前にオープン
    akashiCheckInterval: 5       // Akashiチェック間隔（分）
  }
}
```

### 8.2 storage.local（キャッシュ・状態）

```javascript
{
  calendarEvents: [...],           // カレンダーイベントキャッシュ
  calendarLastFetch: 1707389400000,
  akashiStatus: {
    status: 'NOT_CLOCKED_IN',      // 'NOT_CLOCKED_IN' | 'CLOCKED_IN' | 'UNKNOWN'
    lastCheck: 1707389400000,
    lastUpdate: 1707389400000
  },
  openedMeetings: ['event123'],    // 重複防止用イベントIDリスト
  openedMeetingsCleanup: 1707389400000
}
```

---

## 9. エラーハンドリング戦略

| エラーシナリオ | 対処方法 |
|---------------|---------|
| OAuth認証失敗 | トークンをクリアし、次回アクセス時に再認証を促す |
| Calendar API レート制限 | 指数バックオフで再試行（1分、2分、4分...） |
| Akashiタブが開いていない | バッジをクリアし、エラー通知は出さない |
| Content Script応答なし | タイムアウト（5秒）後にステータスをUNKNOWNに設定 |
| Service Worker停止 | chrome.alarmsで自動的に再起動・再初期化 |
| Network error | 次のalarmサイクルで自動的に再試行 |

---

## 10. セキュリティ考慮事項

- **OAuth 2.0トークン**: chrome.identity APIで安全に管理、必要時に都度取得
- **Content Script Isolation**: DOMの読み取りのみ、最小限の権限
- **CSP**: `script-src 'self'; object-src 'self'`

---

## 11. 実装順序

### Phase 1: 基盤構築
1. manifest.json / ファイル構造 / shared modules / StorageManager / AlarmManager

### Phase 2: Calendar統合
2. CalendarManager（OAuth認証） / MeetingManager / 重複排除 / 通知

### Phase 3: Akashi統合
3. Content Script（DOM解析） / AkashiManager / バッジ / 通知

### Phase 4: UI実装
4. Popup UI / Options UI / メッセージパッシング統合

### Phase 5: テスト・改善
5. エラーハンドリング強化 / パフォーマンス最適化 / テスト

---

**ドキュメントバージョン**: 1.0
**最終更新日**: 2026-02-08
**作成者**: Architect
