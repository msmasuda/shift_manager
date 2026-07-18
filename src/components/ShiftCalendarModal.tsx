"use client";

import { useEffect } from "react";
import type { ScheduleDay } from "@/types";
import { ShiftCalendar } from "./ShiftCalendar";

export function ShiftCalendarModal({
  open,
  onClose,
  yearMonth,
  days,
}: {
  open: boolean;
  onClose: () => void;
  yearMonth: string;
  days: ScheduleDay[];
}) {
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="calendar-preview-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="glass-card flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden border-accent/30 shadow-2xl">
        <div className="flex items-center justify-between border-b border-border/50 px-5 py-4">
          <div>
            <h2 id="calendar-preview-title" className="text-lg font-extrabold">カレンダープレビュー</h2>
            <p className="mt-0.5 text-xs text-textMuted">{yearMonth.replace("-", "年")}月のシフト</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-xl text-textMuted hover:bg-white/10 hover:text-white"
            aria-label="プレビューを閉じる"
          >
            ×
          </button>
        </div>
        <div className="overflow-y-auto p-4">
          <ShiftCalendar yearMonth={yearMonth} days={days} />
        </div>
      </div>
    </div>
  );
}
