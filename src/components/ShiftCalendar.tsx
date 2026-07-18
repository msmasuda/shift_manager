import type { ScheduleDay } from "@/types";
import { buildCalendarCells } from "@/lib/calendar";

function dateKey(date: ScheduleDay["date"]): string {
  return (typeof date === "string" ? date : new Date(date).toISOString()).slice(0, 10);
}

export function ShiftCalendar({
  yearMonth,
  days,
  currentUserId,
}: {
  yearMonth: string;
  days: ScheduleDay[];
  currentUserId?: string;
}) {
  const cells = buildCalendarCells(yearMonth);
  const daysByDate = new Map(days.map((day) => [dateKey(day.date), day]));
  const today = new Date().toLocaleDateString("sv-SE");
  const weekdays = ["日", "月", "火", "水", "木", "金", "土"];

  return (
    <div className="overflow-x-auto rounded-xl border border-border/60 bg-black/20">
      <div className="min-w-[760px]">
        <div className="grid grid-cols-7 border-b border-border/60 bg-white/[0.03]">
          {weekdays.map((weekday, index) => (
            <div
              key={weekday}
              className={`py-2 text-center text-xs font-bold ${
                index === 0 ? "text-red-400" : index === 6 ? "text-sky-400" : "text-textMuted"
              }`}
            >
              {weekday}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((cell, index) => {
            if (!cell) {
              return <div key={`empty-${index}`} className="min-h-32 border-b border-r border-border/30 bg-black/10" />;
            }

            const day = daysByDate.get(cell.date);
            const assignments = day?.shiftAssignments ?? [];
            const isToday = cell.date === today;
            const isHoliday = day?.isHoliday ?? false;
            const weekday = index % 7;

            return (
              <div
                key={cell.date}
                className={`min-h-32 border-b border-r border-border/30 p-2 align-top ${
                  isHoliday ? "bg-red-950/20" : isToday ? "bg-accent/10" : "bg-surface/20"
                }`}
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                    isToday
                      ? "bg-accent text-white"
                      : weekday === 0
                        ? "text-red-400"
                        : weekday === 6
                          ? "text-sky-400"
                          : "text-foreground"
                  }`}>
                    {cell.day}
                  </span>
                  {isHoliday && <span className="text-[9px] font-bold text-red-400">休日</span>}
                </div>

                {!isHoliday && assignments.length > 0 && (
                  <div className="flex flex-col gap-1">
                    {assignments
                      .slice()
                      .sort((a, b) => a.startTime.localeCompare(b.startTime))
                      .map((assignment) => {
                        const isMine = assignment.userId === currentUserId;
                        return (
                          <div
                            key={assignment.id}
                            className={`rounded-md border px-1.5 py-1 text-[10px] leading-tight ${
                              isMine
                                ? "border-accent/50 bg-accent/20 text-accent"
                                : "border-border/50 bg-black/30 text-foreground"
                            }`}
                          >
                            <div className="truncate font-bold">
                              {assignment.user?.name ?? "メンバー"}{isMine ? "（自分）" : ""}
                            </div>
                            <div className="mt-0.5 whitespace-nowrap font-mono text-[9px] opacity-70">
                              {assignment.startTime}–{assignment.endTime}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
