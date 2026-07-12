# 一括シフト入力機能 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 管理者ボードで、メンバーごとに登録した「基本シフト時間」を使って、表示中の月の空欄シフトを一括作成できるようにする。

**Architecture:** `User` にメンバーごとの基本開始/終了時刻(`defaultStartTime`/`defaultEndTime`, `"HH:MM"` 文字列, 両方optional)を追加する。管理者が新規ページ `/admin/members` でこれを設定し、管理者ボードの「一括入力」ボタンから新設の `POST /api/schedule/bulk-fill` を呼ぶと、表示範囲内の休日・過去日・既存シフト・休暇のある日を除いた「空欄」に、各メンバーの基本時間でシフトを作成する。

**Tech Stack:** Next.js 15 App Router (Route Handlers), Prisma (PostgreSQL, `db push` — マイグレーションファイルなし), Zod, Vitest, SWR, next-auth v5 (`auth()` セッション)。

## Global Constraints

- `ShiftAssignment.startTime`/`endTime` は `"HH:MM"` 文字列(`DateTime` ではない)。`defaultStartTime`/`defaultEndTime` も同じ形式・同じ正規表現 `/^\d{2}:\d{2}$/` を使う。
- 1ユーザー1日1組織につき1シフトまで(重複は409)。既存の `POST /api/shifts` のロジックを変更しない。
- Route Handler は Zod でバリデーションし、`ZodError` は `{ error: "Validation Error", details }` で400を返す(既存パターンに合わせる)。
- 管理者専用の書き込み系エンドポイント(`POST /api/users` 等)は `session.user.role !== "ADMIN"` を明示チェックして403を返す。今回追加する `PATCH /api/users/[id]` と `POST /api/schedule/bulk-fill` も同様にする。
- `organizationId` は必ず `auth()` のセッションから取得する。クライアントからの自己申告値は信用しない。
- テストは `src/__tests__/api/` に置き、`vi.mock("@/lib/prisma", ...)` と `vi.mock("@/auth", ...)` でモックし、Route Handler関数(`POST`/`PATCH`など)を直接 `new Request(...)` で呼び出す(既存の `shifts.test.ts`/`users.test.ts` と同じスタイル)。
- 日付比較は `Date.prototype.toISOString().slice(0, 10)` によるUTCベースの `"YYYY-MM-DD"` 文字列で統一する(`/api/schedule/warnings` の既存パターンに合わせる)。
- UIのスタイルは既存の `glass-card` / `btn-secondary` / `styled-input` 等のユーティリティクラスをそのまま使う。新しいUIコンポーネントライブラリは追加しない。

---

### Task 1: `User` に基本シフト時間フィールドを追加する

**Files:**
- Modify: `prisma/schema.prisma:21-32` (`User` モデル)
- Modify: `src/types/index.ts:13-18` (`User` 型)

**Interfaces:**
- Produces: `User.defaultStartTime: string | null`, `User.defaultEndTime: string | null` (Prisma モデル・TypeScript型の両方)。以降の全タスクがこの2フィールドを参照する。

- [ ] **Step 1: `prisma/schema.prisma` の `User` モデルに2フィールドを追加**

`prisma/schema.prisma:21-32` を以下のように変更する(`passwordHash` の直後に追加):

```prisma
model User {
  id             String   @id @default(cuid())
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  email          String   @unique
  name           String
  role           UserRole @default(MEMBER)
  passwordHash   String?
  defaultStartTime String? // "HH:MM" 基本の出勤時刻（一括シフト入力で使用）
  defaultEndTime   String? // "HH:MM" 基本の退勤時刻（一括シフト入力で使用）
  shiftAssignments ShiftAssignment[]
  leaveRecords     LeaveRecord[]
  @@index([organizationId])
}
```

- [ ] **Step 2: DBにスキーマを適用**

Run: `npx prisma db push`
Expected: `Your database is now in sync with your Prisma schema.` のような成功メッセージ。`.env` の `DATABASE_URL` (デフォルトは `192.168.100.2:5432`) にDBが接続できている必要がある。

- [ ] **Step 3: `src/types/index.ts` の `User` 型に2フィールドを追加**

`src/types/index.ts:13-18` を以下に変更:

```typescript
export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  defaultStartTime?: string | null;
  defaultEndTime?: string | null;
}
```

- [ ] **Step 4: 型チェック**

Run: `npx tsc --noEmit`
Expected: エラーなし(既存コードで `User` 型の新フィールドを必須にしていないため、既存の `User` オブジェクト生成箇所に影響しないはず)。

- [ ] **Step 5: コミット**

```bash
git add prisma/schema.prisma src/types/index.ts
git commit -m "feat: add defaultStartTime/defaultEndTime to User for bulk shift fill"
```

---

### Task 2: メンバーの基本シフト時間を読み書きするAPI (`GET/PATCH /api/users`)

**Files:**
- Modify: `src/app/api/users/route.ts:23-27` (`GET` の `select`)
- Create: `src/app/api/users/[id]/route.ts` (新規 `PATCH`)
- Modify: `src/lib/api.ts:61-65` (`api.users`)
- Test: `src/__tests__/api/users.test.ts` (既存ファイルに追記)

**Interfaces:**
- Consumes: `User.defaultStartTime`/`defaultEndTime` (Task 1)
- Produces: `PATCH /api/users/[id]` エンドポイント、`api.users.update(id, data): Promise<User>` — Task 4(メンバー管理ページ)が使用する。

- [ ] **Step 1: `GET /api/users` のレスポンスに基本時間を含める**

`src/app/api/users/route.ts:23-27` を以下に変更:

```typescript
    const users = await prisma.user.findMany({
      where: { organizationId },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        defaultStartTime: true,
        defaultEndTime: true,
      },
    });
```

- [ ] **Step 2: 失敗するテストを書く(`PATCH /api/users/[id]`)**

`src/__tests__/api/users.test.ts` の先頭の `vi.mock("@/lib/prisma", ...)` を以下に置き換える(`update`/`findUnique` を追加):

```typescript
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findMany: vi.fn(), create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  },
}));
```

ファイル末尾(既存の `POST /api/users` の `describe` ブロックの後)に以下を追記する。先頭の `import { prisma } from "@/lib/prisma";` の下に `import { PATCH } from "@/app/api/users/[id]/route";` を追加すること(この時点ではファイルがまだ存在しないので次のStepまでは失敗する):

```typescript
function makePatchRequest(body: unknown) {
  return new Request("http://localhost/api/users/user-1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const patchParams = Promise.resolve({ id: "user-1" });

describe("PATCH /api/users/[id]", () => {
  it("403: non-admin", async () => {
    const { auth } = await import("@/auth");
    vi.mocked(auth).mockResolvedValueOnce({
      user: { id: "member-1", organizationId: "org-1", role: "MEMBER" },
    } as any);

    const res = await PATCH(makePatchRequest({ defaultStartTime: "10:00" }), {
      params: patchParams,
    });
    expect(res.status).toBe(403);
  });

  it("404: user not in organization", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      organizationId: "org-OTHER",
    } as any);

    const res = await PATCH(makePatchRequest({ defaultStartTime: "10:00" }), {
      params: patchParams,
    });
    expect(res.status).toBe(404);
  });

  it("400: defaultEndTime before defaultStartTime", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      organizationId: "org-1",
    } as any);

    const res = await PATCH(
      makePatchRequest({ defaultStartTime: "18:00", defaultEndTime: "09:00" }),
      { params: patchParams }
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Validation Error");
  });

  it("200: success setting both times", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      organizationId: "org-1",
    } as any);
    vi.mocked(prisma.user.update).mockResolvedValueOnce({
      id: "user-1",
      name: "Alice",
      email: "alice@example.com",
      role: "MEMBER",
      defaultStartTime: "10:00",
      defaultEndTime: "19:00",
    } as any);

    const res = await PATCH(
      makePatchRequest({ defaultStartTime: "10:00", defaultEndTime: "19:00" }),
      { params: patchParams }
    );
    expect(res.status).toBe(200);
  });

  it("200: success clearing both times (null)", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      organizationId: "org-1",
    } as any);
    vi.mocked(prisma.user.update).mockResolvedValueOnce({
      id: "user-1",
      name: "Alice",
      email: "alice@example.com",
      role: "MEMBER",
      defaultStartTime: null,
      defaultEndTime: null,
    } as any);

    const res = await PATCH(
      makePatchRequest({ defaultStartTime: null, defaultEndTime: null }),
      { params: patchParams }
    );
    expect(res.status).toBe(200);
  });
});
```

- [ ] **Step 3: テストを実行して失敗を確認**

Run: `npx vitest run src/__tests__/api/users.test.ts`
Expected: FAIL(`Cannot find module '@/app/api/users/[id]/route'` のようなエラー)

- [ ] **Step 4: `src/app/api/users/[id]/route.ts` を作成**

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { z } from "zod";

const timeRegex = /^\d{2}:\d{2}$/;

const patchUserSchema = z
  .object({
    defaultStartTime: z.string().regex(timeRegex).nullable().optional(),
    defaultEndTime: z.string().regex(timeRegex).nullable().optional(),
  })
  .refine(
    (data) =>
      !data.defaultStartTime || !data.defaultEndTime
        ? true
        : data.defaultStartTime < data.defaultEndTime,
    {
      message: "defaultEndTime must be after defaultStartTime",
      path: ["defaultEndTime"],
    }
  );

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { organizationId } = session.user;
    const { id } = await params;

    const target = await prisma.user.findUnique({
      where: { id },
      select: { organizationId: true },
    });
    if (!target || target.organizationId !== organizationId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await request.json();
    const data = patchUserSchema.parse(body);

    const user = await prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        defaultStartTime: true,
        defaultEndTime: true,
      },
    });
    return NextResponse.json(user);
  } catch (error) {
    console.error("PATCH /api/users/[id] error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation Error", details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 5: テストを実行してパスを確認**

Run: `npx vitest run src/__tests__/api/users.test.ts`
Expected: PASS(全ケース)

- [ ] **Step 6: `src/lib/api.ts` に `api.users.update` を追加**

`src/lib/api.ts:61-65` を以下に変更:

```typescript
  users: {
    list: () => get<User[]>("/api/users"),
    create: (data: { email: string; name: string; role?: string }) =>
      post<User>("/api/users", data),
    update: (
      id: string,
      data: { defaultStartTime?: string | null; defaultEndTime?: string | null }
    ) => patch<User>(`/api/users/${id}`, data),
  },
```

- [ ] **Step 7: コミット**

```bash
git add src/app/api/users/route.ts src/app/api/users/[id]/route.ts src/lib/api.ts src/__tests__/api/users.test.ts
git commit -m "feat: add PATCH /api/users/[id] for member default shift times"
```

---

### Task 3: 一括入力API (`POST /api/schedule/bulk-fill`)

**Files:**
- Create: `src/app/api/schedule/bulk-fill/route.ts`
- Modify: `src/lib/api.ts` (`schedule` セクションに `bulkFill` を追加)
- Test: `src/__tests__/api/bulk-fill.test.ts` (新規)

**Interfaces:**
- Consumes: `User.defaultStartTime`/`defaultEndTime` (Task 1)、`ScheduleDay.isHoliday`、`LeaveRecord`(既存モデル)
- Produces: `POST /api/schedule/bulk-fill` — body `{ from: string, to: string }` (`"YYYY-MM-DD"`), レスポンス `{ created: number }`。`api.schedule.bulkFill(from, to): Promise<{ created: number }>` — Task 5(管理者ボードのボタン)が使用する。

- [ ] **Step 1: 失敗するテストを書く**

`src/__tests__/api/bulk-fill.test.ts` を新規作成:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const txMock = {
  scheduleDay: { upsert: vi.fn() },
  shiftAssignment: { createMany: vi.fn() },
};

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findMany: vi.fn() },
    scheduleDay: { findMany: vi.fn() },
    leaveRecord: { findMany: vi.fn() },
    $transaction: vi.fn((cb: any) => cb(txMock)),
  },
}));

vi.mock("@/auth", () => ({
  auth: vi.fn().mockResolvedValue({
    user: { id: "admin-1", organizationId: "org-1", role: "ADMIN" },
  }),
}));

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { POST } from "@/app/api/schedule/bulk-fill/route";

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/schedule/bulk-fill", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.$transaction).mockImplementation((cb: any) => cb(txMock));
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-01-15T00:00:00.000Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("POST /api/schedule/bulk-fill", () => {
  it("403: non-admin", async () => {
    vi.mocked(auth).mockResolvedValueOnce({
      user: { id: "member-1", organizationId: "org-1", role: "MEMBER" },
    } as any);

    const res = await POST(makeRequest({ from: "2026-01-16", to: "2026-01-17" }));
    expect(res.status).toBe(403);
  });

  it("400: invalid date format", async () => {
    const res = await POST(makeRequest({ from: "not-a-date", to: "2026-01-17" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Validation Error");
  });

  it("created: 0 when no members have default times set", async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValueOnce([]);
    vi.mocked(prisma.scheduleDay.findMany).mockResolvedValueOnce([]);
    vi.mocked(prisma.leaveRecord.findMany).mockResolvedValueOnce([]);

    const res = await POST(makeRequest({ from: "2026-01-16", to: "2026-01-16" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.created).toBe(0);
    expect(txMock.shiftAssignment.createMany).not.toHaveBeenCalled();
  });

  it("skips days entirely in the past", async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValueOnce([
      { id: "user-1", defaultStartTime: "10:00", defaultEndTime: "19:00" },
    ] as any);
    vi.mocked(prisma.scheduleDay.findMany).mockResolvedValueOnce([]);
    vi.mocked(prisma.leaveRecord.findMany).mockResolvedValueOnce([]);

    // 2026-01-15 is "today" (fake system time); this range is entirely before it
    const res = await POST(makeRequest({ from: "2026-01-10", to: "2026-01-14" }));
    const body = await res.json();
    expect(body.created).toBe(0);
    expect(prisma.scheduleDay.findMany).not.toHaveBeenCalled();
  });

  it("excludes holiday days, existing assignments, and leave records", async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValueOnce([
      { id: "user-1", defaultStartTime: "10:00", defaultEndTime: "19:00" },
      { id: "user-2", defaultStartTime: "12:00", defaultEndTime: "20:00" },
    ] as any);
    vi.mocked(prisma.scheduleDay.findMany).mockResolvedValueOnce([
      {
        id: "day-16",
        date: new Date("2026-01-16T00:00:00.000Z"),
        isHoliday: false,
        shiftAssignments: [{ userId: "user-1" }], // user-1 already assigned on 1/16
      },
      {
        id: "day-17",
        date: new Date("2026-01-17T00:00:00.000Z"),
        isHoliday: true, // holiday: nobody gets filled
        shiftAssignments: [],
      },
    ] as any);
    vi.mocked(prisma.leaveRecord.findMany).mockResolvedValueOnce([
      { userId: "user-2", date: new Date("2026-01-16T00:00:00.000Z") }, // user-2 off on 1/16
    ] as any);
    txMock.scheduleDay.upsert.mockResolvedValueOnce({ id: "day-18" });

    // range: 1/16 (existing day, holiday=false), 1/17 (holiday), 1/18 (no ScheduleDay row yet)
    const res = await POST(makeRequest({ from: "2026-01-16", to: "2026-01-18" }));
    expect(res.status).toBe(200);
    const body = await res.json();

    // 1/16: user-1 skipped (already assigned), user-2 skipped (leave) => 0 created
    // 1/17: holiday => 0 created
    // 1/18: no existing day => both user-1 and user-2 filled => 2 created
    expect(body.created).toBe(2);
    expect(txMock.scheduleDay.upsert).toHaveBeenCalledTimes(1);
    expect(txMock.shiftAssignment.createMany).toHaveBeenCalledTimes(1);
    expect(txMock.shiftAssignment.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        { scheduleDayId: "day-18", userId: "user-1", startTime: "10:00", endTime: "19:00" },
        { scheduleDayId: "day-18", userId: "user-2", startTime: "12:00", endTime: "20:00" },
      ]),
    });
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npx vitest run src/__tests__/api/bulk-fill.test.ts`
Expected: FAIL(`Cannot find module '@/app/api/schedule/bulk-fill/route'`)

- [ ] **Step 3: `src/app/api/schedule/bulk-fill/route.ts` を作成**

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { z } from "zod";

const bulkFillSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

function datesInRange(fromStr: string, toStr: string): string[] {
  const dates: string[] = [];
  const cur = new Date(fromStr + "T00:00:00.000Z");
  const end = new Date(toStr + "T00:00:00.000Z");
  while (cur <= end) {
    dates.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return dates;
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { organizationId } = session.user;

    const body = await request.json();
    const { from, to } = bulkFillSchema.parse(body);

    const todayStr = new Date().toISOString().slice(0, 10);
    const dates = datesInRange(from, to).filter((d) => d >= todayStr);

    if (dates.length === 0) {
      return NextResponse.json({ created: 0 });
    }

    const fromDate = new Date(from + "T00:00:00.000Z");
    const toDate = new Date(to + "T00:00:00.000Z");

    const [members, existingDays, leaveRecords] = await Promise.all([
      prisma.user.findMany({
        where: {
          organizationId,
          defaultStartTime: { not: null },
          defaultEndTime: { not: null },
        },
        select: { id: true, defaultStartTime: true, defaultEndTime: true },
      }),
      prisma.scheduleDay.findMany({
        where: { organizationId, date: { gte: fromDate, lte: toDate } },
        include: { shiftAssignments: { select: { userId: true } } },
      }),
      prisma.leaveRecord.findMany({
        where: { organizationId, date: { gte: fromDate, lte: toDate } },
        select: { userId: true, date: true },
      }),
    ]);

    const existingDaysMap = new Map(
      existingDays.map((d) => [
        d.date.toISOString().slice(0, 10),
        {
          id: d.id,
          isHoliday: d.isHoliday,
          assignedUserIds: new Set(d.shiftAssignments.map((a) => a.userId)),
        },
      ])
    );
    const leaveSet = new Set(
      leaveRecords.map((l) => `${l.userId}|${l.date.toISOString().slice(0, 10)}`)
    );

    const created = await prisma.$transaction(async (tx) => {
      let count = 0;
      for (const dateStr of dates) {
        const existing = existingDaysMap.get(dateStr);
        if (existing?.isHoliday) continue;

        const membersToFill = members.filter(
          (m) =>
            !leaveSet.has(`${m.id}|${dateStr}`) &&
            !existing?.assignedUserIds.has(m.id)
        );
        if (membersToFill.length === 0) continue;

        const scheduleDayId = existing
          ? existing.id
          : (
              await tx.scheduleDay.upsert({
                where: {
                  organizationId_date: {
                    organizationId,
                    date: new Date(dateStr + "T00:00:00.000Z"),
                  },
                },
                create: {
                  organizationId,
                  date: new Date(dateStr + "T00:00:00.000Z"),
                  minRequired: 0,
                },
                update: {},
              })
            ).id;

        await tx.shiftAssignment.createMany({
          data: membersToFill.map((m) => ({
            scheduleDayId,
            userId: m.id,
            startTime: m.defaultStartTime!,
            endTime: m.defaultEndTime!,
          })),
        });
        count += membersToFill.length;
      }
      return count;
    });

    return NextResponse.json({ created });
  } catch (error) {
    console.error("POST /api/schedule/bulk-fill error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation Error", details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 4: テストを実行してパスを確認**

Run: `npx vitest run src/__tests__/api/bulk-fill.test.ts`
Expected: PASS(全ケース)

- [ ] **Step 5: `src/lib/api.ts` の `schedule` セクションに `bulkFill` を追加**

`src/lib/api.ts:66-77` の `schedule: { ... }` ブロック末尾(`warnings` の後)に追加:

```typescript
  schedule: {
    days: (from: string, to: string) =>
      get<ScheduleDay[]>("/api/schedule/days", { from, to }),
    setMinRequired: (date: string, minRequired: number) =>
      put<ScheduleDay>(`/api/schedule/days/${date}`, { minRequired }),
    setHoliday: (date: string, isHoliday: boolean) =>
      put<ScheduleDay>(`/api/schedule/days/${date}`, { isHoliday }),
    setHours: (date: string, openTime: string | null, closeTime: string | null, openTime2?: string | null, closeTime2?: string | null) =>
      put<ScheduleDay>(`/api/schedule/days/${date}`, { openTime, closeTime, openTime2, closeTime2 }),
    warnings: (from: string, to: string) =>
      get<WarningsResponse>("/api/schedule/warnings", { from, to }),
    bulkFill: (from: string, to: string) =>
      post<{ created: number }>("/api/schedule/bulk-fill", { from, to }),
  },
```

- [ ] **Step 6: 型チェックとフルテスト実行**

Run: `npx tsc --noEmit && npm test`
Expected: エラーなし、全テストPASS

- [ ] **Step 7: コミット**

```bash
git add src/app/api/schedule/bulk-fill/route.ts src/lib/api.ts src/__tests__/api/bulk-fill.test.ts
git commit -m "feat: add POST /api/schedule/bulk-fill for bulk shift creation"
```

---

### Task 4: メンバー管理ページ (`/admin/members`)

**Files:**
- Create: `src/app/admin/members/page.tsx`
- Modify: `src/app/nav-auth.tsx:27-35` (管理者向けナビリンク追加)

**Interfaces:**
- Consumes: `api.users.list()`, `api.users.update(id, data)` (Task 2)、`User.defaultStartTime`/`defaultEndTime` (Task 1)
- Produces: `/admin/members` ページ(このタスク内で完結、他タスクからは参照されない)

- [ ] **Step 1: `src/app/admin/members/page.tsx` を作成**

```tsx
"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import { api } from "@/lib/api";
import type { User } from "@/types";

function MemberRow({
  user,
  onSaved,
}: {
  user: User;
  onSaved: () => Promise<void>;
}) {
  const [startTime, setStartTime] = useState(user.defaultStartTime ?? "");
  const [endTime, setEndTime] = useState(user.defaultEndTime ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setStartTime(user.defaultStartTime ?? "");
    setEndTime(user.defaultEndTime ?? "");
  }, [user.defaultStartTime, user.defaultEndTime]);

  const isDirty =
    startTime !== (user.defaultStartTime ?? "") ||
    endTime !== (user.defaultEndTime ?? "");

  const handleSave = async () => {
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      await api.users.update(user.id, {
        defaultStartTime: startTime || null,
        defaultEndTime: endTime || null,
      });
      await onSaved();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="glass-card p-4 flex flex-col md:flex-row md:items-center gap-3 md:gap-6">
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-foreground truncate">{user.name}</div>
        <div className="text-xs text-textMuted truncate">{user.email}</div>
      </div>
      <span
        className={`text-[10px] font-bold px-2 py-0.5 rounded-full self-start md:self-auto shrink-0 ${
          user.role === "ADMIN"
            ? "bg-accent/15 text-accent border border-accent/30"
            : "bg-white/5 text-textMuted border border-white/10"
        }`}
      >
        {user.role === "ADMIN" ? "管理者" : "メンバー"}
      </span>
      <div className="flex items-center gap-2">
        <span className="text-[11px] text-textMuted w-9 shrink-0">開始</span>
        <input
          type="time"
          value={startTime}
          onChange={(e) => {
            setStartTime(e.target.value);
            setSaved(false);
          }}
          className="bg-black/40 border border-border/50 rounded-lg px-3 py-1.5 text-sm text-foreground focus:outline-none focus:border-accent hover:border-textMuted transition-colors"
        />
        <span className="text-textMuted text-sm">–</span>
        <span className="text-[11px] text-textMuted w-9 shrink-0">終了</span>
        <input
          type="time"
          value={endTime}
          onChange={(e) => {
            setEndTime(e.target.value);
            setSaved(false);
          }}
          className="bg-black/40 border border-border/50 rounded-lg px-3 py-1.5 text-sm text-foreground focus:outline-none focus:border-accent hover:border-textMuted transition-colors"
        />
      </div>
      <div className="flex items-center gap-2 min-w-[140px]">
        <button
          onClick={handleSave}
          disabled={saving || !isDirty}
          className="px-4 py-1.5 rounded-lg bg-accent/20 border border-accent/50 text-accent text-sm font-semibold hover:bg-accent/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {saving ? "保存中..." : "保存"}
        </button>
        {saved && <span className="text-xs text-green-400">保存済み</span>}
        {error && <span className="text-xs text-red-400">{error}</span>}
      </div>
    </div>
  );
}

export default function MembersPage() {
  const { data: session } = useSession();
  const organizationId = session?.user?.organizationId ?? "";

  const { data: users, mutate } = useSWR(
    organizationId ? ["users", organizationId] : null,
    () => api.users.list()
  );

  return (
    <div className="animate-fade-in max-w-3xl">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold mb-2 tracking-tight">メンバー管理</h1>
        <p className="text-textMuted">
          メンバーごとの基本シフト時間を設定します。管理者ボードの「一括入力」で、この時間を使って空欄のシフトを一気に埋められます。
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {(users ?? []).map((u) => (
          <MemberRow
            key={u.id}
            user={u}
            onSaved={async () => {
              await mutate();
            }}
          />
        ))}
        {users && users.length === 0 && (
          <div className="glass-card p-8 text-center text-textMuted">
            メンバーがいません。
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: ナビに「メンバー管理」リンクを追加**

`src/app/nav-auth.tsx:27-35` を以下に変更:

```tsx
      {isAdmin && (
        <Link
          href="/admin/members"
          onClick={onClose}
          className="text-sm font-medium text-textMuted hover:text-white transition-colors"
        >
          メンバー管理
        </Link>
      )}
      {isAdmin && (
        <Link
          href="/admin/organization"
          onClick={onClose}
          className="text-sm font-medium text-textMuted hover:text-white transition-colors"
        >
          企業情報
        </Link>
      )}
```

- [ ] **Step 3: 動作確認**

Run: `npm run dev`
- 管理者アカウント(例: `yamada@cafe.example.com` / `password123`)でログインし、ナビの「メンバー管理」から `/admin/members` を開く
- メンバー一覧が表示され、開始/終了時刻を入力して「保存」を押すと「保存済み」と表示されることを確認
- ページを再読み込みしても入力した値が保持されていることを確認

- [ ] **Step 4: コミット**

```bash
git add src/app/admin/members/page.tsx src/app/nav-auth.tsx
git commit -m "feat: add member management page for default shift times"
```

---

### Task 5: 管理者ボードに「一括入力」ボタンを追加

**Files:**
- Modify: `src/app/admin/page.tsx`

**Interfaces:**
- Consumes: `api.schedule.bulkFill(from, to): Promise<{ created: number }>` (Task 3)、`refreshSchedule()` (既存, `src/app/admin/page.tsx:99-101`)

- [ ] **Step 1: 一括入力の状態とハンドラを追加**

`src/app/admin/page.tsx:74-75` (`isUpdating`/`exporting` の宣言の直後)に追記:

```typescript
  const [bulkFilling, setBulkFilling] = useState(false);
  const [bulkFillMessage, setBulkFillMessage] = useState("");
```

`src/app/admin/page.tsx:126-131` (`handleToggleHoliday` の直後)に追記:

```typescript
  const handleBulkFill = async () => {
    setBulkFilling(true);
    setBulkFillMessage("");
    try {
      const { created } = await api.schedule.bulkFill(rangeStart, rangeEnd);
      await refreshSchedule();
      setBulkFillMessage(
        created > 0
          ? `${created}件のシフトを追加しました`
          : "追加できるシフトはありませんでした"
      );
      setTimeout(() => setBulkFillMessage(""), 3000);
    } finally {
      setBulkFilling(false);
    }
  };
```

- [ ] **Step 2: Excel出力ボタンの隣に「一括入力」ボタンを追加**

`src/app/admin/page.tsx:158-184` の Excel出力ボタン(`</button>` で終わる箇所、164行目付近)の直前に追加:

```tsx
          <button
            onClick={handleBulkFill}
            disabled={bulkFilling}
            className="btn-secondary px-3 py-2 text-sm flex items-center gap-1.5 disabled:opacity-40"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            {bulkFilling ? "入力中..." : "一括入力"}
          </button>
```

- [ ] **Step 3: 結果メッセージのトーストを表示**

`src/app/admin/page.tsx:227-232` (`isUpdating` のトースト表示の直後)に追記:

```tsx
      {bulkFillMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] glass-card px-4 py-2 border-success/50 bg-success/10 flex items-center gap-3 shadow-glow rounded-full">
          <svg className="w-4 h-4 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span className="text-sm font-medium text-success">{bulkFillMessage}</span>
        </div>
      )}
```

- [ ] **Step 4: 動作確認**

Run: `npm run dev`
- `/admin/members` で数名のメンバーに基本シフト時間を設定する
- `/admin` に戻り、翌月など未来の月を表示して「一括入力」を押す
- 「◯件のシフトを追加しました」というメッセージが表示され、基本時間を設定したメンバーの空欄が埋まることを確認
- 既にシフトが入っている日・休日に設定した日・希望休/有給がある日には影響がないことを確認
- もう一度「一括入力」を押すと「追加できるシフトはありませんでした」と表示され、重複作成されないことを確認

- [ ] **Step 5: 型チェックとテスト**

Run: `npx tsc --noEmit && npm test`
Expected: エラーなし、全テストPASS

- [ ] **Step 6: コミット**

```bash
git add src/app/admin/page.tsx
git commit -m "feat: add bulk-fill button to admin board"
```
