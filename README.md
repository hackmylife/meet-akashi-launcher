# Meet Akashi Launcher

Google MeetとAkashi勤怠管理を統合するChrome拡張機能です。

会議の自動参加と出退勤打刻のリマインドにより、日々の勤怠管理をサポートします。

## 機能

### Google Meet 自動参加
- Google Calendarから今日の会議一覧を取得・表示
- 会議開始前にMeetのウィンドウを自動オープン（タイミングは設定で変更可能）
- ポップアップから手動で会議に参加可能
- 不要な会議のスキップ機能
- ポップアップを開くと次の会議まで自動スクロール
- Meetウィンドウのサイズを設定で変更可能
- 終日イベントは自動除外

### Akashi 出退勤リマインド
- 出勤未打刻の場合、バッジ「出」(赤)で通知
- 18:00以降に退勤未打刻の場合、バッジ「退」(オレンジ)で通知
- 21:55以降は緊急モード（バッジ「退」赤 + 緊急通知）
- 退勤打刻済みの場合は「お疲れ様でした！」表示
- ポップアップから直接Akashiの打刻ページへリンク（フローティングボタン付き）
- Akashiタブを開いていなくても、デフォルトで未打刻と判定する日次勤怠管理方式
- 前日から開きっぱなしのAkashiタブの古いデータは無視

## セットアップ

### 1. Google Cloud Console の設定

1. [Google Cloud Console](https://console.cloud.google.com/) でプロジェクトを作成
2. Google Calendar API を有効化
3. 認証情報 > OAuth 2.0 クライアントID を作成（種類: **ウェブアプリケーション**）
4. 承認済みリダイレクトURIに `https://<拡張機能ID>.chromiumapp.org/` を追加

> 拡張機能IDは `chrome://extensions/` で拡張を読み込んだ後に確認できます。

### 2. OAuth 認証情報の設定

```bash
cp shared/config.sample.js shared/config.js
```

`shared/config.js` を開き、GCPで取得したクライアントIDとクライアントシークレットを設定してください。

> `shared/config.js` は `.gitignore` に含まれており、リポジトリにはコミットされません。

### 3. Chrome への読み込み

1. `chrome://extensions/` を開く
2. 「デベロッパーモード」を有効化
3. 「パッケージ化されていない拡張機能を読み込む」からプロジェクトフォルダを選択

### 4. 初期設定

1. 拡張機能アイコンをクリックしてポップアップを開く
2. 「Google ログイン」ボタンでGoogleアカウントを連携
3. 設定ページ（歯車アイコン）で各種設定を調整

## 配布方法

### 身内・同僚に渡す場合

`shared/config.js` を含めたフォルダごとZIPで渡してください。

```bash
zip -r meet-akashi-launcher.zip meet-akashi-launcher/
```

受け取った人は `chrome://extensions/` から読み込むだけで使えます。

### ソースコードを公開する場合

`shared/config.js` は `.gitignore` で除外されているため、リポジトリには含まれません。利用者は上記セットアップ手順に従って各自のGCPプロジェクトを作成し、認証情報を設定してください。

## 設定項目

| 項目 | デフォルト | 説明 |
|------|-----------|------|
| 会議の自動オープン | ON | 会議開始前にMeetウィンドウを自動で開く |
| Akashi通知 | ON | 出退勤忘れを通知する |
| 自動オープンタイミング | 60秒前 | 会議開始何秒前にウィンドウを開くか |
| Meetウィンドウ幅 | 1280px | 自動オープン時のウィンドウ幅 |
| Meetウィンドウ高さ | 800px | 自動オープン時のウィンドウ高さ |
| Akashiチェック間隔 | 5分 | 勤怠状態の確認間隔 |
| Akashi URL | https://atnd.ak4.jp | AkashiのベースURL（*.ak4.jpドメインのみ） |

## ファイル構成

```
meet-akashi-launcher/
├── manifest.json              # 拡張機能マニフェスト (Manifest V3)
├── .gitignore                 # config.js を除外
├── background/
│   ├── service-worker.js      # Service Worker (メッセージハンドリング)
│   ├── calendar-manager.js    # Google Calendar API連携・OAuth管理
│   ├── meeting-manager.js     # 会議の自動オープン制御
│   ├── akashi-manager.js      # Akashi勤怠状態管理・通知
│   ├── storage-manager.js     # chrome.storage管理
│   └── alarm-manager.js       # chrome.alarms管理
├── content/
│   └── content-akashi.js      # Akashiページの打刻状態検出
├── popup/
│   ├── popup.html             # ポップアップUI
│   ├── popup.js               # ポップアップロジック
│   └── popup.css              # ポップアップスタイル
├── options/
│   ├── options.html           # 設定ページUI
│   ├── options.js             # 設定ページロジック
│   └── options.css            # 設定ページスタイル
├── shared/
│   ├── config.sample.js       # OAuth認証情報テンプレート
│   ├── config.js              # OAuth認証情報（.gitignore対象）
│   ├── constants.js           # 定数定義
│   ├── message-types.js       # メッセージタイプ定義
│   └── utils.js               # ユーティリティ関数
├── icons/                     # 拡張機能アイコン
└── docs/                      # 設計ドキュメント
```

## 技術スタック

- Chrome Extension Manifest V3
- Google Calendar API (OAuth 2.0 Authorization Code Flow + PKCE)
- Service Worker (バックグラウンド処理)
- Content Script (Akashiページ解析)

## 権限

| 権限 | 用途 |
|------|------|
| `alarms` | 定期的な会議チェック・勤怠チェック |
| `notifications` | 出退勤忘れの通知 |
| `storage` | 設定・イベントキャッシュの保存 |
| `identity` | Google OAuth認証 |
| `https://www.googleapis.com/*` | Google Calendar API呼び出し |
| `https://atnd.ak4.jp/*` | AkashiページへのContent Script注入 |
