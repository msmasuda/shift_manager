"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00Z");
  return {
    monthDay: d.toLocaleDateString("ja-JP", { month: "numeric", day: "numeric", timeZone: "UTC" }),
    weekday: d.toLocaleDateString("ja-JP", { weekday: "short", timeZone: "UTC" }),
    dow: d.getUTCDay(),
  };
}

export default function SchedulePage() {
  const { data: session } = useSession();
  const organizationId = session?.user?.organizationId ?? "";
  const currentUserId = session?.user?.id ?? "";

  const [ym, setYm] = useState(currentYM);
  const { start, end } = monthRange(ym);
  const today = new Date().toLocaleDateString("sv-SE");

  const { data: myShifts } = useSWR(
    currentUserId ? ["my-shifts", currentUserId, start, end] : null,
    () => api.shifts.my(start, end)
  );

  const { data: daysData } = useSWR(
    organizationId ? ["scheduleDays", organizationId, start, end] : null,
    () => api.schedule.days(start, end)
  );

  // 自分のシフトがある日だけ、日付順に並べる
  const myShiftDays = (myShifts ?? [])
    .map((shift) => {
      const date = (shift.scheduleDay?.date ?? "").slice(0, 10);
      if (!date) return null;

      const dayData = daysData?.find((d) =>
        (typeof d.date === "string" ? d.date : new Date(d.date).toISOString()).slice(0, 10) === date
      );

      // 一緒に入るメンバー（自分を除く）
      const colleagues = (dayData?.shiftAssignments ?? [])
        .filter((a) => a.userId !== currentUserId)
        .map((a) => a.user?.name ?? "");

      return { date, shift, colleagues };
    })
    .filter(Boolean)
    .sort((a, b) => a!.date.localeCompare(b!.date)) as {
      date: string;
      shift: NonNullable<typeof myShifts>[number];
      colleagues: string[];
    }[];

  return (
    <div className="max-w-md mx-auto pb-20">
      <div className="mb-5">
        <h1 className="text-2xl font-extrabold tracking-tight">シフト一覧</h1>
        <p className="text-sm text-muted-foreground mt-0.5">自分のシフトと一緒に入るメンバー</p>
      </div>

      {/* Month picker */}
      <div className="flex items-center gap-2 mb-5">
        <button
          onClick={() => setYm(shiftYM(ym, -1))}
          className="w-10 h-10 flex items-center justify-center rounded-lg border border-border/50 bg-black/30 text-textMuted hover:text-white hover:border-textMuted font-bold transition-colors"
        >
          ←
        </button>
        <input
          type="month"
          value={ym}
          onChange={(e) => setYm(e.target.value)}
          className="flex-1 h-10 rounded-lg border border-border/50 bg-transparent px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring text-center"
        />
        <button
          onClick={() => setYm(shiftYM(ym, 1))}
          className="w-10 h-10 flex items-center justify-center rounded-lg border border-border/50 bg-black/30 text-textMuted hover:text-white hover:border-textMuted font-bold transition-colors"
        >
          →
        </button>
      </div>

      {/* Shift list */}
      {myShiftDays.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground text-sm">
            この月のシフトはまだありません
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {myShiftDays.map(({ date, shift, colleagues }) => {
            const { monthDay, weekday, dow } = formatDate(date);
            const isToday = date === today;
            const isSun = dow === 0;
            const isSat = dow === 6;

            return (
              <Card
                key={date}
                size="sm"
                className={isToday ? "ring-accent/50 bg-accent/5" : ""}
              >
                <CardContent className="py-3 px-4 flex flex-col gap-2">
                  {/* Date + time */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`text-lg font-black
                        ${isToday ? "text-accent"
                        : isSun ? "text-red-400"
                        : isSat ? "text-sky-400"
                        : "text-foreground"}`}>
                        {monthDay}
                      </span>
                      <span className={`text-xs font-semibold
                        ${isToday ? "text-accent/70"
                        : isSun ? "text-red-400/70"
                        : isSat ? "text-sky-400/70"
                        : "text-muted-foreground"}`}>
                        {weekday}
                      </span>
                      {isToday && (
                        <Badge variant="outline" className="text-accent border-accent/30 bg-accent/10 text-[10px] h-4 px-1.5">
                          今日
                        </Badge>
                      )}
                    </div>
                    <Badge variant="outline" className="text-accent border-accent/30 bg-accent/10 font-bold">
                      {shift.startTime} – {shift.endTime}
                    </Badge>
                  </div>

                  {/* Colleagues */}
                  <Separator className="bg-border/30" />
                  <div className="flex items-center gap-2 min-h-[20px]">
                    <span className="text-xs text-muted-foreground shrink-0">一緒に:</span>
                    {colleagues.length === 0 ? (
                      <span className="text-xs text-muted-foreground/50">1人（自分のみ）</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {colleagues.map((name) => (
                          <Badge key={name} variant="secondary" className="text-[11px] h-5">
                            {name}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
