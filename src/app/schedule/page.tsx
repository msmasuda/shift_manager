"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import { ShiftCalendar } from "@/components/ShiftCalendar";
import { api } from "@/lib/api";

function currentYM() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthRange(yearMonth: string) {
  const [year, month] = yearMonth.split("-").map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  return {
    start: `${yearMonth}-01`,
    end: `${yearMonth}-${String(lastDay).padStart(2, "0")}`,
  };
}

function shiftYM(yearMonth: string, delta: number) {
  const [year, month] = yearMonth.split("-").map(Number);
  const date = new Date(year, month - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export default function SchedulePage() {
  const { data: session } = useSession();
  const organizationId = session?.user?.organizationId ?? "";
  const currentUserId = session?.user?.id ?? "";
  const [yearMonth, setYearMonth] = useState(currentYM);
  const { start, end } = monthRange(yearMonth);

  const { data: days, isLoading } = useSWR(
    organizationId ? ["scheduleDays", organizationId, start, end] : null,
    () => api.schedule.days(start, end)
  );

  return (
    <div className="pb-20">
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">シフトカレンダー</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">全体のシフトを月間カレンダーで確認できます</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setYearMonth(shiftYM(yearMonth, -1))}
            className="h-10 w-10 rounded-lg border border-border/50 bg-black/30 font-bold text-textMuted hover:text-white"
            aria-label="前の月"
          >
            ←
          </button>
          <input
            type="month"
            value={yearMonth}
            onChange={(event) => setYearMonth(event.target.value)}
            className="h-10 rounded-lg border border-border/50 bg-transparent px-3 text-center text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            onClick={() => setYearMonth(shiftYM(yearMonth, 1))}
            className="h-10 w-10 rounded-lg border border-border/50 bg-black/30 font-bold text-textMuted hover:text-white"
            aria-label="次の月"
          >
            →
          </button>
        </div>
      </div>

      <div className="mb-3 flex items-center gap-2 text-xs text-textMuted">
        <span className="inline-block h-3 w-3 rounded border border-accent/50 bg-accent/20" />
        自分のシフト
      </div>

      {isLoading ? (
        <div className="glass-card py-16 text-center text-sm text-textMuted">読み込み中...</div>
      ) : (
        <ShiftCalendar yearMonth={yearMonth} days={days ?? []} currentUserId={currentUserId} />
      )}
    </div>
  );
}
