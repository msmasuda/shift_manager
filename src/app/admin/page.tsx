"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import type { LaborViolation } from "@/types";
import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { api } from "@/lib/api";
import { AdminBoard } from "./AdminBoard";
import { ShiftCalendarModal } from "@/components/ShiftCalendarModal";

function dateKey(d: Date) {
  return d.toLocaleDateString("sv-SE"); // YYYY-MM-DD in local time
}

function monthRange(ym: string): { start: string; end: string } {
  const [y, m] = ym.split("-").map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  return {
    start: `${ym}-01`,
    end: `${ym}-${String(lastDay).padStart(2, "0")}`,
  };
}

function shiftYM(ym: string, delta: number): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// 表示範囲の全日付を生成し、DBレコードとマージする
function buildFullDays(rangeStart: string, rangeEnd: string, daysData: import("@/types").ScheduleDay[]): import("@/types").ScheduleDay[] {
  const result: import("@/types").ScheduleDay[] = [];
  const map = new Map(daysData.map((d) => [
    (typeof d.date === "string" ? d.date : new Date(d.date).toISOString()).slice(0, 10),
    d,
  ]));
  const cur = new Date(rangeStart + "T00:00:00Z");
  const end = new Date(rangeEnd + "T00:00:00Z");
  while (cur <= end) {
    const key = dateKey(cur);
    result.push(map.get(key) ?? {
      id: `empty-${key}`,
      date: key,
      minRequired: 1,
      isHoliday: false,
      openTime: null,
      closeTime: null,
      openTime2: null,
      closeTime2: null,
      shiftAssignments: [],
      leaveRecords: [],
    });
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return result;
}

export default function AdminPage() {
  const { data: session } = useSession();
  const organizationId = session?.user?.organizationId ?? "";

  const [currentMonth, setCurrentMonth] = useState(() => {
    const d = new Date();
    const thisMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    return shiftYM(thisMonth, 1); // シフトは常に翌月分を組むため、翌月をデフォルト表示にする
  });
  const { start: rangeStart, end: rangeEnd } = monthRange(currentMonth);
  const [isUpdating, setIsUpdating] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [bulkFilling, setBulkFilling] = useState(false);
  const [bulkFillMessage, setBulkFillMessage] = useState("");
  const [bulkFillMenuOpen, setBulkFillMenuOpen] = useState(false);
  const [calendarPreviewOpen, setCalendarPreviewOpen] = useState(false);

  const { data: users } = useSWR(
    organizationId ? ["users", organizationId] : null,
    () => api.users.list()
  );

  const { data: orgData } = useSWR(
    organizationId ? ["org", organizationId] : null,
    () => api.organizations.get(organizationId)
  );

  const { data: daysData, mutate: mutateDays } = useSWR(
    organizationId ? ["scheduleDays", organizationId, rangeStart, rangeEnd] : null,
    () => api.schedule.days(rangeStart, rangeEnd)
  );

  const { data: warningsData, mutate: mutateWarnings } = useSWR(
    organizationId ? ["warnings", organizationId, rangeStart, rangeEnd] : null,
    () => api.schedule.warnings(rangeStart, rangeEnd)
  );
  const laborViolations: LaborViolation[] = warningsData?.laborViolations ?? [];
  const [warningsExpanded, setWarningsExpanded] = useState(true);

  const refreshSchedule = async () => {
    await Promise.all([mutateDays(), mutateWarnings()]);
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over?.data?.current?.date || !organizationId) return;
    const assignmentId = active.data?.current?.assignmentId as string | undefined;
    const targetDate = over.data.current.date as string;
    if (!assignmentId) return;

    setIsUpdating(true);
    try {
      await api.shifts.update(assignmentId, { date: targetDate });
      await refreshSchedule();
    } finally {
      setIsUpdating(false);
    }
  };

  const handleUpdateHours = async (date: string, openTime: string | null, closeTime: string | null, openTime2: string | null, closeTime2: string | null) => {
    await api.schedule.setHours(date, openTime, closeTime, openTime2, closeTime2);
    await refreshSchedule();
  };

  const handleToggleHoliday = async (date: string, isHoliday: boolean) => {
    await api.schedule.setHoliday(date, isHoliday);
    await refreshSchedule();
  };

  const handleBulkFill = async (mode: "append" | "overwrite") => {
    setBulkFillMenuOpen(false);
    setBulkFilling(true);
    setBulkFillMessage("");
    try {
      const overwrite = mode === "overwrite";
      if (overwrite) {
        const preview = await api.schedule.bulkFill(rangeStart, rangeEnd, {
          overwrite: true,
          preview: true,
        });
        const confirmed = window.confirm(
          `新規追加 ${preview.created}件、既存シフト上書き ${preview.updated}件を実行します。\n` +
          "個別に調整した勤務時間もデフォルト時間に戻ります。よろしいですか？"
        );
        if (!confirmed) return;
      }

      const { created, updated } = await api.schedule.bulkFill(rangeStart, rangeEnd, { overwrite });
      await refreshSchedule();
      setBulkFillMessage(
        created > 0 || updated > 0
          ? `${created}件追加、${updated}件上書きしました`
          : "追加できるシフトはありませんでした"
      );
      setTimeout(() => setBulkFillMessage(""), 3000);
    } catch (e) {
      setBulkFillMessage(
        e instanceof Error ? `一括入力に失敗しました: ${e.message}` : "一括入力に失敗しました"
      );
      setTimeout(() => setBulkFillMessage(""), 3000);
    } finally {
      setBulkFilling(false);
    }
  };

  return (
    <div className="animate-fade-in pb-20">

      {/* Header Area */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
        <div>
          <h1 className="text-3xl font-extrabold mb-2 tracking-tight">Admin Dashboard</h1>
          <p className="text-textMuted">シフトの管理・スケジュールの編成を行います。</p>
        </div>

        {/* Month Picker + Export */}
        <div className="flex items-center gap-2 self-start md:self-auto">
          <div className="glass-card p-3 flex items-center gap-2 shadow-glass">
            <button
              onClick={() => setCurrentMonth(shiftYM(currentMonth, -1))}
              className="px-2.5 py-1.5 rounded-md bg-black/30 border border-border/50 text-textMuted hover:text-foreground hover:border-textMuted text-sm font-bold transition-colors"
            >
              ←
            </button>
            <input
              type="month"
              value={currentMonth}
              onChange={(e) => setCurrentMonth(e.target.value)}
              className="bg-black/40 border border-border/50 rounded-md px-2 py-1.5 text-sm text-foreground focus:outline-none focus:border-accent hover:border-textMuted transition-colors"
            />
            <button
              onClick={() => setCurrentMonth(shiftYM(currentMonth, 1))}
              className="px-2.5 py-1.5 rounded-md bg-black/30 border border-border/50 text-textMuted hover:text-foreground hover:border-textMuted text-sm font-bold transition-colors"
            >
              →
            </button>
          </div>
          <button
            onClick={() => setCalendarPreviewOpen(true)}
            disabled={!daysData}
            className="btn-secondary px-3 py-2 text-sm flex items-center gap-1.5 disabled:opacity-40"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 002 2z" />
            </svg>
            プレビュー
          </button>
          <div className="relative">
            <button
              onClick={() => setBulkFillMenuOpen((open) => !open)}
              disabled={bulkFilling}
              aria-haspopup="menu"
              aria-expanded={bulkFillMenuOpen}
              className="btn-secondary flex h-10 items-center gap-1.5 px-3 text-sm disabled:opacity-40"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              {bulkFilling ? "入力中..." : "一括入力"}
              {!bulkFilling && (
                <svg className={`h-3 w-3 transition-transform ${bulkFillMenuOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              )}
            </button>
            {bulkFillMenuOpen && (
              <div
                role="menu"
                className="absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-xl border border-border bg-[#111116] p-1.5 shadow-2xl"
              >
                <button
                  role="menuitem"
                  onClick={() => handleBulkFill("append")}
                  className="w-full rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-white/10"
                >
                  <span className="block text-sm font-bold text-foreground">未入力のみ追加</span>
                  <span className="mt-0.5 block text-[11px] text-textMuted">入力済みの時間は変更しません</span>
                </button>
                <button
                  role="menuitem"
                  onClick={() => handleBulkFill("overwrite")}
                  className="w-full rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-white/10"
                >
                  <span className="block text-sm font-bold text-warn">既存シフトも上書き</span>
                  <span className="mt-0.5 block text-[11px] text-textMuted">全員をデフォルト時間に戻します</span>
                </button>
              </div>
            )}
          </div>
          <button
            onClick={async () => {
              if (!daysData || !users) return;
              setExporting(true);
              try {
                const { exportShifts } = await import("@/lib/exportShifts");
                exportShifts(buildFullDays(rangeStart, rangeEnd, daysData), users, currentMonth);
              } finally {
                setExporting(false);
              }
            }}
            disabled={exporting || !daysData || !users}
            className="btn-secondary px-3 py-2 text-sm flex items-center gap-1.5 disabled:opacity-40"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            {exporting ? "出力中..." : "Excel出力"}
          </button>
        </div>
      </div>

      {/* 労務警告バナー */}
      {laborViolations.length > 0 && (
        <div className="glass-card border-red-500/30 bg-red-950/20 p-4 mb-6 animate-slide-up">
          <button
            className="flex items-center gap-2 w-full text-left"
            onClick={() => setWarningsExpanded((v) => !v)}
          >
            <svg className="w-4 h-4 text-red-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span className="text-sm font-bold text-red-400 flex-1">
              労務注意事項 {laborViolations.length}件
            </span>
            <svg
              className={`w-3.5 h-3.5 text-red-400/60 transition-transform ${warningsExpanded ? "rotate-180" : ""}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {warningsExpanded && (
            <ul className="mt-3 flex flex-col gap-1.5 pl-6">
              {laborViolations.map((v, i) => (
                <li key={i} className="flex items-start gap-2 text-xs">
                  <span className={`mt-0.5 shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold ${
                    v.type === "CONSECUTIVE_DAYS"
                      ? "bg-orange-500/20 text-orange-300"
                      : "bg-red-500/20 text-red-300"
                  }`}>
                    {v.type === "CONSECUTIVE_DAYS" ? "連続出勤" : "週超過"}
                  </span>
                  <span className="font-bold text-red-200">{v.userName}</span>
                  <span className="text-red-300/70">{v.detail}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {isUpdating && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] glass-card px-4 py-2 border-accent/50 bg-accent/10 flex items-center gap-3 shadow-glow rounded-full">
           <div className="w-4 h-4 border-2 border-accent/30 border-t-accent rounded-full animate-spin"></div>
           <span className="text-sm font-medium text-accent">更新を保存中...</span>
        </div>
      )}

      {bulkFillMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] glass-card px-4 py-2 border-success/50 bg-success/10 flex items-center gap-3 shadow-glow rounded-full">
          <svg className="w-4 h-4 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span className="text-sm font-medium text-success">{bulkFillMessage}</span>
        </div>
      )}

      {organizationId && daysData && (
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <div className="animate-slide-up" style={{ animationDelay: '200ms', animationFillMode: 'both' }}>
            <AdminBoard
              days={buildFullDays(rangeStart, rangeEnd, daysData)}
              users={users || []}
              organizationId={organizationId}
              orgOpenTime={orgData?.openTime}
              orgCloseTime={orgData?.closeTime}
              orgOpenTime2={orgData?.openTime2}
              orgCloseTime2={orgData?.closeTime2}
              onUpdateMinRequired={async (date, minRequired) => {
                await api.schedule.setMinRequired(date, minRequired);
                await refreshSchedule();
              }}
              onUpdateHours={handleUpdateHours}
              onToggleHoliday={handleToggleHoliday}
              onRefresh={refreshSchedule}
            />
          </div>
        </DndContext>
      )}

      {daysData && (
        <ShiftCalendarModal
          open={calendarPreviewOpen}
          onClose={() => setCalendarPreviewOpen(false)}
          yearMonth={currentMonth}
          days={buildFullDays(rangeStart, rangeEnd, daysData)}
        />
      )}
    </div>
  );
}
