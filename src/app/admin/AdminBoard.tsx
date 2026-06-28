"use client";

import { useState, useRef } from "react";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { api } from "@/lib/api";
import type { ScheduleDay, User } from "@/types";

interface AdminBoardProps {
  days: ScheduleDay[];
  users: User[];
  organizationId: string;
  orgOpenTime?: string | null;
  orgCloseTime?: string | null;
  orgOpenTime2?: string | null;
  orgCloseTime2?: string | null;
  onUpdateMinRequired: (date: string, minRequired: number) => Promise<void>;
  onUpdateHours: (date: string, openTime: string | null, closeTime: string | null, openTime2: string | null, closeTime2: string | null) => Promise<void>;
  onToggleHoliday: (date: string, isHoliday: boolean) => Promise<void>;
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
  onUpdate,
  onDelete,
}: {
  id: string;
  assignmentId: string;
  userName: string;
  startTime: string;
  endTime: string;
  onUpdate: (startTime: string, endTime: string) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id,
    data: { assignmentId },
  });

  const [isEditing, setIsEditing] = useState(false);
  const [editStart, setEditStart] = useState(startTime);
  const [editEnd, setEditEnd] = useState(endTime);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleting(true);
    try {
      await onDelete();
    } finally {
      setDeleting(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onUpdate(editStart, editEnd);
      setIsEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditStart(startTime);
    setEditEnd(endTime);
    setIsEditing(false);
  };

  return (
    <div
      ref={setNodeRef}
      {...(isEditing ? {} : listeners)}
      {...(isEditing ? {} : attributes)}
      data-testid="shift-card"
      className={`glass-card p-3 mb-3 flex flex-col gap-1.5 hover:border-accent/50 group relative
        ${isEditing ? "cursor-default ring-1 ring-accent/30" : "cursor-grab"}
        ${isDragging ? "opacity-90 ring-2 ring-accent shadow-[0_10px_40px_rgba(99,102,241,0.3)] scale-[1.02] z-50 rotate-1" : ""}
      `}
      style={{ touchAction: 'none' }}
    >
      {/* Drag handle — hidden while editing */}
      {!isEditing && (
        <div className="absolute left-2 top-0 bottom-0 w-1 flex flex-col justify-center gap-[2px] opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="w-1 h-1 rounded-full bg-textMuted/40"></div>
          <div className="w-1 h-1 rounded-full bg-textMuted/40"></div>
          <div className="w-1 h-1 rounded-full bg-textMuted/40"></div>
        </div>
      )}

      {/* Edit / Delete buttons */}
      {!isEditing && (
        <div className="absolute right-2 top-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
          <button
            data-testid="edit-shift-btn"
            className="p-1 rounded hover:bg-white/10 transition-colors"
            onClick={(e) => { e.stopPropagation(); setIsEditing(true); }}
          >
            <svg className="w-3.5 h-3.5 text-textMuted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </button>
          <button
            data-testid="delete-shift-btn"
            className="p-1 rounded hover:bg-red-500/20 transition-colors"
            onClick={handleDelete}
            disabled={deleting}
          >
            <svg className="w-3.5 h-3.5 text-textMuted hover:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      )}

      <div className="pl-2 font-semibold text-sm text-foreground truncate select-none">{userName}</div>

      {isEditing ? (
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-textMuted w-6 shrink-0">開始</span>
              <input
                type="time"
                value={editStart}
                onChange={(e) => setEditStart(e.target.value)}
                className="flex-1 bg-black/40 border border-border/50 rounded px-1.5 py-0.5 text-[11px] text-foreground focus:outline-none focus:border-accent"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-textMuted w-6 shrink-0">終了</span>
              <input
                type="time"
                value={editEnd}
                onChange={(e) => setEditEnd(e.target.value)}
                className="flex-1 bg-black/40 border border-border/50 rounded px-1.5 py-0.5 text-[11px] text-foreground focus:outline-none focus:border-accent"
              />
            </div>
          </div>
          <div className="flex gap-1.5">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 py-1 rounded bg-accent/20 hover:bg-accent/30 text-accent text-[11px] font-bold transition-colors disabled:opacity-50"
            >
              {saving ? "保存中..." : "保存"}
            </button>
            <button
              onClick={handleCancel}
              className="flex-1 py-1 rounded bg-white/5 hover:bg-white/10 text-textMuted text-[11px] font-bold transition-colors"
            >
              キャンセル
            </button>
          </div>
        </div>
      ) : (
        <div className="pl-2 flex items-center gap-2">
          <div className="px-2 py-0.5 rounded-full bg-accent/10 text-accent text-[11px] font-bold tracking-wide select-none">
            {startTime} - {endTime}
          </div>
        </div>
      )}
    </div>
  );
}

function HolidayCard({
  userName,
  defaultStart,
  defaultEnd,
  onAdd,
}: {
  userName: string;
  defaultStart: string;
  defaultEnd: string;
  onAdd: (startTime: string, endTime: string) => Promise<void>;
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [addStart, setAddStart] = useState(defaultStart);
  const [addEnd, setAddEnd] = useState(defaultEnd);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!addStart || !addEnd) return;
    setSaving(true);
    try {
      await onAdd(addStart, addEnd);
      setIsAdding(false);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setAddStart(defaultStart);
    setAddEnd(defaultEnd);
    setIsAdding(false);
  };

  return (
    <div
      data-testid="holiday-card"
      className={`glass-card p-3 mb-3 flex flex-col gap-1.5 transition-all duration-200 ${isAdding ? "opacity-100" : "opacity-40 hover:opacity-70 cursor-pointer"}`}
      onClick={() => { if (!isAdding) setIsAdding(true); }}
    >
      <div className="pl-2 font-semibold text-sm text-foreground truncate">{userName}</div>
      {isAdding ? (
        <>
          <div className="flex flex-col gap-1 px-2">
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-textMuted w-7 shrink-0">開始</span>
              <input
                type="time"
                value={addStart}
                onChange={(e) => setAddStart(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                className="flex-1 min-w-0 bg-black/40 border border-border/50 rounded px-1.5 py-0.5 text-[11px] text-foreground focus:outline-none focus:border-accent"
              />
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-textMuted w-7 shrink-0">終了</span>
              <input
                type="time"
                value={addEnd}
                onChange={(e) => setAddEnd(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                className="flex-1 min-w-0 bg-black/40 border border-border/50 rounded px-1.5 py-0.5 text-[11px] text-foreground focus:outline-none focus:border-accent"
              />
            </div>
          </div>
          <div className="flex gap-1 px-2" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={handleSave}
              disabled={saving || !addStart || !addEnd}
              className="flex-1 py-1 rounded bg-accent/20 hover:bg-accent/30 text-accent text-[10px] font-bold transition-colors disabled:opacity-50"
            >
              {saving ? "追加中..." : "追加"}
            </button>
            <button
              onClick={handleCancel}
              className="flex-1 py-1 rounded bg-white/5 hover:bg-white/10 text-textMuted text-[10px] font-bold transition-colors"
            >
              キャンセル
            </button>
          </div>
        </>
      ) : (
        <div className="pl-2 flex items-center gap-2">
          <div className="px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-textMuted text-[11px] font-bold tracking-wide">
            休み
          </div>
          <svg className="w-3 h-3 text-textMuted/40 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
        </div>
      )}
    </div>
  );
}

function DayColumn({
  date,
  minRequired,
  isHoliday,
  isToday,
  openTime,
  closeTime,
  openTime2,
  closeTime2,
  assignments,
  users,
  onUpdateMinRequired,
  onUpdateHours,
  onToggleHoliday,
  onRefresh,
}: {
  date: string;
  minRequired: number;
  isHoliday: boolean;
  isToday: boolean;
  openTime?: string | null;
  closeTime?: string | null;
  openTime2?: string | null;
  closeTime2?: string | null;
  assignments: ScheduleDay["shiftAssignments"];
  users: User[];
  onUpdateMinRequired: (date: string, minRequired: number) => Promise<void>;
  onUpdateHours: (date: string, openTime: string | null, closeTime: string | null, openTime2: string | null, closeTime2: string | null) => Promise<void>;
  onToggleHoliday: (date: string, isHoliday: boolean) => Promise<void>;
  onRefresh: () => Promise<void>;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `day-${date}`,
    data: { date },
  });
  const [editingHours, setEditingHours] = useState(false);
  const [editOpen, setEditOpen] = useState(openTime ?? "");
  const [editClose, setEditClose] = useState(closeTime ?? "");
  const [editOpen2, setEditOpen2] = useState(openTime2 ?? "");
  const [editClose2, setEditClose2] = useState(closeTime2 ?? "");
  const [savingHours, setSavingHours] = useState(false);
  const [togglingHoliday, setTogglingHoliday] = useState(false);

  const handleToggleHoliday = async () => {
    setTogglingHoliday(true);
    try {
      await onToggleHoliday(date, !isHoliday);
    } finally {
      setTogglingHoliday(false);
    }
  };

  const handleSaveHours = async () => {
    setSavingHours(true);
    try {
      await onUpdateHours(date, editOpen || null, editClose || null, editOpen2 || null, editClose2 || null);
      setEditingHours(false);
    } finally {
      setSavingHours(false);
    }
  };

  const uniqueCount = new Set(assignments.map((a) => a.userId)).size;
  const insufficient = uniqueCount < minRequired;
  const warn = !isHoliday && (insufficient || minRequired === 0);
  const formattedDate = formatDate(date);

  return (
    <div
      ref={setNodeRef}
      className={`flex-1 min-w-[200px] max-w-[280px] rounded-2xl border transition-all duration-300 flex flex-col overflow-hidden
        ${isOver ? "bg-accent/5 border-accent shadow-[0_0_30px_rgba(99,102,241,0.15)] scale-[1.01]" :
          isHoliday ? "bg-red-950/20 border-red-500/30" :
          isToday ? "bg-accent/5 border-accent/50 shadow-[0_0_20px_rgba(99,102,241,0.1)]" :
          warn ? "bg-surface/40 border-warn/30" : "bg-surface/30 border-border"
        }`}
    >
      {/* Column Header */}
      <div className={`p-4 border-b ${isHoliday ? 'border-red-500/20 bg-red-950/30' : isToday ? 'border-accent/20 bg-accent/10' : warn ? 'border-warn/20 bg-warn/5' : 'border-border/50 bg-black/20'}`}>
        <div className="flex items-end justify-between mb-3">
          <div className="flex items-center gap-1.5">
            <span className={`text-xl font-bold tracking-tight ${isHoliday ? 'text-red-400' : isToday ? 'text-accent' : warn ? 'text-warn' : 'text-foreground'}`}>
              {formattedDate.monthDay}
            </span>
            <span className={`text-xs font-medium uppercase ${isHoliday ? 'text-red-400/80' : isToday ? 'text-accent/80' : warn ? 'text-warn/80' : 'text-textMuted'}`}>
              {formattedDate.weekday}
            </span>
            {isToday && !isHoliday && (
              <span className="text-[10px] font-bold text-accent bg-accent/15 border border-accent/30 px-1.5 py-0.5 rounded-full">
                今日
              </span>
            )}
            {isHoliday && (
              <span className="text-[10px] font-bold text-red-400 bg-red-500/15 border border-red-500/30 px-1.5 py-0.5 rounded-full">
                休日
              </span>
            )}
          </div>

          <div className="flex flex-col items-end gap-1.5">
            <button
              onClick={handleToggleHoliday}
              disabled={togglingHoliday}
              title={isHoliday ? "休日を解除" : "休日に設定"}
              className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border transition-all disabled:opacity-50
                ${isHoliday
                  ? "bg-red-500/20 border-red-500/40 text-red-400 hover:bg-red-500/30"
                  : "bg-black/20 border-border/50 text-textMuted hover:border-red-500/40 hover:text-red-400"
                }`}
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {isHoliday ? "休日解除" : "休日設定"}
            </button>
            <div className="flex flex-col items-end">
              <span className="text-[10px] text-textMuted uppercase font-semibold mb-1">最低人数</span>
              <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md border ${warn ? 'border-warn/50' : 'border-transparent hover:border-border transition-colors'} bg-black/30`}>
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
        </div>

        {/* 営業時間 */}
        <div className="mt-2.5">
          {editingHours ? (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-textMuted/60 shrink-0 w-5">昼</span>
                <input type="time" value={editOpen} onChange={e => setEditOpen(e.target.value)}
                  className="flex-1 min-w-0 bg-black/40 border border-border/50 rounded px-1.5 py-0.5 text-[11px] text-foreground focus:outline-none focus:border-accent" />
                <span className="text-textMuted text-[10px] shrink-0">―</span>
                <input type="time" value={editClose} onChange={e => setEditClose(e.target.value)}
                  className="flex-1 min-w-0 bg-black/40 border border-border/50 rounded px-1.5 py-0.5 text-[11px] text-foreground focus:outline-none focus:border-accent" />
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-textMuted/60 shrink-0 w-5">夜</span>
                <input type="time" value={editOpen2} onChange={e => setEditOpen2(e.target.value)}
                  className="flex-1 min-w-0 bg-black/40 border border-border/50 rounded px-1.5 py-0.5 text-[11px] text-foreground focus:outline-none focus:border-accent" />
                <span className="text-textMuted text-[10px] shrink-0">―</span>
                <input type="time" value={editClose2} onChange={e => setEditClose2(e.target.value)}
                  className="flex-1 min-w-0 bg-black/40 border border-border/50 rounded px-1.5 py-0.5 text-[11px] text-foreground focus:outline-none focus:border-accent" />
              </div>
              <div className="flex gap-1">
                <button onClick={handleSaveHours} disabled={savingHours}
                  className="flex-1 py-0.5 rounded bg-accent/20 hover:bg-accent/30 text-accent text-[10px] font-bold transition-colors disabled:opacity-50">
                  {savingHours ? "…" : "保存"}
                </button>
                <button onClick={() => { setEditOpen(openTime ?? ""); setEditClose(closeTime ?? ""); setEditOpen2(openTime2 ?? ""); setEditClose2(closeTime2 ?? ""); setEditingHours(false); }}
                  className="flex-1 py-0.5 rounded bg-white/5 hover:bg-white/10 text-textMuted text-[10px] font-bold transition-colors">
                  取消
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => setEditingHours(true)}
              className="group/hours flex flex-col gap-0.5 text-[10px] text-textMuted/60 hover:text-textMuted transition-colors w-full text-left">
              <div className="flex items-center gap-1.5">
                <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{openTime && closeTime ? `昼 ${openTime}–${closeTime}` : "営業時間 未設定"}</span>
                <svg className="w-2.5 h-2.5 opacity-0 group-hover/hours:opacity-60 transition-opacity ml-auto shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </div>
              {openTime2 && closeTime2 && (
                <div className="pl-4.5 ml-[18px]">夜 {openTime2}–{closeTime2}</div>
              )}
            </button>
          )}
        </div>

        {/* Status bar/warning */}
        {!isHoliday && (
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.max(minRequired, uniqueCount, 1) }).map((_, i) => (
                 <div key={i} className={`w-1.5 h-1.5 rounded-full ${i < uniqueCount ? 'bg-success' : 'bg-border'}`}></div>
              ))}
            </div>
            {minRequired === 0 && (
              <span className="text-[10px] font-bold text-warn bg-warn/10 px-2 py-0.5 rounded-full animate-pulse">
                最低人数 未設定
              </span>
            )}
            {insufficient && minRequired > 0 && (
              <span className="text-[10px] font-bold text-warn bg-warn/10 px-2 py-0.5 rounded-full animate-pulse">
                {uniqueCount} / {minRequired} 定員割れ
              </span>
            )}
          </div>
        )}
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
                    onUpdate={async (startTime, endTime) => {
                      await api.shifts.update(a.id, { startTime, endTime });
                      await onRefresh();
                    }}
                    onDelete={async () => {
                      await api.shifts.delete(a.id);
                      await onRefresh();
                    }}
                  />
                );
              }
              return (
                <HolidayCard
                  key={u.id}
                  userName={u.name}
                  defaultStart={openTime ?? "09:00"}
                  defaultEnd={closeTime ?? "18:00"}
                  onAdd={async (startTime, endTime) => {
                    await api.shifts.create({ date, userId: u.id, startTime, endTime });
                    await onRefresh();
                  }}
                />
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
  orgOpenTime,
  orgCloseTime,
  orgOpenTime2,
  orgCloseTime2,
  onUpdateMinRequired,
  onUpdateHours,
  onToggleHoliday,
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

  const today = new Date().toLocaleDateString("sv-SE"); // YYYY-MM-DD in local time
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleWheel = (e: React.WheelEvent) => {
    if (scrollRef.current && Math.abs(e.deltaX) < Math.abs(e.deltaY)) {
      e.preventDefault();
      scrollRef.current.scrollLeft += e.deltaY;
    }
  };

  return (
    <div
      ref={scrollRef}
      onWheel={handleWheel}
      className="flex overflow-x-auto pb-8 pt-4 gap-4 snap-x"
      style={{ scrollbarWidth: 'thin' }}
    >
      {days.map((d) => {
        const dateStr = (typeof d.date === "string" ? d.date : new Date(d.date).toISOString()).slice(0, 10);
        return (
          <DayColumn
            key={d.id}
            date={dateStr}
            minRequired={d.minRequired}
            isHoliday={d.isHoliday ?? false}
            isToday={dateStr === today}
            openTime={d.openTime ?? orgOpenTime}
            closeTime={d.closeTime ?? orgCloseTime}
            openTime2={d.openTime2 ?? orgOpenTime2}
            closeTime2={d.closeTime2 ?? orgCloseTime2}
            assignments={d.shiftAssignments ?? []}
            users={users}
            onUpdateMinRequired={onUpdateMinRequired}
            onUpdateHours={onUpdateHours}
            onToggleHoliday={onToggleHoliday}
            onRefresh={onRefresh}
          />
        );
      })}
    </div>
  );
}
