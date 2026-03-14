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
  return new Date(d).toLocaleDateString("ja-JP", {
    month: "short",
    day: "numeric",
    weekday: "short",
  });
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
      style={{
        padding: "0.5rem 0.75rem",
        background: isDragging ? "var(--accent)" : "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "6px",
        marginBottom: "0.5rem",
        cursor: "grab",
        opacity: isDragging ? 0.8 : 1,
      }}
    >
      <div style={{ fontWeight: 600, fontSize: "0.875rem" }}>{userName}</div>
      <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
        {startTime} ～ {endTime}
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

  return (
    <div
      ref={setNodeRef}
      style={{
        flex: "1",
        minWidth: "160px",
        maxWidth: "220px",
        padding: "0.75rem",
        background: isOver ? "rgba(99, 102, 241, 0.2)" : "var(--surface)",
        border: `1px solid ${insufficient ? "var(--warn)" : "var(--border)"}`,
        borderRadius: "8px",
      }}
    >
      <div style={{ marginBottom: "0.5rem", fontWeight: 600, fontSize: "0.875rem" }}>
        {formatDate(date)}
      </div>
      <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
        <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>最低人数</span>
        <input
          type="number"
          min={0}
          value={minRequired}
          onChange={async (e) => {
            const v = parseInt(e.target.value, 10);
            if (!isNaN(v) && v >= 0) await onUpdateMinRequired(date, v);
          }}
          style={{
            width: "3rem",
            padding: "0.25rem",
            background: "var(--bg)",
            border: "1px solid var(--border)",
            borderRadius: "4px",
            color: "var(--text)",
          }}
        />
      </label>
      {insufficient && (
        <div style={{ fontSize: "0.75rem", color: "var(--warn)", marginBottom: "0.5rem" }}>
          ⚠ {uniqueCount} / {minRequired} 人
        </div>
      )}
      <div style={{ minHeight: "2rem" }}>
        {assignments.map((a) => (
          <DraggableCard
            key={a.id}
            id={a.id}
            assignmentId={a.id}
            userName={a.user?.name ?? a.userId}
            startTime={a.startTime}
            endTime={a.endTime}
          />
        ))}
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
      <p style={{ color: "var(--text-muted)" }}>
        この期間にスケジュールがありません。API でシフトを追加するか、組織・日付を変更してください。
      </p>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "1rem",
        marginTop: "1rem",
      }}
    >
      {days.map((d) => (
        <DayColumn
          key={d.id}
          date={typeof d.date === "string" ? d.date : new Date(d.date).toISOString().slice(0, 10)}
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
