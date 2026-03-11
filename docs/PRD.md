# Product Requirements Document: Meet Akashi Launcher

## 1. プロダクト概要

### 1.1 プロダクト名
Meet Akashi Launcher

### 1.2 目的
Google MeetとAkashi勤怠管理を統合し、リモートワーカーの業務開始とオンライン会議参加を自動化・効率化する。

### 1.3 対象ユーザー
- Google Workspace（旧G Suite）を利用している企業の社員
- Akashi勤怠管理システムを使用している組織
- 1日に複数のGoogle Meet会議に参加するリモートワーカー

### 1.4 主要価値提案
1. **会議への遅刻防止**: 開始1分前に自動でMeetを開き、参加忘れを防ぐ
2. **出勤打刻の自動リマインド**: 勤怠入力忘れによる労務トラブルを防止
3. **シームレスな業務開始**: 朝の業務開始ルーチンを自動化

---

## 2. 機能要件

### F1: Google Meet自動オープン

#### F1.1 概要
Google Calendarの予定を監視し、会議開始1分前にMeet URLを新しいウィンドウで自動的に開く。

#### F1.2 詳細仕様

**F1.2.1 認証フロー**
- Chrome Identity API（chrome.identity.launchWebAuthFlow）を使用したOAuth2認証
- 必要スコープ: `https://www.googleapis.com/auth/calendar.readonly`
- トークンはchrome.storage.localに暗号化保存
- トークン有効期限切れ時の自動リフレッシュ

**F1.2.2 予定取得**
- Google Calendar API v3を使用
- 取得範囲: 現在時刻から24時間以内の予定
- 取得条件:
  - ユーザーが参加者として含まれている
  - 予定がキャンセルされていない（status != 'cancelled'）
  - Google Meet URLが含まれている（hangoutLink or conferenceData存在）
- ポーリング間隔: 1分（chrome.alarms使用）

**F1.2.3 自動オープンロジック**
```
IF (現在時刻 >= 会議開始時刻 - 1分) AND (現在時刻 < 会議開始時刻 + 5分) THEN
  IF 該当会議がまだ開かれていない THEN
    新しいウィンドウでMeet URLを開く
    開いた会議IDをchrome.storageに記録
  END IF
END IF
```

**F1.2.4 重複防止機構**
- 開いた会議のeventIdをchrome.storage.localに保存（キー: `openedMeetings`）
- データ構造: `{ eventId: timestamp }` のマップ
- 24時間経過した記録は自動削除（ストレージ肥大化防止）

**F1.2.5 ウィンドウ管理**
- chrome.windows.create APIを使用
- 新しいウィンドウで開く（既存タブを汚染しない）
- ウィンドウサイズ: デフォルト（ユーザー設定に依存）

#### F1.3 ユーザーストーリー

**US-F1-1**: 会議参加の自動化
```
As a リモートワーカー
I want 会議開始1分前に自動的にMeet URLが開かれること
So that 会議への参加忘れを防ぎ、時間通りに参加できる
```

**US-F1-2**: 重複オープンの防止
```
As a ユーザー
I want 同じ会議が複数回開かれないこと
So that ブラウザのタブが無駄に増えない
```

**US-F1-3**: 認証の永続化
```
As a ユーザー
I want 一度認証したら毎回ログインしなくて済むこと
So that 毎日の利用がスムーズになる
```

#### F1.4 受け入れ基準

**AC-F1-1**: 基本動作
- [ ] Google Calendarへの認証が成功する
- [ ] 現在時刻から24時間以内のMeet付き予定が取得できる
- [ ] 会議開始1分前に新しいウィンドウでMeetが開く
- [ ] 同じ会議は重複して開かない

**AC-F1-2**: エッジケース
- [ ] 会議開始時刻を過ぎた場合、5分以内なら開く（遅れても参加可能）
- [ ] 会議開始5分後以降は自動オープンしない
- [ ] キャンセルされた予定は開かない
- [ ] Meet URLが含まれていない予定は無視される

**AC-F1-3**: エラーハンドリング
- [ ] 認証エラー時、ユーザーに再認証を促す通知を表示
- [ ] API呼び出し失敗時、次回のポーリングでリトライ
- [ ] ネットワークエラー時、エラー通知を表示

#### F1.5 優先度
**P0 (Must Have)** - コア機能

---

### F2: Akashi出勤リマインダー

#### F2.1 概要
Akashi勤怠管理画面を監視し、当日の出勤打刻が未完了の場合、視覚的リマインダーと通知を表示する。

#### F2.2 詳細仕様

**F2.2.1 Content Script注入**
- 対象URL: `https://atnd.ak4.jp/*`
- 注入タイミング: document_idle
- 権限: host_permissions for atnd.ak4.jp

**F2.2.2 出勤ステータス判定**
- DOM解析による打刻状態の検出
- 検出対象要素:
  - 出勤ボタンの存在有無
  - 打刻済み表示の有無
  - タイムスタンプの存在
- 判定ロジック:
```javascript
function checkAttendanceStatus() {
  // ボタンテキストで判定
  const clockInButton = findElementByText('button', '出勤');
  const clockOutButton = findElementByText('button', '退勤');

  if (clockInButton && !clockInButton.disabled) {
    return 'NOT_CLOCKED_IN';
  }
  if (clockOutButton && !clockOutButton.disabled) {
    return 'CLOCKED_IN';
  }
  return 'UNKNOWN';
}
```

**F2.2.3 バッジ表示**
- 未打刻時:
  - バッジテキスト: "出"
  - バッジ背景色: #FF0000（赤）
- 打刻済み時:
  - バッジをクリア（空文字）

**F2.2.4 デスクトップ通知**
- 未打刻検出時、1回のみ通知を表示
- 通知内容:
  - タイトル: "Akashi出勤リマインダー"
  - メッセージ: "出勤を押してください"
  - アイコン: 拡張機能アイコン
  - タイプ: basic
- 通知は1日1回まで（chrome.storageで管理）
- 通知クリック時、Akashiページを開く

**F2.2.5 状態同期**
- Content scriptからservice workerへメッセージ送信（chrome.runtime.sendMessage）
- メッセージ形式: `{ type: 'ATTENDANCE_STATUS', status: 'CLOCKED_IN' | 'NOT_CLOCKED_IN' }`
- Service workerでバッジと通知を制御

**F2.2.6 監視タイミング**
- Akashiページ初回読み込み時
- ページが可視状態になった時（visibilitychange）
- MutationObserverでDOM変更を監視（打刻ボタン押下を検出）

#### F2.3 ユーザーストーリー

**US-F2-1**: 出勤打刻リマインダー
```
As a 社員
I want 出勤打刻を忘れた場合、リマインダーが表示されること
So that 勤怠入力漏れを防げる
```

**US-F2-2**: 視覚的フィードバック
```
As a ユーザー
I want 拡張アイコンで打刻状態が一目でわかること
So that ブラウザを見るだけで状態確認できる
```

**US-F2-3**: 通知の適切な頻度
```
As a ユーザー
I want 通知が過剰に表示されないこと
So that 作業を邪魔されない
```

#### F2.4 受け入れ基準

**AC-F2-1**: 基本動作
- [ ] Akashiページで出勤打刻状態を正しく判定できる
- [ ] 未打刻時、拡張アイコンに赤い「出」バッジが表示される
- [ ] 未打刻時、デスクトップ通知が1回表示される
- [ ] 打刻済み時、バッジがクリアされる

**AC-F2-2**: 通知制御
- [ ] 同じ日に複数回通知が表示されない
- [ ] 通知クリック時、Akashiページが開く
- [ ] 日付が変わったら通知カウンターがリセットされる

**AC-F2-3**: DOM監視
- [ ] ページ読み込み時に状態判定が実行される
- [ ] 打刻ボタン押下後、自動的にバッジがクリアされる
- [ ] タブがバックグラウンドでも状態同期される

#### F2.5 優先度
**P0 (Must Have)** - コア機能

---

### F3: ポップアップUI

#### F3.1 概要
拡張アイコンクリック時に表示されるポップアップで、今日の予定一覧とAkashi出勤ステータスを表示する。

#### F3.2 詳細仕様

**F3.2.1 UI構成**
```
┌─────────────────────────────┐
│ Meet Akashi Launcher         │
├─────────────────────────────┤
│ 🔔 出勤ステータス            │
│ ✅ 出勤済み (09:00)          │
├─────────────────────────────┤
│ 📅 今日の予定                │
│                             │
│ 10:00 - 11:00               │
│ 週次ミーティング            │
│ [Meet参加]                  │
│                             │
│ 14:00 - 15:00               │
│ プロジェクトレビュー        │
│ [Meet参加]                  │
├─────────────────────────────┤
│ [⚙️ 設定]                   │
└─────────────────────────────┘
```

**F3.2.2 出勤ステータス表示**
- 打刻済み: ✅ "出勤済み (HH:MM)" / 背景色: 緑系（#E8F5E9）
- 未打刻: ⚠️ "出勤未打刻" / 背景色: 赤系（#FFEBEE）+ [Akashiを開く] ボタン
- エラー時: ❓ "ステータス取得失敗"

**F3.2.3 予定リスト表示**
- 時刻範囲（HH:MM - HH:MM）
- イベント名（最大30文字、超過時は省略記号）
- [Meet参加] ボタン（Meet URLがある場合のみ）
- ソート: 開始時刻の昇順
- 最大表示件数: 10件（スクロール可能）

#### F3.3 優先度
**P1 (Should Have)** - 重要だがMVPに必須ではない

---

### F4: 設定画面

#### F4.1 概要
Chrome拡張の設定ページ（options.html）で、認証・通知・動作設定を管理する。

#### F4.2 設定項目
1. **Googleアカウント設定** - 連携/解除
2. **Akashi設定** - URL入力
3. **Meet自動オープン設定** - 有効/無効、タイミング（1〜10分前）
4. **通知設定** - 出勤リマインダー、Meet通知のON/OFF
5. **詳細設定** - ポーリング間隔、デバッグモード

#### F4.3 優先度
**P1 (Should Have)**

---

## 3. 非機能要件

### 3.1 パフォーマンス
- **NFR-P1**: カレンダーAPI呼び出しは1分に1回まで
- **NFR-P2**: ポップアップ表示は1秒以内
- **NFR-P3**: content scriptはページパフォーマンスに影響を与えない（< 50ms）

### 3.2 セキュリティ
- **NFR-S1**: OAuth2トークンはchrome.identity APIで安全に管理
- **NFR-S2**: Content Security Policy（CSP）を厳格に設定
- **NFR-S3**: 外部スクリプトは読み込まない（すべてバンドル）
- **NFR-S4**: 最小権限の原則

### 3.3 可用性
- **NFR-A1**: ネットワークエラー時も拡張は動作し続ける
- **NFR-A2**: service worker停止後も状態は復元される
- **NFR-A3**: エラー発生時、ユーザーに明確なメッセージを表示

### 3.4 互換性
- **NFR-C1**: Chrome 88以降（Manifest V3サポート）
- **NFR-C2**: macOS、Windows、Linux対応

---

## 4. 技術スタック

- **Manifest**: V3
- **言語**: JavaScript (ES Modules)
- **Background**: Service Worker
- **Chrome APIs**: alarms, identity, storage, notifications, action, windows, tabs, runtime

---

## 5. 優先順位とフェーズ

### Phase 1: MVP（2週間）
- [P0] F1: Google Meet自動オープン
- [P0] F2: Akashi出勤リマインダー
- [P1] F4: 設定画面（最小限）

### Phase 2: ユーザビリティ向上（1週間）
- [P1] F3: ポップアップUI
- [P1] F4: 設定画面（完全版）

### Phase 3: 品質・安定性向上（1週間）
- エラーハンドリング改善
- パフォーマンス最適化
- テストカバレッジ向上

### Phase 4: 拡張機能（Nice to Have）
- 退勤リマインダー
- 統計ダッシュボード
- 複数カレンダー対応
- ダークモード対応

---

## 6. リスクと対策

| リスク | 影響度 | 対策 |
|--------|--------|------|
| Service Worker 30秒制限 | 高 | chrome.alarmsで管理、状態はchrome.storageに永続化 |
| Google Calendar APIレート制限 | 中 | ポーリング間隔1分制限、指数バックオフ |
| Akashi DOM構造変更 | 高 | 複数セレクターでフォールバック、変更検知時に通知 |
| OAuth2トークン有効期限切れ | 中 | トークンリフレッシュ、失敗時は再認証を促す |
| Manifest V3のCSP制約 | 低 | すべてのスクリプトをバンドル、eval()不使用 |

---

**ドキュメントバージョン**: 1.0
**最終更新日**: 2026-02-08
**作成者**: Product Manager
