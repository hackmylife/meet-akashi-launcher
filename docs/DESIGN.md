# Meet Akashi Launcher - UI/UXデザイン仕様書

## 1. デザイン原則

### コンセプト
- **シンプル**: 必要な情報を最小限のUI要素で表示
- **日本語ファースト**: 日本語UIでの可読性を最優先
- **Google Material風**: Chrome拡張として統一感のあるデザイン
- **アクセシブル**: WCAG 2.1 AAレベル準拠

---

## 2. カラーパレット

```css
:root {
  /* プライマリー */
  --primary-color: #4285f4;
  --primary-hover: #3367d6;
  --primary-light: #e8f0fe;

  /* ステータス */
  --success-color: #34a853;
  --success-light: #e6f4ea;
  --warning-color: #fbbc04;
  --warning-light: #fef7e0;
  --danger-color: #ea4335;
  --danger-light: #fce8e6;

  /* テキスト */
  --text-primary: #202124;
  --text-secondary: #5f6368;
  --text-disabled: #9aa0a6;

  /* 背景・ボーダー */
  --border-color: #dadce0;
  --bg-primary: #ffffff;
  --bg-secondary: #f8f9fa;
  --bg-hover: #f1f3f4;
}
```

---

## 3. タイポグラフィ

```css
--font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans JP",
               "Hiragino Sans", "Hiragino Kaku Gothic ProN", Roboto,
               "Helvetica Neue", Arial, sans-serif;

--font-size-xs: 11px;
--font-size-sm: 12px;
--font-size-base: 14px;
--font-size-lg: 16px;
--font-size-xl: 20px;
--font-size-2xl: 24px;

--font-weight-normal: 400;
--font-weight-medium: 500;
--font-weight-semibold: 600;
--font-weight-bold: 700;
```

---

## 4. スペーシング

```css
--spacing-xs: 4px;
--spacing-sm: 8px;
--spacing-md: 12px;
--spacing-lg: 16px;
--spacing-xl: 24px;
--spacing-2xl: 32px;
```

---

## 5. トランジション

```css
--transition-fast: 150ms ease-in-out;
--transition-base: 250ms ease-in-out;
--transition-slow: 350ms ease-in-out;
```

---

## 6. ポップアップUI（popup.html）

### サイズ
- 幅: 360px（固定）
- 最大高さ: 500px（スクロール可能）

### レイアウト構造

```
┌─────────────────────────────────┐
│ Header（48px）                   │
│  [Logo] Meet Akashi Launcher     │
├─────────────────────────────────┤
│ 出勤ステータスカード             │
│  ✓ 出勤済み / ⚠️ 未出勤         │
├─────────────────────────────────┤
│ セクションヘッダー「今日の会議」 │
│                                 │
│ ┌─────────────────────────────┐│
│ │ 09:00-10:00 朝会（過去）    ││
│ └─────────────────────────────┘│
│ ┌─────────────────────────────┐│
│ │ 14:00-15:00 打ち合わせ      ││
│ │ [次の会議] [参加する]       ││
│ └─────────────────────────────┘│
│ ┌─────────────────────────────┐│
│ │ 16:00-17:00 レビュー        ││
│ │             [参加する]       ││
│ └─────────────────────────────┘│
├─────────────────────────────────┤
│ Footer [⚙️ 設定]               │
└─────────────────────────────────┘
```

### ヘッダー
```css
.header {
  background: linear-gradient(135deg, var(--primary-color), #5a9aff);
  color: white;
  padding: var(--spacing-lg);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}
```

### 出勤ステータスカード

**出勤済み**
```css
.status-success {
  background-color: var(--success-light);
  border-left: 4px solid var(--success-color);
}
```

**未出勤**
```css
.status-danger {
  background-color: var(--danger-light);
  border-left: 4px solid var(--danger-color);
}
```

### 会議カード

**通常**
```css
.meeting-card {
  margin: 8px 16px;
  padding: 12px;
  background-color: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
}
.meeting-card:hover {
  background-color: var(--bg-hover);
}
```

**次の会議（ハイライト）**
```css
.meeting-next {
  border: 2px solid var(--primary-color);
  background-color: var(--primary-light);
  box-shadow: 0 2px 4px rgba(66,133,244,0.1);
}
```

**過去の会議**
```css
.meeting-past {
  background-color: var(--bg-secondary);
  opacity: 0.6;
}
```

### 会議がない場合
```html
<div class="empty-state">
  <div class="empty-icon">📅</div>
  <div class="empty-text">今日の会議はありません</div>
</div>
```

---

## 7. popup.html モックアップ

```html
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Meet Akashi Launcher</title>
  <link rel="stylesheet" href="popup.css">
</head>
<body>
  <header class="header">
    <div class="header-content">
      <img src="icons/icon-48.png" alt="Logo" class="header-logo">
      <h1 class="header-title">Meet Akashi Launcher</h1>
    </div>
  </header>

  <main class="main-content">
    <!-- 出勤ステータス -->
    <section class="status-section status-success" id="attendanceStatus">
      <div class="status-icon">✓</div>
      <div class="status-content">
        <div class="status-title">出勤済み</div>
        <div class="status-subtitle">今日も一日頑張りましょう！</div>
      </div>
    </section>

    <!-- 今日の会議 -->
    <section class="meetings-section">
      <div class="section-header">
        <h2 class="section-title">今日の会議</h2>
      </div>
      <div class="meetings-list" id="meetingsList">
        <div class="meeting-card meeting-past">
          <div class="meeting-time">09:00 - 10:00</div>
          <div class="meeting-title">朝会</div>
        </div>
        <div class="meeting-card meeting-next">
          <span class="meeting-badge">次の会議</span>
          <div class="meeting-time">14:00 - 15:00</div>
          <div class="meeting-title">クライアント打ち合わせ</div>
          <button class="btn btn-primary btn-sm">参加する</button>
        </div>
        <div class="meeting-card">
          <div class="meeting-time">16:00 - 17:00</div>
          <div class="meeting-title">週次レビューミーティング</div>
          <button class="btn btn-primary btn-sm">参加する</button>
        </div>
      </div>
    </section>
  </main>

  <footer class="footer">
    <a href="options.html" class="footer-link" target="_blank">
      <span class="footer-icon">⚙️</span> 設定
    </a>
  </footer>

  <script src="popup.js"></script>
</body>
</html>
```

---

## 8. popup.css

```css
* { margin: 0; padding: 0; box-sizing: border-box; }

body {
  width: 360px;
  max-height: 500px;
  font-family: var(--font-family);
  font-size: 14px;
  color: var(--text-primary);
  background-color: var(--bg-primary);
  overflow-y: auto;
}

/* ヘッダー */
.header {
  background: linear-gradient(135deg, #4285f4, #5a9aff);
  color: white;
  padding: 16px;
}
.header-content { display: flex; align-items: center; gap: 12px; }
.header-logo { width: 32px; height: 32px; border-radius: 6px; }
.header-title { font-size: 16px; font-weight: 600; }

/* ステータス */
.status-section {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  margin: 16px;
  border-radius: 8px;
  border-left: 4px solid;
}
.status-success { background-color: #e6f4ea; border-left-color: #34a853; }
.status-danger { background-color: #fce8e6; border-left-color: #ea4335; }
.status-icon { font-size: 24px; }
.status-title { font-size: 14px; font-weight: 600; margin-bottom: 4px; }
.status-subtitle { font-size: 12px; color: #5f6368; }

/* 会議セクション */
.section-header { padding: 12px 16px 8px; }
.section-title {
  font-size: 12px;
  font-weight: 600;
  color: #5f6368;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* 会議カード */
.meetings-list { display: flex; flex-direction: column; gap: 8px; padding: 0 16px; }
.meeting-card {
  position: relative;
  padding: 12px;
  border: 1px solid #dadce0;
  border-radius: 8px;
  transition: background-color 150ms ease-in-out;
}
.meeting-card:hover { background-color: #f1f3f4; }
.meeting-next {
  border: 2px solid #4285f4;
  background-color: #e8f0fe;
}
.meeting-past { background-color: #f8f9fa; opacity: 0.6; }
.meeting-badge {
  position: absolute;
  top: 8px;
  right: 8px;
  padding: 2px 8px;
  background-color: #4285f4;
  color: white;
  font-size: 11px;
  border-radius: 12px;
}
.meeting-time { font-size: 12px; font-weight: 500; color: #5f6368; margin-bottom: 4px; }
.meeting-title { font-size: 14px; font-weight: 500; margin-bottom: 8px; }

/* ボタン */
.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 150ms ease-in-out;
}
.btn-primary { background-color: #4285f4; color: white; }
.btn-primary:hover { background-color: #3367d6; }
.btn-sm { padding: 4px 12px; font-size: 12px; }
.btn-danger { background-color: #ea4335; color: white; }

/* フッター */
.footer {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 8px 16px;
  background-color: #f8f9fa;
  border-top: 1px solid #dadce0;
  text-align: right;
}
.footer-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: #4285f4;
  text-decoration: none;
  font-size: 12px;
}

/* 空状態 */
.empty-state { text-align: center; padding: 24px 16px; }
.empty-icon { font-size: 48px; margin-bottom: 12px; }
.empty-text { font-size: 14px; color: #5f6368; }

/* スクロールバー */
body::-webkit-scrollbar { width: 8px; }
body::-webkit-scrollbar-track { background: #f8f9fa; }
body::-webkit-scrollbar-thumb { background: #dadce0; border-radius: 4px; }
```

---

## 9. 設定画面（options.html）

### サイズ
- 幅: 800px（最大700pxコンテナ）
- 高さ: 600px

### レイアウト構造

```
┌────────────────────────────────────────────┐
│ ヘッダー（80px）                           │
│ Meet Akashi Launcher - 設定                 │
├────────────────────────────────────────────┤
│  ┌──────────────────────────────────────┐ │
│  │ Googleアカウント                      │ │
│  │ [接続済み] account@example.com        │ │
│  │                          [切断する]  │ │
│  └──────────────────────────────────────┘ │
│  ┌──────────────────────────────────────┐ │
│  │ Akashi設定                            │ │
│  │ Akashi URL:                           │ │
│  │ [https://example.akashi.jp]           │ │
│  └──────────────────────────────────────┘ │
│  ┌──────────────────────────────────────┐ │
│  │ 通知設定                              │ │
│  │ [✓] 出勤リマインド通知を有効にする    │ │
│  │ [✓] 会議開始通知を有効にする          │ │
│  │ 会議開始 [1] 分前に通知               │ │
│  └──────────────────────────────────────┘ │
│                          [保存する] ボタン │
└────────────────────────────────────────────┘
```

### options.html モックアップ

```html
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <title>設定 - Meet Akashi Launcher</title>
  <link rel="stylesheet" href="options.css">
</head>
<body>
  <header class="options-header">
    <div class="container">
      <h1 class="options-title">Meet Akashi Launcher - 設定</h1>
    </div>
  </header>

  <main class="options-main">
    <div class="container">
      <!-- Googleアカウント -->
      <section class="settings-card">
        <h2 class="settings-title">Googleアカウント</h2>
        <div class="account-info">
          <div class="account-status">
            <span class="status-badge status-badge-success">接続済み</span>
            <span class="account-email">example@example.com</span>
          </div>
          <button class="btn btn-secondary">切断する</button>
        </div>
      </section>

      <!-- Akashi設定 -->
      <section class="settings-card">
        <h2 class="settings-title">Akashi設定</h2>
        <div class="form-group">
          <label for="akashiUrl" class="form-label">Akashi URL</label>
          <input type="url" id="akashiUrl" class="form-input"
                 placeholder="https://example.atnd.ak4.jp">
          <div class="form-hint">あなたの会社のAkashi URLを入力してください</div>
        </div>
      </section>

      <!-- 通知設定 -->
      <section class="settings-card">
        <h2 class="settings-title">通知設定</h2>
        <div class="form-group">
          <label class="checkbox-label">
            <input type="checkbox" id="attendanceNotification" checked>
            <span>出勤リマインド通知を有効にする</span>
          </label>
        </div>
        <div class="form-group">
          <label class="checkbox-label">
            <input type="checkbox" id="meetingNotification" checked>
            <span>会議開始通知を有効にする</span>
          </label>
        </div>
        <div class="form-group">
          <label class="form-label">会議開始通知のタイミング</label>
          <div class="input-group">
            <span>会議開始</span>
            <input type="number" id="notificationTiming" class="form-input form-input-sm"
                   value="1" min="1" max="30">
            <span>分前に通知</span>
          </div>
        </div>
      </section>

      <div class="actions">
        <button class="btn btn-primary btn-lg" id="saveBtn">保存する</button>
      </div>
    </div>
  </main>

  <script src="options.js"></script>
</body>
</html>
```

---

## 10. アイコンデザイン仕様

### 通常アイコン（128x128px）
- 背景: 草原グラデーション (#7cb342 → #558b2f)
- メイン要素: 茶色の木製の柵 + ビデオカメラアイコン（青）
- スタイル: フラットデザイン、丸みのあるフレンドリーな印象

### 未出勤バッジ付きアイコン
- 通常アイコン + 右上に赤バッジ
- バッジ: 円形、直径40px、背景色 #ea4335、白抜き文字「出」

### アイコンサイズ
- 16x16px（タブバー）
- 32x32px（小）
- 48x48px（中）
- 128x128px（Chrome Web Store）

---

## 11. デスクトップ通知デザイン

### 出勤リマインド通知
```
┌─────────────────────────────────┐
│ [アイコン] Meet Akashi Launcher  │
│ 出勤打刻のリマインド            │
│ Akashiで出勤打刻をしましょう    │
│ [今すぐ打刻]  [後で]            │
└─────────────────────────────────┘
```

### 会議開始通知
```
┌─────────────────────────────────┐
│ [アイコン] Meet Akashi Launcher  │
│ もうすぐ会議が始まります        │
│ チームミーティング 10:00-11:00  │
│ [参加する]  [閉じる]            │
└─────────────────────────────────┘
```

---

## 12. アクセシビリティ

- キーボード操作: Tab移動、Enter実行、Escapeでクローズ
- フォーカスインジケーター: `outline: 2px solid var(--primary-color)`
- ARIA属性: `role="button"`, `aria-label`, `aria-live="polite"`
- コントラスト比: テキスト/背景 4.5:1以上

---

## 13. デザイントークン一覧

```json
{
  "colors": {
    "primary": "#4285f4",
    "primaryHover": "#3367d6",
    "primaryLight": "#e8f0fe",
    "success": "#34a853",
    "successLight": "#e6f4ea",
    "warning": "#fbbc04",
    "warningLight": "#fef7e0",
    "danger": "#ea4335",
    "dangerLight": "#fce8e6",
    "textPrimary": "#202124",
    "textSecondary": "#5f6368",
    "textDisabled": "#9aa0a6",
    "border": "#dadce0",
    "bgPrimary": "#ffffff",
    "bgSecondary": "#f8f9fa",
    "bgHover": "#f1f3f4"
  },
  "spacing": { "xs": "4px", "sm": "8px", "md": "12px", "lg": "16px", "xl": "24px", "2xl": "32px" },
  "fontSize": { "xs": "11px", "sm": "12px", "base": "14px", "lg": "16px", "xl": "20px", "2xl": "24px" },
  "fontWeight": { "normal": 400, "medium": 500, "semibold": 600, "bold": 700 },
  "borderRadius": { "sm": "3px", "base": "4px", "md": "8px", "lg": "12px", "full": "9999px" },
  "transition": { "fast": "150ms ease-in-out", "base": "250ms ease-in-out", "slow": "350ms ease-in-out" }
}
```

---

**ドキュメントバージョン**: 1.0
**最終更新日**: 2026-02-08
**作成者**: Designer
