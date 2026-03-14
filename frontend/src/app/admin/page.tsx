"use client";

import { useCallback, useEffect, useState } from "react";
import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { api } from "@/lib/api";
import type { Organization, ScheduleDay, User, ScheduleWarning } from "@/types";
import { AdminBoard } from "./AdminBoard";

function AddShiftForm({
  organizationId,
  users,
  rangeStart,
  rangeEnd,
  onAdded,
}: {
  organizationId: string;
  users: User[];
  rangeStart: string;
  rangeEnd: string;
  onAdded: () => Promise<void>;
}) {
  const [date, setDate] = useState(rangeStart);
  const [userId, setUserId] = useState(users[0]?.id ?? "");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("18:00");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    setSubmitting(true);
    try {
      await api.shifts.create({
        organizationId,
        date,
        userId,
        startTime,
        endTime,
      });
      setDate(rangeStart);
      setStartTime("09:00");
      setEndTime("18:00");
      await onAdded();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "0.75rem",
        alignItems: "flex-end",
        padding: "1rem",
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "8px",
        marginBottom: "1rem",
      }}
    >
      <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
        <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>日付</span>
        <input
          type="date"
          value={date}
          min={rangeStart}
          max={rangeEnd}
          onChange={(e) => setDate(e.target.value)}
          style={{
            padding: "0.5rem",
            background: "var(--bg)",
            border: "1px solid var(--border)",
            borderRadius: "6px",
            color: "var(--text)",
          }}
        />
      </label>
      <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
        <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>担当者</span>
        <select
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          style={{
            padding: "0.5rem",
            minWidth: "8rem",
            background: "var(--bg)",
            border: "1px solid var(--border)",
            borderRadius: "6px",
            color: "var(--text)",
          }}
        >
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
      </label>
      <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
        <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>開始</span>
        <input
          type="time"
          value={startTime}
          onChange={(e) => setStartTime(e.target.value)}
          style={{
            padding: "0.5rem",
            background: "var(--bg)",
            border: "1px solid var(--border)",
            borderRadius: "6px",
            color: "var(--text)",
          }}
        />
      </label>
      <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
        <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>終了</span>
        <input
          type="time"
          value={endTime}
          onChange={(e) => setEndTime(e.target.value)}
          style={{
            padding: "0.5rem",
            background: "var(--bg)",
            border: "1px solid var(--border)",
            borderRadius: "6px",
            color: "var(--text)",
          }}
        />
      </label>
      <button
        type="submit"
        disabled={submitting}
        style={{
          padding: "0.5rem 1rem",
          background: "var(--accent)",
          border: "none",
          borderRadius: "6px",
          color: "white",
        }}
      >
        {submitting ? "追加中..." : "シフトを追加"}
      </button>
    </form>
  );
}

function dateKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default function AdminPage() {
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [organizationId, setOrganizationId] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [days, setDays] = useState<ScheduleDay[]>([]);
  const [warnings, setWarnings] = useState<ScheduleWarning[]>([]);
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
  const [loading, setLoading] = useState(false);

  const loadOrgs = useCallback(async () => {
    try {
      const list = await api.organizations.list();
      setOrgs(list);
      if (list.length > 0 && !organizationId) setOrganizationId(list[0].id);
    } catch {
      setOrgs([]);
    }
  }, [organizationId]);

  useEffect(() => {
    loadOrgs();
  }, [loadOrgs]);

  const loadUsers = useCallback(async () => {
    if (!organizationId) return;
    try {
      const list = await api.users.list(organizationId);
      setUsers(list);
    } catch {
      setUsers([]);
    }
  }, [organizationId]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const loadSchedule = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    try {
      const [daysList, warningsList] = await Promise.all([
        api.schedule.days(organizationId, rangeStart, rangeEnd),
        api.schedule.warnings(organizationId, rangeStart, rangeEnd),
      ]);
      setDays(daysList);
      setWarnings(warningsList);
    } catch {
      setDays([]);
      setWarnings([]);
    } finally {
      setLoading(false);
    }
  }, [organizationId, rangeStart, rangeEnd]);

  useEffect(() => {
    loadSchedule();
  }, [loadSchedule]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over?.data?.current?.date || !organizationId) return;
    const assignmentId = active.data?.current?.assignmentId as string | undefined;
    const targetDate = over.data.current.date as string;
    if (!assignmentId) return;
    setLoading(true);
    try {
      await api.shifts.update(assignmentId, { date: targetDate });
      await loadSchedule();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1 style={{ marginBottom: "1rem" }}>管理者</h1>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "1rem",
          alignItems: "center",
          marginBottom: "1rem",
        }}
      >
        <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span>組織</span>
          <select
            value={organizationId}
            onChange={(e) => setOrganizationId(e.target.value)}
            style={{
              padding: "0.5rem",
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "6px",
              color: "var(--text)",
            }}
          >
            <option value="">選択</option>
            {orgs.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span>開始日</span>
          <input
            type="date"
            value={rangeStart}
            onChange={(e) => setRangeStart(e.target.value)}
            style={{
              padding: "0.5rem",
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "6px",
              color: "var(--text)",
            }}
          />
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span>終了日</span>
          <input
            type="date"
            value={rangeEnd}
            onChange={(e) => setRangeEnd(e.target.value)}
            style={{
              padding: "0.5rem",
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "6px",
              color: "var(--text)",
            }}
          />
        </label>
      </div>

      {warnings.length > 0 && (
        <div
          style={{
            padding: "0.75rem 1rem",
            background: "rgba(245, 158, 11, 0.15)",
            border: "1px solid var(--warn)",
            borderRadius: "8px",
            marginBottom: "1rem",
          }}
        >
          <strong style={{ color: "var(--warn)" }}>⚠ 最低人数不足</strong>
          <ul style={{ marginTop: "0.5rem", paddingLeft: "1.25rem" }}>
            {warnings.map((w) => (
              <li key={w.date}>
                {new Date(w.date).toLocaleDateString("ja-JP")}：必要 {w.minRequired} 人 / 出勤 {w.assignedCount} 人
              </li>
            ))}
          </ul>
        </div>
      )}

      {loading && <p style={{ color: "var(--text-muted)" }}>読み込み中...</p>}

      {organizationId && users.length > 0 && (
        <AddShiftForm
          organizationId={organizationId}
          users={users}
          rangeStart={rangeStart}
          rangeEnd={rangeEnd}
          onAdded={loadSchedule}
        />
      )}

      {organizationId && (
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <AdminBoard
            days={days}
            users={users}
            organizationId={organizationId}
            onUpdateMinRequired={async (date, minRequired) => {
              await api.schedule.setMinRequired(date, organizationId, minRequired);
              await loadSchedule();
            }}
            onRefresh={loadSchedule}
          />
        </DndContext>
      )}
    </div>
  );
}
