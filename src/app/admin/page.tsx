"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { api } from "@/lib/api";
import { AdminBoard } from "./AdminBoard";

function dateKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default function AdminPage() {
  const { data: session } = useSession();
  const organizationId = session?.user?.organizationId ?? "";

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
  const [isUpdating, setIsUpdating] = useState(false);

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
    organizationId ? ["scheduleWarnings", organizationId, rangeStart, rangeEnd] : null,
    () => api.schedule.warnings(rangeStart, rangeEnd)
  );

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

  const hasGapWarnings = warningsData?.some((w) => w.gaps && w.gaps.length > 0);
  const hasInsufficientWarnings = warningsData?.some((w) => w.insufficient);

  return (
    <div className="animate-fade-in pb-20">

      {/* Header Area */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
        <div>
          <h1 className="text-3xl font-extrabold mb-2 tracking-tight">Admin Dashboard</h1>
          <p className="text-textMuted">シフトの管理・スケジュールの編成を行います。</p>
        </div>

        {/* Date Range Filter */}
        <div className="glass-card p-3 flex flex-wrap items-center gap-4 shadow-glass self-start md:self-auto w-full md:w-auto">
          <div className="flex items-center gap-2">
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
      </div>

      {/* Warning Alert Banner */}
      {warningsData && warningsData.length > 0 && (
        <div className="glass-card p-4 mb-8 border-warn/30 bg-warn/10 flex items-start gap-4 animate-slide-up shadow-[0_4px_30px_rgba(251,191,36,0.15)]">
           <div className="w-10 h-10 rounded-full bg-warn/20 flex flex-shrink-0 items-center justify-center">
             <svg className="w-5 h-5 text-warn" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
           </div>
           <div className="flex-1 min-w-0">
             <h4 className="text-warn font-bold text-lg mb-1">
               {hasInsufficientWarnings && hasGapWarnings
                 ? "最低人員不足・カバレッジ不足の警告"
                 : hasInsufficientWarnings
                 ? "最低人員不足の警告"
                 : "カバレッジ不足の警告"}
             </h4>
             <p className="text-sm text-foreground/80 mb-3">以下の日程でシフトに問題があります。調整してください。</p>
             <ul className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
               {warningsData.map((w) => (
                 <li key={w.date as unknown as string} className="flex flex-col gap-1 bg-black/20 border border-warn/20 rounded-md px-3 py-2 text-sm">
                   <div className="flex items-center gap-2">
                     <span className="font-semibold text-foreground">{new Date(w.date).toLocaleDateString("ja-JP", { month: 'short', day: 'numeric' })}</span>
                     {w.insufficient && (
                       <span className="text-xs text-textMuted ml-auto">
                         出勤 <strong className="text-warn text-sm">{w.assignedCount}</strong> / {w.minRequired}
                       </span>
                     )}
                   </div>
                   {w.gaps && w.gaps.length > 0 && (
                     <div className="flex flex-col gap-0.5">
                       {w.gaps.map((g, i) => (
                         <span key={i} className="text-xs text-warn/80 flex items-center gap-1">
                           <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3" /></svg>
                           {g.start}–{g.end} 人員なし
                         </span>
                       ))}
                     </div>
                   )}
                 </li>
               ))}
             </ul>
           </div>
        </div>
      )}

      {isUpdating && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] glass-card px-4 py-2 border-accent/50 bg-accent/10 flex items-center gap-3 shadow-glow rounded-full">
           <div className="w-4 h-4 border-2 border-accent/30 border-t-accent rounded-full animate-spin"></div>
           <span className="text-sm font-medium text-accent">更新を保存中...</span>
        </div>
      )}

      {organizationId && daysData && (
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <div className="animate-slide-up" style={{ animationDelay: '200ms', animationFillMode: 'both' }}>
            <AdminBoard
              days={daysData}
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
              onRefresh={refreshSchedule}
            />
          </div>
        </DndContext>
      )}
    </div>
  );
}
