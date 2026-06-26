"use client";

import { useDraggable, useDroppable } from "@dnd-kit/core";
import type { ScheduleDay, User } from "@/types";

interface AdminBoardProps {
  days: ScheduleDay[];
  users: User[];
  organizationId: string;
  onUpdateMinRequired: (date: string, minRequired: number) => Promise<void>;
  onRefresh: () => Promise<void>;
}

function formatDate(d: string) {
  const dt = new Date(d);
  return {
    monthDay: dt.toLocaleDateString("ja-JP", { month: "numeric", day: "numeric", timeZone: "UTC" }),
    weekday: dt.toLocaleDateString("ja-JP", { weekday: "short", timeZone: "UTC" })
  };
}

function DraggableCard({
  id,
  assignmentId,
  userName,
  startTime,
  endTime,
}: {
  id: string;
  assignmentId: string;
  userName: string;
  startTime: string;
  endTime: string;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id,
    data: { assignmentId },
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`glass-card p-3 mb-3 cursor-grab flex flex-col gap-1.5 hover:border-accent/50 group relative
        ${isDragging ? "opacity-90 ring-2 ring-accent shadow-[0_10px_40px_rgba(99,102,241,0.3)] scale-[1.02] z-50 rotate-1" : ""}
      `}
      style={{ touchAction: 'none' }}
    >
      {/* Visual drag handle indicator */}
      <div className="absolute left-2 top-0 bottom-0 w-1 flex flex-col justify-center gap-[2px] opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="w-1 h-1 rounded-full bg-textMuted/40"></div>
        <div className="w-1 h-1 rounded-full bg-textMuted/40"></div>
        <div className="w-1 h-1 rounded-full bg-textMuted/40"></div>
      </div>

      <div className="pl-2 font-semibold text-sm text-foreground truncate select-none">{userName}</div>
      <div className="pl-2 flex items-center gap-2">
        <div className="px-2 py-0.5 rounded-full bg-accent/10 text-accent text-[11px] font-bold tracking-wide select-none">
          {startTime} - {endTime}
        </div>
      </div>
    </div>
  );
}

function DayColumn({
  date,
  minRequired,
  assignments,
  users,
  onUpdateMinRequired,
  onRefresh,
}: {
  date: string;
  minRequired: number;
  assignments: ScheduleDay["shiftAssignments"];
  users: User[];
  onUpdateMinRequired: (date: string, minRequired: number) => Promise<void>;
  onRefresh: () => Promise<void>;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `day-${date}`,
    data: { date },
  });
  const uniqueCount = new Set(assignments.map((a) => a.userId)).size;
  const insufficient = uniqueCount < minRequired;
  const formattedDate = formatDate(date);

  return (
    <div
      ref={setNodeRef}
      className={`flex-1 min-w-[200px] max-w-[280px] rounded-2xl border transition-all duration-300 flex flex-col overflow-hidden
        ${isOver ? "bg-accent/5 border-accent shadow-[0_0_30px_rgba(99,102,241,0.15)] scale-[1.01]" :
          insufficient ? "bg-surface/40 border-warn/30" : "bg-surface/30 border-border"
        }`}
    >
      {/* Column Header */}
      <div className={`p-4 border-b ${insufficient ? 'border-warn/20 bg-warn/5' : 'border-border/50 bg-black/20'}`}>
        <div className="flex items-end justify-between mb-3">
          <div className="flex items-center gap-1.5">
            <span className={`text-xl font-bold tracking-tight ${insufficient ? 'text-warn' : 'text-foreground'}`}>
              {formattedDate.monthDay}
            </span>
            <span className={`text-xs font-medium uppercase ${insufficient ? 'text-warn/80' : 'text-textMuted'}`}>
              {formattedDate.weekday}
            </span>
          </div>

          <div className="flex flex-col items-end">
            <span className="text-[10px] text-textMuted uppercase font-semibold mb-1">最低人数</span>
            <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md border ${insufficient ? 'border-warn/50' : 'border-transparent hover:border-border transition-colors'} bg-black/30`}>
              <button
                className="w-5 h-5 flex items-center justify-center text-textMuted hover:text-white rounded hover:bg-white/10"
                onClick={() => { if(minRequired > 0) onUpdateMinRequired(date, minRequired - 1) }}
              >-</button>
              <span className="text-sm font-mono w-4 text-center">{minRequired}</span>
              <button
                className="w-5 h-5 flex items-center justify-center text-textMuted hover:text-white rounded hover:bg-white/10"
                onClick={() => onUpdateMinRequired(date, minRequired + 1)}
              >+</button>
            </div>
          </div>
        </div>

        {/* Status bar/warning */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            {Array.from({ length: Math.max(minRequired, uniqueCount, 1) }).map((_, i) => (
               <div key={i} className={`w-1.5 h-1.5 rounded-full ${i < uniqueCount ? 'bg-success' : 'bg-border'}`}></div>
            ))}
          </div>
          {insufficient && minRequired > 0 && (
            <span className="text-[10px] font-bold text-warn bg-warn/10 px-2 py-0.5 rounded-full animate-pulse">
              {uniqueCount} / {minRequired} 定員割れ
            </span>
          )}
        </div>
      </div>

      {/* Cards Container */}
      <div className="p-3 flex-1 min-h-[12rem] bg-gradient-to-b from-transparent to-black/10">
        {users.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-textMuted/30 pt-8 pb-4">
            <svg className="w-8 h-8 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
            <span className="text-xs font-medium">ユーザーがいません</span>
          </div>
        ) : (
          <div className="flex flex-col">
            {users.map((u) => {
              const a = assignments.find((a) => a.userId === u.id);
              if (a) {
                return (
                  <DraggableCard
                    key={a.id}
                    id={a.id}
                    assignmentId={a.id}
                    userName={u.name}
                    startTime={a.startTime}
                    endTime={a.endTime}
                  />
                );
              }
              return (
                <div
                  key={u.id}
                  className="mb-3 px-3 py-2.5 rounded-lg border border-border/20 bg-black/10 flex items-center justify-between"
                >
                  <span className="text-sm text-textMuted/70 truncate">{u.name}</span>
                  <span className="text-[10px] text-textMuted/40 bg-white/5 border border-white/5 px-1.5 py-0.5 rounded-full shrink-0 ml-2">休み</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export function AdminBoard({
  days,
  users,
  organizationId,
  onUpdateMinRequired,
  onRefresh,
}: AdminBoardProps) {
  if (days.length === 0) {
    return (
      <div className="glass-card p-12 mt-8 text-center border-dashed items-center flex flex-col justify-center">
        <svg className="w-16 h-16 text-textMuted/40 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
        <h3 className="text-xl font-bold mb-2">スケジュールがありません</h3>
        <p className="text-textMuted">
          指定された期間にシフトデータが見つかりません。<br/>上部のフォームから新しいシフトを追加してください。
        </p>
      </div>
    );
  }

  return (
    <div className="flex overflow-x-auto pb-8 pt-4 gap-4 snap-x" style={{ scrollbarWidth: 'thin' }}>
      {days.map((d) => (
        <DayColumn
          key={d.id}
          date={(typeof d.date === "string" ? d.date : new Date(d.date).toISOString()).slice(0, 10)}
          minRequired={d.minRequired}
          assignments={d.shiftAssignments ?? []}
          users={users}
          onUpdateMinRequired={onUpdateMinRequired}
          onRefresh={onRefresh}
        />
      ))}
    </div>
  );
}
