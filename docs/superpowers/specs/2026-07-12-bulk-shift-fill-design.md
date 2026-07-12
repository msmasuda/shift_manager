# 一括シフト入力機能 設計

Issue: https://github.com/msmasuda/shift_manager/issues/2

## 背景・目的

管理者ボードでは現在、シフトを1件ずつ(日付×メンバーのセルをクリックするか、上部のフォームから)入力する必要があり、メンバー数×日数分の入力が手間になっている。

多くのメンバーは日によらず決まった出退勤時間(基本シフト)で働くことが多いため、「まず基本時間で一括入力し、例外がある日だけ個別に直す」というワークフローができれば入力の手間を大幅に減らせる。

## スコープ

- 対象: 管理者ボード(`/admin`)のみ
- `/schedule`(閲覧用一覧)、`/my-shifts`は対象外
- 既存の「シフトの追加」フォーム、日別カードのインライン編集・削除、休日カードからの個別追加はすべてそのまま維持し、一括入力機能と共存する

## A. データモデル

`User` に基本シフト時間を追加する(`prisma/schema.prisma`):

```prisma
model User {
  ...
  defaultStartTime String? // "HH:MM" 基本の出勤時刻
  defaultEndTime   String? // "HH:MM" 基本の退勤時刻
  ...
}
```

- 両方セットされているメンバーのみが一括入力の対象になる。どちらか一方でも未設定なら「未設定」として一括入力からスキップする。
- `src/types/index.ts` の `User` 型に `defaultStartTime?: string | null` / `defaultEndTime?: string | null` を追加する。

## B. メンバー管理ページ (`/admin/members`)

新規ページを追加する。

- 表示内容: 組織内メンバーの一覧(名前・メールアドレス・ロール)+ 各行に基本開始/終了時刻(`type="time"`)の入力欄
- 保存は行ごとに個別に行う(既存の他ページ・カードの操作感に合わせる。他行を巻き込まない)
- ナビ(`src/app/nav-auth.tsx`)に管理者限定リンク「メンバー管理」を追加(「企業情報」の並びに追加)
- API:
  - 既存 `GET /api/users` のレスポンスに `defaultStartTime`/`defaultEndTime` を含める(`select`に追加)
  - 新規 `PATCH /api/users/[id]`: `defaultStartTime`/`defaultEndTime` を更新。`POST /api/users` 同様に `session.user.role !== "ADMIN"` なら403。対象ユーザーが自組織に属することを確認してから更新する。
  - `src/lib/api.ts` に `api.users.update(id, { defaultStartTime, defaultEndTime })` を追加

### バリデーション

- `defaultStartTime`/`defaultEndTime` は `"HH:MM"` 形式、または両方 `null`(未設定に戻す)を許可する Zod スキーマ
- 両方指定する場合は `startTime < endTime` を要求(日またぎの基本シフトは今回サポートしない)

## C. 一括入力(管理者ボード)

- `src/app/admin/page.tsx` の月ピッカー付近に「一括入力」ボタンを追加
- クリックすると、現在表示中の月の `rangeStart`/`rangeEnd` を使って `POST /api/schedule/bulk-fill` を呼ぶ
- 確認ダイアログは設けない(既存の削除操作にも確認ダイアログがなく、アプリ全体の操作感に合わせる。誤って一括作成したシフトは既存の編集・削除機能でその場で修正できるため実害は小さい)
- 完了後、「◯件のシフトを追加しました」という結果メッセージを一時的に表示し、ボードを再取得(`onRefresh`)する

### API: `POST /api/schedule/bulk-fill`

リクエストボディ: `{ from: string, to: string }` (`YYYY-MM-DD`)

処理内容(`session.user.role !== "ADMIN"` なら403):

1. `organizationId` はセッションから取得
2. 対象範囲の `ScheduleDay` を取得(`isHoliday: true` の日は除外)
3. 過去日(`date < 今日`)は除外(既存の「過去日編集ブロック」方針に合わせる)
4. `defaultStartTime`・`defaultEndTime` を両方持つ組織内メンバーを取得
5. 残った日 × メンバーの組み合わせについて、既存の `ShiftAssignment` または `LeaveRecord` がある場合はスキップ
6. スキップされなかった組み合わせについて `ShiftAssignment` を作成(`ScheduleDay` が存在しない日は `upsert` で作成、`minRequired` はデフォルト0のまま据え置き)
7. トランザクション内で実行し、作成件数を `{ created: number }` で返す

- `src/lib/api.ts` に `api.schedule.bulkFill(from, to)` を追加

## D. 影響範囲・非スコープ

- `/schedule`・`/my-shifts` は変更しない
- 日またぎの基本シフト(深夜勤務など)は非対応。必要なら個別編集で対応する
- メンバーの新規作成・削除UIは今回のスコープ外(既存通りAPI/シードのみ)

## E. テスト

- `src/__tests__/api/` に新規 `bulk-fill.test.ts` を追加し、Route Handler (`POST`) を直接呼び出してテスト:
  - 基本時間未設定メンバーはスキップされる
  - 既存シフトがある日はスキップされる
  - 休暇(`LeaveRecord`)がある日はスキップされる
  - 休日(`isHoliday`)の日は対象から除外される
  - 過去日は対象から除外される
  - ADMIN以外は403
- `src/__tests__/api/users.test.ts` に `PATCH /api/users/[id]` のテストを追加(ADMIN限定、`startTime < endTime` バリデーション)
