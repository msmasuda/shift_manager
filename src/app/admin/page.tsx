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
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const { start: rangeStart, end: rangeEnd } = monthRange(currentMonth);
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

  const refreshSchedule = async () => {
    await mutateDays();
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

  return (
    <div className="animate-fade-in pb-20">

      {/* Header Area */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
        <div>
          <h1 className="text-3xl font-extrabold mb-2 tracking-tight">Admin Dashboard</h1>
          <p className="text-textMuted">シフトの管理・スケジュールの編成を行います。</p>
        </div>

        {/* Month Picker */}
        <div className="glass-card p-3 flex items-center gap-2 shadow-glass self-start md:self-auto">
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
      </div>

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
    </div>
  );
}
