"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import { api } from "@/lib/api";

function dateKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

function formatDate(d: string) {
  const dt = new Date(d);
  return {
    monthDay: dt.toLocaleDateString("ja-JP", { month: "numeric", day: "numeric", timeZone: "UTC" }),
    weekday: dt.toLocaleDateString("ja-JP", { weekday: "short", timeZone: "UTC" }),
  };
}

export default function SchedulePage() {
  const { data: session } = useSession();
  const organizationId = session?.user?.organizationId ?? "";
  const currentUserId = session?.user?.id ?? "";

  const [rangeStart, setRangeStart] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return dateKey(d);
  });
  const [rangeEnd, setRangeEnd] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    d.setDate(0);
    return dateKey(d);
  });

  const { data: daysData } = useSWR(
    organizationId ? ["scheduleDays", organizationId, rangeStart, rangeEnd] : null,
    () => api.schedule.days(rangeStart, rangeEnd)
  );

  return (
    <div className="animate-fade-in pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
        <div>
          <h1 className="text-3xl font-extrabold mb-2 tracking-tight">シフト一覧</h1>
          <p className="text-textMuted">スタッフのシフトスケジュールを確認できます。</p>
        </div>

        <div className="glass-card p-3 flex items-center gap-2 shadow-glass self-start md:self-auto">
          <input
            type="date"
            value={rangeStart}
            onChange={(e) => setRangeStart(e.target.value)}
            className="bg-black/40 border border-border/50 rounded-md px-2 py-1.5 text-sm text-foreground focus:outline-none focus:border-accent hover:border-textMuted transition-colors"
          />
          <span className="text-textMuted text-xs font-bold">―</span>
          <input
            type="date"
            value={rangeEnd}
            onChange={(e) => setRangeEnd(e.target.value)}
            className="bg-black/40 border border-border/50 rounded-md px-2 py-1.5 text-sm text-foreground focus:outline-none focus:border-accent hover:border-textMuted transition-colors"
          />
        </div>
      </div>

      {!daysData || daysData.length === 0 ? (
        <div className="glass-card p-12 mt-8 text-center border-dashed flex flex-col items-center justify-center">
          <svg className="w-16 h-16 text-textMuted/40 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <h3 className="text-xl font-bold mb-2">スケジュールがありません</h3>
          <p className="text-textMuted">指定された期間にシフトデータが見つかりません。</p>
        </div>
      ) : (
        <div className="flex overflow-x-auto pb-8 pt-4 gap-4 snap-x" style={{ scrollbarWidth: "thin" }}>
          {daysData.map((d) => {
            const date = (typeof d.date === "string" ? d.date : new Date(d.date).toISOString()).slice(0, 10);
            const { monthDay, weekday } = formatDate(date);
            const isMyDay = d.shiftAssignments?.some((a) => a.userId === currentUserId);

            return (
              <div
                key={d.id}
                className={`flex-1 min-w-[180px] max-w-[260px] rounded-2xl border flex flex-col overflow-hidden
                  ${isMyDay ? "bg-accent/5 border-accent/40" : "bg-surface/30 border-border"}`}
              >
                <div className={`p-4 border-b ${isMyDay ? "border-accent/20 bg-black/20" : "border-border/50 bg-black/20"}`}>
                  <div className="flex items-end gap-1.5">
                    <span className={`text-xl font-bold tracking-tight ${isMyDay ? "text-accent" : "text-foreground"}`}>
                      {monthDay}
                    </span>
                    <span className={`text-xs font-medium uppercase ${isMyDay ? "text-accent/80" : "text-textMuted"}`}>
                      {weekday}
                    </span>
                  </div>
                  {isMyDay && (
                    <span className="mt-1.5 inline-block text-[10px] font-bold text-accent bg-accent/10 px-2 py-0.5 rounded-full">
                      出勤
                    </span>
                  )}
                </div>

                <div className="p-3 flex-1 min-h-[8rem]">
                  {!d.shiftAssignments || d.shiftAssignments.length === 0 ? (
                    <p className="text-xs text-textMuted/40 text-center pt-6">なし</p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {d.shiftAssignments.map((a) => (
                        <div
                          key={a.id}
                          className={`p-2.5 rounded-lg border
                            ${a.userId === currentUserId
                              ? "bg-accent/10 border-accent/30"
                              : "bg-black/20 border-border/30"
                            }`}
                        >
                          <div className="font-semibold text-sm truncate text-foreground">{a.user?.name ?? "—"}</div>
                          <div className="text-[11px] text-textMuted mt-0.5">{a.startTime} - {a.endTime}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
