"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import { api } from "@/lib/api";
import type { LeaveType } from "@/types";

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

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00Z");
  return {
    day: d.getUTCDate(),
    weekday: d.toLocaleDateString("ja-JP", { weekday: "short", timeZone: "UTC" }),
    dow: d.getUTCDay(),
  };
}

const LEAVE_LABELS: Record<LeaveType, string> = {
  PREFERRED_OFF: "希望休",
  PAID_LEAVE: "有給",
};

const LEAVE_STYLES: Record<LeaveType, string> = {
  PREFERRED_OFF: "bg-sky-500/15 text-sky-400 border-sky-500/30",
  PAID_LEAVE: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
};

export default function MyShiftsPage() {
  const { data: session } = useSession();
  const userId = session?.user?.id;

  const [ym, setYm] = useState(currentYM);
  const { start, end } = monthRange(ym);
  const today = new Date().toLocaleDateString("sv-SE");

  const { data: shifts, mutate: mutateShifts } = useSWR(
    userId ? ["my-shifts", userId, start, end] : null,
    () => api.shifts.my(start, end)
  );
  const { data: leaves, mutate: mutateLeaves } = useSWR(
    userId ? ["my-leaves", userId, start, end] : null,
    () => api.leave.list(start, end)
  );
  const { data: scheduleDays } = useSWR(
    userId ? ["schedule-days-member", start, end] : null,
    () => api.schedule.days(start, end)
  );

  const refresh = async () => { await Promise.all([mutateShifts(), mutateLeaves()]); };
  const [loadingDate, setLoadingDate] = useState<string | null>(null);

  const handleSetLeave = async (date: string, type: LeaveType) => {
    setLoadingDate(date);
    try { await api.leave.set(date, type); await refresh(); }
    finally { setLoadingDate(null); }
  };

  const handleCancelLeave = async (id: string, date: string) => {
    setLoadingDate(date);
    try { await api.leave.cancel(id); await refresh(); }
    finally { setLoadingDate(null); }
  };

  const dates = allDatesInRange(start, end);

  return (
    <div className="max-w-lg mx-auto px-4 pb-20 animate-fade-in">
      <div className="mb-6 pt-2">
        <h1 className="text-2xl font-extrabold mb-1 tracking-tight">My Shifts</h1>
        <p className="text-textMuted text-sm">シフト確認・希望休・有給の登録</p>
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
      <div className="flex flex-col gap-2 animate-slide-up">
        {dates.map((date) => {
          const shift = shifts?.find((s) => (s.scheduleDay?.date ?? "").slice(0, 10) === date);
          const leave = leaves?.find((l) => (typeof l.date === "string" ? l.date : new Date(l.date).toISOString()).slice(0, 10) === date);
          const schedDay = scheduleDays?.find((d) => (typeof d.date === "string" ? d.date : new Date(d.date).toISOString()).slice(0, 10) === date);
          const isHoliday = schedDay?.isHoliday ?? false;
          const isToday = date === today;
          const isLoading = loadingDate === date;
          const { day, weekday, dow } = formatDate(date);
          const isSun = dow === 0;
          const isSat = dow === 6;

          return (
            <div key={date}
              className={`glass-card px-4 py-3 flex items-center gap-3 transition-all
                ${isToday ? "border-accent/50 bg-accent/5" : ""}
                ${isHoliday ? "border-red-500/20 bg-red-950/10 opacity-60" : ""}
              `}>
              {/* Date */}
              <div className="w-10 shrink-0 text-center">
                <div className={`text-xl font-black leading-none
                  ${isHoliday ? "text-red-400/70"
                  : isToday ? "text-accent"
                  : isSun ? "text-red-400"
                  : isSat ? "text-sky-400"
                  : "text-foreground"}`}>
                  {day}
                </div>
                <div className={`text-[10px] font-semibold mt-0.5
                  ${isHoliday ? "text-red-400/50"
                  : isToday ? "text-accent/70"
                  : isSun ? "text-red-400/70"
                  : isSat ? "text-sky-400/70"
                  : "text-textMuted"}`}>
                  {weekday}
                </div>
              </div>

              {/* Status */}
              <div className="flex-1 min-w-0">
                {isHoliday && (
                  <span className="text-[11px] font-bold text-red-400/60 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-full">
                    休日
                  </span>
                )}
                {!isHoliday && shift && !leave && (
                  <span className="px-2.5 py-1 rounded-full bg-accent/10 text-accent text-sm font-bold border border-accent/20">
                    {shift.startTime} – {shift.endTime}
                  </span>
                )}
                {!isHoliday && leave && (
                  <span className={`px-2.5 py-1 rounded-full text-sm font-bold border ${LEAVE_STYLES[leave.type]}`}>
                    {LEAVE_LABELS[leave.type]}
                  </span>
                )}
                {!isHoliday && !shift && !leave && (
                  <span className="text-textMuted/30 text-sm">—</span>
                )}
              </div>

              {/* Actions */}
              {!isHoliday && (
                <div className="flex items-center gap-1.5 shrink-0">
                  {leave ? (
                    <button onClick={() => handleCancelLeave(leave.id, date)} disabled={isLoading}
                      className="px-3 py-1.5 rounded-lg bg-white/5 border border-border/50 text-textMuted hover:text-foreground text-xs font-bold transition-colors disabled:opacity-40 min-h-[36px]">
                      {isLoading ? "…" : "取消"}
                    </button>
                  ) : (
                    <>
                      <button onClick={() => handleSetLeave(date, "PREFERRED_OFF")} disabled={isLoading}
                        className="px-3 py-1.5 rounded-lg bg-sky-500/10 border border-sky-500/30 text-sky-400 hover:bg-sky-500/20 text-xs font-bold transition-colors disabled:opacity-40 min-h-[36px]">
                        {isLoading ? "…" : "希望休"}
                      </button>
                      <button onClick={() => handleSetLeave(date, "PAID_LEAVE")} disabled={isLoading}
                        className="px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 text-xs font-bold transition-colors disabled:opacity-40 min-h-[36px]">
                        {isLoading ? "…" : "有給"}
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
