import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { z } from "zod";
import type { TimeGap, LaborViolation } from "@/types";

const daysQuerySchema = z.object({
  from: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  to: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
});

function toMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function toTimeStr(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

function shiftDuration(start: string, end: string): number {
  const s = toMinutes(start);
  let e = toMinutes(end);
  if (e <= s) e += 24 * 60; // midnight crossing
  return e - s;
}

function getISOWeekStart(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00Z");
  const day = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() + (day === 0 ? -6 : 1 - day));
  return d.toISOString().slice(0, 10);
}

function detectGapsForSession(
  shifts: { startTime: string; endTime: string }[],
  openTime: string,
  closeTime: string
): TimeGap[] {
  const open = toMinutes(openTime);
  const close = toMinutes(closeTime);
  if (open >= close) return [];

  const intervals = shifts
    .map((s) => [toMinutes(s.startTime), toMinutes(s.endTime)] as [number, number])
    .filter(([s, e]) => s < close && e > open)
    .map(([s, e]) => [Math.max(s, open), Math.min(e, close)] as [number, number])
    .sort((a, b) => a[0] - b[0]);

  const merged: [number, number][] = [];
  for (const [s, e] of intervals) {
    if (merged.length === 0 || s > merged[merged.length - 1][1]) {
      merged.push([s, e]);
    } else {
      merged[merged.length - 1][1] = Math.max(merged[merged.length - 1][1], e);
    }
  }

  const gaps: TimeGap[] = [];
  let cursor = open;
  for (const [s, e] of merged) {
    if (s > cursor) gaps.push({ start: toTimeStr(cursor), end: toTimeStr(s) });
    cursor = Math.max(cursor, e);
    if (cursor >= close) break;
  }
  if (cursor < close) gaps.push({ start: toTimeStr(cursor), end: toTimeStr(close) });

  return gaps;
}

function detectGaps(
  shifts: { startTime: string; endTime: string }[],
  openTime: string,
  closeTime: string,
  openTime2?: string | null,
  closeTime2?: string | null
): TimeGap[] {
  const gaps1 = detectGapsForSession(shifts, openTime, closeTime);
  const gaps2 = openTime2 && closeTime2
    ? detectGapsForSession(shifts, openTime2, closeTime2)
    : [];
  return [...gaps1, ...gaps2];
}

type UserShiftRecord = {
  name: string;
  shifts: { date: string; startTime: string; endTime: string }[];
};

function checkLaborViolations(userShifts: Map<string, UserShiftRecord>): LaborViolation[] {
  const violations: LaborViolation[] = [];

  for (const [userId, { name, shifts }] of userShifts) {
    const sorted = [...shifts].sort((a, b) => a.date.localeCompare(b.date));
    const dates = sorted.map((s) => s.date);

    // 連続勤務チェック（7日以上で違反）
    if (dates.length >= 7) {
      let runStart = 0;
      let runLen = 1;
      for (let i = 1; i < dates.length; i++) {
        const diffDays =
          (new Date(dates[i] + "T00:00:00Z").getTime() -
            new Date(dates[i - 1] + "T00:00:00Z").getTime()) /
          86400000;
        if (diffDays === 1) {
          runLen++;
        } else {
          if (runLen >= 7) {
            violations.push({
              userId,
              userName: name,
              type: "CONSECUTIVE_DAYS",
              detail: `${dates[runStart]} から ${runLen} 日連続出勤`,
            });
          }
          runStart = i;
          runLen = 1;
        }
      }
      if (runLen >= 7) {
        violations.push({
          userId,
          userName: name,
          type: "CONSECUTIVE_DAYS",
          detail: `${dates[runStart]} から ${runLen} 日連続出勤`,
        });
      }
    }

    // 週40時間超チェック（ISO週：月〜日）
    const weekMinutes = new Map<string, number>();
    for (const s of sorted) {
      const weekStart = getISOWeekStart(s.date);
      weekMinutes.set(weekStart, (weekMinutes.get(weekStart) ?? 0) + shiftDuration(s.startTime, s.endTime));
    }
    for (const [weekStart, total] of weekMinutes) {
      if (total > 40 * 60) {
        const hours = (total / 60).toFixed(1);
        violations.push({
          userId,
          userName: name,
          type: "WEEKLY_HOURS",
          detail: `${weekStart} 週: 週 ${hours} 時間（法定40時間超）`,
        });
      }
    }
  }

  return violations;
}

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { organizationId } = session.user;

    const { searchParams } = new URL(request.url);
    const params = Object.fromEntries(searchParams.entries());
    const { from, to } = daysQuerySchema.parse(params);

    const [org, days] = await Promise.all([
      prisma.organization.findUnique({
        where: { id: organizationId },
        select: { openTime: true, closeTime: true, openTime2: true, closeTime2: true },
      }),
      prisma.scheduleDay.findMany({
        where: { organizationId, date: { gte: new Date(from), lte: new Date(to) } },
        orderBy: { date: "asc" },
        include: {
          shiftAssignments: {
            include: { user: { select: { name: true } } },
          },
        },
      }),
    ]);

    // スタッフ充足・カバレッジ警告
    const staffWarnings = days
      .filter((d) => !d.isHoliday)
      .map((d) => {
        const uniqueCount = new Set(d.shiftAssignments.map((a) => a.userId)).size;
        const insufficient = uniqueCount < d.minRequired;

        const effectiveOpen = d.openTime ?? org?.openTime ?? null;
        const effectiveClose = d.closeTime ?? org?.closeTime ?? null;
        const effectiveOpen2 = d.openTime2 ?? org?.openTime2 ?? null;
        const effectiveClose2 = d.closeTime2 ?? org?.closeTime2 ?? null;
        const gaps =
          effectiveOpen && effectiveClose
            ? detectGaps(d.shiftAssignments, effectiveOpen, effectiveClose, effectiveOpen2, effectiveClose2)
            : [];

        return {
          date: d.date,
          minRequired: d.minRequired,
          assignedCount: uniqueCount,
          insufficient,
          ...(effectiveOpen ? { openTime: effectiveOpen } : {}),
          ...(effectiveClose ? { closeTime: effectiveClose } : {}),
          gaps,
        };
      })
      .filter((w) => w.insufficient || w.gaps.length > 0);

    // 労務違反チェック
    const userShifts = new Map<string, UserShiftRecord>();
    for (const day of days) {
      const dateStr = (day.date as Date).toISOString().slice(0, 10);
      for (const a of day.shiftAssignments) {
        if (!userShifts.has(a.userId)) {
          userShifts.set(a.userId, { name: a.user.name, shifts: [] });
        }
        userShifts.get(a.userId)!.shifts.push({
          date: dateStr,
          startTime: a.startTime,
          endTime: a.endTime,
        });
      }
    }
    const laborViolations = checkLaborViolations(userShifts);

    return NextResponse.json({ staffWarnings, laborViolations });
  } catch (error) {
    console.error("GET /api/schedule/warnings error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation Error", details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
