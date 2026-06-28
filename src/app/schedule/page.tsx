"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import { api } from "@/lib/api";
import type { User, ScheduleDay } from "@/types";

function currentYM() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthRange(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  return { start: `${ym}-01`, end: `${ym}-${String(lastDay).padStart(2, "0")}` };
}

function shiftYM(ym: string, delta: number) {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function allDatesInRange(start: string, end: string) {
  const dates: string[] = [];
  const cur = new Date(start + "T00:00:00Z");
  const last = new Date(end + "T00:00:00Z");
  while (cur <= last) {
    dates.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return dates;
}

function formatDate(d: string) {
  const dt = new Date(d + "T00:00:00Z");
  return {
    monthDay: dt.toLocaleDateString("ja-JP", { month: "numeric", day: "numeric", timeZone: "UTC" }),
    weekday: dt.toLocaleDateString("ja-JP", { weekday: "short", timeZone: "UTC" }),
    dow: dt.getUTCDay(),
  };
}

function buildFullDays(start: string, end: string, daysData: ScheduleDay[]): ScheduleDay[] {
  const map = new Map(daysData.map((d) => [
    (typeof d.date === "string" ? d.date : new Date(d.date).toISOString()).slice(0, 10),
    d,
  ]));
  return allDatesInRange(start, end).map((date) =>
    map.get(date) ?? {
      id: `empty-${date}`,
      date,
      minRequired: 1,
      isHoliday: false,
      openTime: null,
      closeTime: null,
      openTime2: null,
      closeTime2: null,
      shiftAssignments: [],
      leaveRecords: [],
    }
  );
}

export default function SchedulePage() {
  const { data: session } = useSession();
  const organizationId = session?.user?.organizationId ?? "";
  const currentUserId = session?.user?.id ?? "";

  const [ym, setYm] = useState(currentYM);
  const { start, end } = monthRange(ym);
  const today = new Date().toLocaleDateString("sv-SE");

  const { data: users } = useSWR(
    organizationId ? ["users", organizationId] : null,
    () => api.users.list()
  );

  const { data: daysData } = useSWR(
    organizationId ? ["scheduleDays", organizationId, start, end] : null,
    () => api.schedule.days(start, end)
  );

  const days = daysData ? buildFullDays(start, end, daysData) : [];

  return (
    <div className="max-w-lg mx-auto px-4 pb-20 animate-fade-in">
      <div className="mb-6 pt-2">
        <h1 className="text-2xl font-extrabold mb-1 tracking-tight">シフト一覧</h1>
        <p className="text-textMuted text-sm">スタッフのシフトスケジュールを確認できます。</p>
      </div>

      {/* Month picker */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => setYm(shiftYM(ym, -1))}
          className="w-10 h-10 flex items-center justify-center rounded-xl bg-black/30 border border-border/50 text-textMuted hover:text-foreground hover:border-textMuted font-bold transition-colors">
          ←
        </button>
        <input type="month" value={ym} onChange={(e) => setYm(e.target.value)}
          className="bg-black/40 border border-border/50 rounded-xl px-4 py-2 text-sm font-semibold text-foreground focus:outline-none focus:border-accent hover:border-textMuted transition-colors text-center" />
        <button onClick={() => setYm(shiftYM(ym, 1))}
          className="w-10 h-10 flex items-center justify-center rounded-xl bg-black/30 border border-border/50 text-textMuted hover:text-foreground hover:border-textMuted font-bold transition-colors">
          →
        </button>
      </div>

      {/* Day list */}
      <div className="flex flex-col gap-3 animate-slide-up">
        {days.map((d) => {
          const date = (typeof d.date === "string" ? d.date : new Date(d.date).toISOString()).slice(0, 10);
          const { monthDay, weekday, dow } = formatDate(date);
          const isHoliday = d.isHoliday ?? false;
          const isToday = date === today;
          const isSun = dow === 0;
          const isSat = dow === 6;
          const hasAnyShift = (d.shiftAssignments?.length ?? 0) > 0;

          if (!hasAnyShift && !isToday && !isHoliday) {
            return (
              <div key={d.id} className="flex items-center gap-3 px-1">
                <div className={`w-10 text-center shrink-0`}>
                  <div className={`text-base font-black leading-none
                    ${isSun ? "text-red-400" : isSat ? "text-sky-400" : "text-foreground/40"}`}>
                    {monthDay.replace(/\d+\//, "")}
                  </div>
                  <div className={`text-[10px] font-semibold mt-0.5
                    ${isSun ? "text-red-400/60" : isSat ? "text-sky-400/60" : "text-textMuted/30"}`}>
                    {weekday}
                  </div>
                </div>
                <div className="flex-1 h-px bg-border/20"></div>
              </div>
            );
          }

          return (
            <div key={d.id}
              className={`glass-card overflow-hidden transition-all
                ${isToday ? "border-accent/50 bg-accent/5" : ""}
                ${isHoliday ? "border-red-500/20 bg-red-950/10" : ""}
              `}>
              {/* Day header */}
              <div className={`px-4 py-2.5 flex items-center gap-2 border-b
                ${isToday ? "border-accent/20 bg-accent/10"
                : isHoliday ? "border-red-500/15 bg-red-950/20"
                : isSun ? "border-red-500/15 bg-red-950/10"
                : isSat ? "border-sky-500/15 bg-sky-950/10"
                : "border-border/30 bg-black/10"}`}>
                <span className={`text-base font-black
                  ${isHoliday ? "text-red-400/70"
                  : isToday ? "text-accent"
                  : isSun ? "text-red-400"
                  : isSat ? "text-sky-400"
                  : "text-foreground"}`}>
                  {monthDay}
                </span>
                <span className={`text-xs font-semibold
                  ${isHoliday ? "text-red-400/50"
                  : isToday ? "text-accent/70"
                  : isSun ? "text-red-400/70"
                  : isSat ? "text-sky-400/70"
                  : "text-textMuted"}`}>
                  {weekday}
                </span>
                {isToday && !isHoliday && (
                  <span className="ml-auto text-[10px] font-bold text-accent bg-accent/15 border border-accent/30 px-1.5 py-0.5 rounded-full">今日</span>
                )}
                {isHoliday && (
                  <span className="ml-auto text-[10px] font-bold text-red-400 bg-red-500/15 border border-red-500/30 px-1.5 py-0.5 rounded-full">休日</span>
                )}
              </div>

              {/* Staff rows */}
              <div className="divide-y divide-border/20">
                {(users ?? []).map((u: User) => {
                  const a = d.shiftAssignments?.find((sa) => sa.userId === u.id);
                  const leave = d.leaveRecords?.find((l) => l.userId === u.id);
                  const isMe = u.id === currentUserId;

                  return (
                    <div key={u.id}
                      className={`px-4 py-2.5 flex items-center gap-3
                        ${isMe ? "bg-accent/5" : ""}`}>
                      <span className={`text-sm font-semibold w-24 shrink-0 truncate
                        ${isMe ? "text-accent" : "text-foreground"}`}>
                        {u.name}
                      </span>
                      {a ? (
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold border border-transparent
                          ${isMe ? "bg-accent/10 text-accent" : "bg-white/5 text-textMuted"}`}>
                          {a.startTime} – {a.endTime}
                        </span>
                      ) : leave ? (
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold border
                          ${leave.type === "PAID_LEAVE"
                            ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                            : "bg-sky-500/15 text-sky-400 border-sky-500/30"
                          }`}>
                          {leave.type === "PAID_LEAVE" ? "有給" : "希望休"}
                        </span>
                      ) : (
                        <span className="text-textMuted/30 text-xs">—</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
