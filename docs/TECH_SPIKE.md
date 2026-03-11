# Meet Akashi Launcher - 技術調査結果（Tech Spike）

## 1. Google Calendar API統合

### 1.1 OAuth2認証フロー

**chrome.identity.getAuthToken()** を使用したOAuth2認証はChrome拡張に最適化されている。

#### manifest.json設定

```json
{
  "manifest_version": 3,
  "permissions": ["identity", "alarms", "storage", "notifications", "activeTab"],
  "host_permissions": [
    "https://www.googleapis.com/*",
    "https://atnd.ak4.jp/*"
  ],
  "oauth2": {
    "client_id": "YOUR_CLIENT_ID.apps.googleusercontent.com",
    "scopes": ["https://www.googleapis.com/auth/calendar.readonly"]
  },
  "background": { "service_worker": "background/service-worker.js", "type": "module" },
  "content_scripts": [{
    "matches": ["https://atnd.ak4.jp/*"],
    "js": ["content/content-akashi.js"],
    "run_at": "document_idle"
  }]
}
```

### 1.2 Google Cloud Consoleセットアップ手順

1. [Google Cloud Console](https://console.cloud.google.com/)で新規プロジェクト作成
2. Google Calendar APIを有効化
3. OAuth 2.0クライアントID作成（**Application type: Chrome Extension**）
4. OAuth同意画面 → Scopes: `calendar.readonly`

### 1.3 認証とAPI呼び出し

```javascript
async function getAuthToken() {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive: true }, (token) => {
      if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
      else resolve(token);
    });
  });
}

async function getTodaysMeetings() {
  const token = await getAuthToken();
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

  const params = new URLSearchParams({
    timeMin: startOfDay.toISOString(),
    timeMax: endOfDay.toISOString(),
    singleEvents: 'true',
    orderBy: 'startTime'
  });

  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
    { headers: { 'Authorization': `Bearer ${token}` } }
  );

  if (!response.ok) throw new Error(`Calendar API error: ${response.status}`);
  const data = await response.json();
  return data.items || [];
}
```

---

## 2. Akashi Content Script実装

### 2.1 DOM解析戦略

Akashi（atnd.ak4.jp）はSPAと推測。複数のセレクターパターンでフォールバック。

```javascript
class AkashiDetector {
  getStatusSelectors() {
    return [
      'button[class*="clock-in"]', 'button[class*="clock-out"]',
      '.attendance-status', '[data-status]', '.work-status',
      '.status-badge', 'td[class*="status"]', '.today-status'
    ];
  }

  detectStatus() {
    for (const selector of this.getStatusSelectors()) {
      const element = document.querySelector(selector);
      if (!element) continue;

      const text = element.textContent.toLowerCase();
      const dataStatus = element.getAttribute('data-status');

      if (text.includes('退勤') || text.includes('出勤中') ||
          dataStatus === 'working' || dataStatus === 'clocked-in') {
        return 'CLOCKED_IN';
      }
      if (text.includes('出勤') || text.includes('clock in') ||
          dataStatus === 'not-working' || dataStatus === 'clocked-out') {
        return 'CLOCKED_OUT';
      }
    }
    return 'UNKNOWN';
  }

  startObserving() {
    this.observer = new MutationObserver(() => {
      const newStatus = this.detectStatus();
      if (newStatus !== this.currentStatus) {
        this.currentStatus = newStatus;
        chrome.runtime.sendMessage({
          type: 'AKASHI_STATUS_CHANGED',
          status: newStatus,
          timestamp: Date.now()
        });
      }
    });
    this.observer.observe(document.body, {
      childList: true, subtree: true,
      attributes: true, attributeFilter: ['class', 'data-status']
    });
  }
}
```

### 2.2 Service Workerとの通信

```javascript
// Content Script → Service Worker
chrome.runtime.sendMessage({ type: 'AKASHI_STATUS_CHANGED', status: 'CLOCKED_IN' });

// Service Worker → Content Script
const tabs = await chrome.tabs.query({ url: 'https://atnd.ak4.jp/*' });
const response = await chrome.tabs.sendMessage(tabs[0].id, { type: 'GET_AKASHI_STATUS' });
```

---

## 3. Chrome Alarms & Service Worker

### 3.1 Service Workerライフサイクル

- Service Workerは**30秒のアイドル後に停止**する可能性あり
- **chrome.alarms**で確実に定期実行
- **chrome.storage**に状態を永続化
- イベントリスナーは**トップレベルに登録**必須

### 3.2 定期実行パターン

```javascript
chrome.runtime.onInstalled.addListener(async () => {
  await chrome.alarms.clearAll();
  chrome.alarms.create('checkCalendar', { delayInMinutes: 1, periodInMinutes: 5 });
  chrome.alarms.create('checkMeetingStart', { delayInMinutes: 1, periodInMinutes: 1 });
});

chrome.runtime.onStartup.addListener(async () => {
  const alarms = await chrome.alarms.getAll();
  if (!alarms.find(a => a.name === 'checkCalendar')) {
    chrome.alarms.create('checkCalendar', { delayInMinutes: 1, periodInMinutes: 5 });
  }
  if (!alarms.find(a => a.name === 'checkMeetingStart')) {
    chrome.alarms.create('checkMeetingStart', { delayInMinutes: 1, periodInMinutes: 1 });
  }
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'checkCalendar') await handleCalendarCheck();
  if (alarm.name === 'checkMeetingStart') await handleMeetingStartCheck();
});
```

### 3.3 ストレージヘルパー

```javascript
const storage = {
  async set(key, value) { await chrome.storage.local.set({ [key]: value }); },
  async get(key, defaultValue = null) {
    const result = await chrome.storage.local.get(key);
    return result[key] !== undefined ? result[key] : defaultValue;
  },
  async getMultiple(keys) { return await chrome.storage.local.get(keys); },
  onChange(callback) {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'local') callback(changes);
    });
  }
};
```

---

## 4. Chrome Action Badge API

### 4.1 バッジ・アイコン動的変更

```javascript
async function updateBadge(status) {
  switch (status) {
    case 'CLOCKED_IN':
      await chrome.action.setBadgeText({ text: '' });
      break;
    case 'CLOCKED_OUT':
      await chrome.action.setBadgeText({ text: '出' });
      await chrome.action.setBadgeBackgroundColor({ color: '#F44336' });
      await chrome.action.setTitle({ title: 'AKASHI: 未出勤' });
      break;
    default:
      await chrome.action.setBadgeText({ text: '' });
  }
}
```

### 4.2 アイコンサイズ

- 16x16px（favicon）/ 32x32px（taskbar）/ 48x48px（管理ページ）/ 128x128px（Web Store）
- PNG形式、透過対応、正方形

---

## 5. Chrome Notifications API

### 5.1 通知作成

```javascript
async function sendClockInReminder() {
  await chrome.notifications.create(`clock-in-${Date.now()}`, {
    type: 'basic',
    iconUrl: 'icons/icon128.png',
    title: '出勤打刻のリマインダー',
    message: 'AKASHIに出勤打刻していますか？',
    buttons: [{ title: 'AKASHIを開く' }, { title: '後で' }],
    priority: 2,
    requireInteraction: true
  });
}
```

### 5.2 イベントハンドリング

```javascript
chrome.notifications.onClicked.addListener((notificationId) => {
  if (notificationId.startsWith('clock-in-')) openAkashiPage();
  chrome.notifications.clear(notificationId);
});

chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
  if (notificationId.startsWith('clock-in-') && buttonIndex === 0) openAkashiPage();
  chrome.notifications.clear(notificationId);
});
```

---

## 6. Chrome Windows API

### 6.1 新しいウィンドウで開く

```javascript
async function openAkashiPage() {
  const existingTabs = await chrome.tabs.query({ url: 'https://atnd.ak4.jp/*' });
  if (existingTabs.length > 0) {
    await chrome.tabs.update(existingTabs[0].id, { active: true });
    await chrome.windows.update(existingTabs[0].windowId, { focused: true });
  } else {
    await chrome.windows.create({
      url: 'https://atnd.ak4.jp/',
      type: 'normal', focused: true, width: 1200, height: 800
    });
  }
}

async function openMeetUrl(meetUrl) {
  await chrome.windows.create({
    url: meetUrl,
    type: 'normal', focused: true
  });
}
```

---

## 7. 開発環境

### 7.1 拡張機能のロード手順

1. `chrome://extensions` → デベロッパーモードON
2. 「パッケージ化されていない拡張機能を読み込む」
3. プロジェクトのルートフォルダを選択

### 7.2 デバッグ方法

| 対象 | 方法 |
|------|------|
| Service Worker | chrome://extensions → 拡張のService Workerリンク → DevTools |
| Content Script | 対象ページでF12 → Console/Sources |
| Popup | ポップアップ上で右クリック → 検証 |

### 7.3 変更の反映

- **manifest.json / service-worker.js**: chrome://extensions でリロード
- **content-script.js**: リロード後、対象ページもリロード
- **popup**: ポップアップを閉じて再度開く

---

## 8. リスクと対策

| リスク | 対策 |
|--------|------|
| AKASHIページ構造変更 | 複数セレクターパターン + フォールバック |
| Service Worker停止 | chrome.alarms + chrome.storage永続化 |
| 認証トークン期限切れ | removeCachedAuthToken + リトライ（最大3回） |
| 通知スパム | notifiedMeetings Setで重複防止 |

### トークンリトライ実装

```javascript
async function getAuthTokenWithRetry(maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await getAuthToken();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await chrome.identity.removeCachedAuthToken({ token: error.token });
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
}
```

---

## 9. セキュリティ

- **最小権限の原則**: identity, alarms, storage, notificationsのみ
- **APIトークン**: chrome.identity APIで安全に管理（自動暗号化）
- **ユーザーデータ**: ローカルストレージのみ、外部送信なし
- **host_permissions**: googleapis.com と atnd.ak4.jp のみ

---

## 10. 技術的実現性まとめ

| 機能 | API | 実現性 |
|------|-----|--------|
| Google Calendar連携 | chrome.identity.getAuthToken() | ✅ 高 |
| Akashi状態検出 | Content Script + MutationObserver | ✅ 高 |
| 定期実行 | chrome.alarms | ✅ 高 |
| 通知 | chrome.notifications | ✅ 高 |
| バッジ表示 | chrome.action.setBadgeText() | ✅ 高 |
| Meet自動オープン | chrome.windows.create() | ✅ 高 |
| 状態永続化 | chrome.storage | ✅ 高 |

**推奨開発期間**: 4〜5週間
**主要な技術的課題**: AKASHIページの実際のDOM構造把握（実装開始後に調査が必要）

---

## Sources

- [chrome.identity API](https://developer.chrome.com/docs/extensions/reference/api/identity)
- [chrome.alarms API](https://developer.chrome.com/docs/extensions/reference/api/alarms)
- [chrome.action API](https://developer.chrome.com/docs/extensions/reference/api/action)
- [chrome.notifications API](https://developer.chrome.com/docs/extensions/reference/api/notifications)
- [chrome.windows API](https://developer.chrome.com/docs/extensions/reference/api/windows)
- [chrome.storage API](https://developer.chrome.com/docs/extensions/reference/api/storage)
- [Google Calendar API v3](https://developers.google.com/workspace/calendar/api/v3/reference/events/list)
- [Service Worker Lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle)
- [Message Passing](https://developer.chrome.com/docs/extensions/develop/concepts/messaging)
- [OAuth 2.0 for Chrome Extensions](https://developer.chrome.com/docs/extensions/how-to/integrate/oauth)

---

**ドキュメントバージョン**: 1.0
**最終更新日**: 2026-02-08
**作成者**: Developer
