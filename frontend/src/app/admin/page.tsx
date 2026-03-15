"use client";

import { useState } from "react";
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
import { AddShiftForm } from "./AddShiftForm";

function dateKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default function AdminPage() {
  const [organizationId, setOrganizationId] = useState("");
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

  // Fetch Organizations
  const { data: orgs } = useSWR("orgs", api.organizations.list, {
    onSuccess: (data) => {
      if (data.length > 0 && !organizationId) setOrganizationId(data[0].id);
    },
  });

  // Fetch Users
  const { data: users } = useSWR(
    organizationId ? ["users", organizationId] : null,
    ([, orgId]) => api.users.list(orgId)
  );

  // Fetch Schedule Data
  const { data: daysData, mutate: mutateDays } = useSWR(
    organizationId ? ["scheduleDays", organizationId, rangeStart, rangeEnd] : null,
    ([, orgId, start, end]) => api.schedule.days(orgId, start, end)
  );

  const { data: warningsData, mutate: mutateWarnings } = useSWR(
    organizationId ? ["scheduleWarnings", organizationId, rangeStart, rangeEnd] : null,
    ([, orgId, start, end]) => api.schedule.warnings(orgId, start, end)
  );

  const refreshSchedule = async () => {
    await mutateDays();
    await mutateWarnings();
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

  return (
    <div className="animate-fade-in pb-20">
      
      {/* Header Area */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
        <div>
          <h1 className="text-3xl font-extrabold mb-2 tracking-tight">Admin Dashboard</h1>
          <p className="text-textMuted">シフトの管理・スケジュールの編成を行います。</p>
        </div>

        {/* Filters Panel */}
        <div className="glass-card p-3 flex flex-wrap items-center gap-4 shadow-glass self-start md:self-auto w-full md:w-auto">
          <label className="flex items-center gap-3 pl-2">
            <span className="text-xs font-semibold text-textMuted uppercase tracking-wider">組織</span>
            <div className="relative">
              <select
                value={organizationId}
                onChange={(e) => setOrganizationId(e.target.value)}
                className="appearance-none bg-black/40 border border-border/50 rounded-md py-1.5 pl-3 pr-8 text-sm text-foreground focus:outline-none focus:border-accent hover:border-textMuted transition-colors"
              >
                <option value="">組織を選択</option>
                {orgs?.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-textMuted">
                 <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </div>
            </div>
          </label>
          <div className="w-[1px] h-6 bg-border mx-1 hidden sm:block"></div>
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
           <div>
             <h4 className="text-warn font-bold text-lg mb-1">最低人員不足の警告</h4>
             <p className="text-sm text-foreground/80 mb-3">以下の日程で必要なスタッフ数が満たされていません。シフトを調整してください。</p>
             <ul className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
               {warningsData.map((w) => (
                 <li key={w.date} className="flex items-center gap-2 bg-black/20 border border-warn/20 rounded-md px-3 py-2 text-sm">
                   <span className="font-semibold text-foreground">{new Date(w.date).toLocaleDateString("ja-JP", { month: 'short', day: 'numeric' })}</span>
                   <span className="text-xs text-textMuted ml-auto">
                     出勤 <strong className="text-warn text-sm">{w.assignedCount}</strong> / {w.minRequired}
                   </span>
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

      {organizationId && users && users.length > 0 && (
         <AddShiftForm
           organizationId={organizationId}
           users={users}
           rangeStart={rangeStart}
           rangeEnd={rangeEnd}
           onAdded={refreshSchedule}
         />
      )}

      {organizationId && daysData && (
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <div className="animate-slide-up" style={{ animationDelay: '200ms', animationFillMode: 'both' }}>
            <AdminBoard
              days={daysData}
              users={users || []}
              organizationId={organizationId}
              onUpdateMinRequired={async (date, minRequired) => {
                await api.schedule.setMinRequired(date, organizationId, minRequired);
                await refreshSchedule();
              }}
              onRefresh={refreshSchedule}
            />
          </div>
        </DndContext>
      )}
    </div>
  );
}
