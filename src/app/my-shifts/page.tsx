"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import { api } from "@/lib/api";
import type { LeaveType } from "@/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

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
    <div className="max-w-md mx-auto pb-20">
      {/* Page title */}
      <div className="mb-5">
        <h1 className="text-2xl font-extrabold tracking-tight">My Shifts</h1>
        <p className="text-sm text-muted-foreground mt-0.5">シフト確認・希望休・有給の登録</p>
      </div>

      {/* Month picker */}
      <div className="flex items-center gap-2 mb-5">
        <Button variant="outline" size="icon" onClick={() => setYm(shiftYM(ym, -1))}>←</Button>
        <input
          type="month"
          value={ym}
          onChange={(e) => setYm(e.target.value)}
          className="flex-1 h-8 rounded-lg border border-border bg-transparent px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring text-center"
        />
        <Button variant="outline" size="icon" onClick={() => setYm(shiftYM(ym, 1))}>→</Button>
      </div>

      {/* Day list */}
      <div className="flex flex-col gap-2">
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
            <Card
              key={date}
              size="sm"
              className={`${isToday ? "ring-accent/50 bg-accent/5" : ""} ${isHoliday ? "opacity-50" : ""}`}
            >
              <CardContent className="flex items-center gap-3 py-3">
                {/* Date */}
                <div className="w-10 shrink-0 text-center">
                  <div className={`text-xl font-black leading-none
                    ${isHoliday ? "text-muted-foreground"
                    : isToday ? "text-accent"
                    : isSun ? "text-red-400"
                    : isSat ? "text-sky-400"
                    : "text-foreground"}`}>
                    {day}
                  </div>
                  <div className={`text-[10px] font-semibold mt-0.5
                    ${isHoliday ? "text-muted-foreground/60"
                    : isToday ? "text-accent/70"
                    : isSun ? "text-red-400/70"
                    : isSat ? "text-sky-400/70"
                    : "text-muted-foreground"}`}>
                    {weekday}
                  </div>
                </div>

                <Separator orientation="vertical" className="h-10" />

                {/* Status */}
                <div className="flex-1 min-w-0">
                  {isHoliday && (
                    <Badge variant="destructive" className="text-[10px]">休日</Badge>
                  )}
                  {!isHoliday && shift && !leave && (
                    <Badge variant="outline" className="text-accent border-accent/30 bg-accent/10 font-bold">
                      {shift.startTime} – {shift.endTime}
                    </Badge>
                  )}
                  {!isHoliday && leave && (
                    <Badge
                      variant="outline"
                      className={leave.type === "PAID_LEAVE"
                        ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10 font-bold"
                        : "text-sky-400 border-sky-500/30 bg-sky-500/10 font-bold"}
                    >
                      {leave.type === "PAID_LEAVE" ? "有給" : "希望休"}
                    </Badge>
                  )}
                  {!isHoliday && !shift && !leave && (
                    <span className="text-muted-foreground/30 text-sm">—</span>
                  )}
                </div>

                {/* Actions */}
                {!isHoliday && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    {leave ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCancelLeave(leave.id, date)}
                        disabled={isLoading}
                        className="h-9 px-3 text-xs"
                      >
                        {isLoading ? "…" : "取消"}
                      </Button>
                    ) : (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleSetLeave(date, "PREFERRED_OFF")}
                          disabled={isLoading}
                          className="h-9 px-3 text-xs border-sky-500/30 text-sky-400 bg-sky-500/10 hover:bg-sky-500/20 hover:text-sky-300"
                        >
                          {isLoading ? "…" : "希望休"}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleSetLeave(date, "PAID_LEAVE")}
                          disabled={isLoading}
                          className="h-9 px-3 text-xs border-emerald-500/30 text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 hover:text-emerald-300"
                        >
                          {isLoading ? "…" : "有給"}
                        </Button>
                      </>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
