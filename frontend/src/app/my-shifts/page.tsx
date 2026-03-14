"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { ShiftAssignment } from "@/types";

const USER_ID_KEY = "shift_manager_user_id";

function formatDate(d: string) {
  const dt = new Date(d);
  return dt.toLocaleDateString("ja-JP", {
    month: "long",
    day: "numeric",
    weekday: "short",
  });
}

export default function MyShiftsPage() {
  const [userId, setUserId] = useState("");
  const [savedUserId, setSavedUserId] = useState("");
  const [shifts, setShifts] = useState<ShiftAssignment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem(USER_ID_KEY) : null;
    if (saved) setSavedUserId(saved);
  }, []);

  const loadShifts = async (uid: string) => {
    setLoading(true);
    setError(null);
    try {
      const from = new Date();
      const to = new Date();
      to.setMonth(to.getMonth() + 3);
      const list = await api.shifts.my(
        uid,
        from.toISOString().slice(0, 10),
        to.toISOString().slice(0, 10)
      );
      setShifts(list);
      if (typeof window !== "undefined") localStorage.setItem(USER_ID_KEY, uid);
      setSavedUserId(uid);
    } catch (e) {
      setError(e instanceof Error ? e.message : "取得に失敗しました");
      setShifts([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId.trim()) return;
    loadShifts(userId.trim());
  };

  return (
    <div style={{ maxWidth: "32rem" }}>
      <h1 style={{ marginBottom: "1rem" }}>自分のシフト</h1>

      {!savedUserId ? (
        <form
          onSubmit={handleSubmit}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.75rem",
            marginBottom: "1.5rem",
          }}
        >
          <p style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>
            確認用のユーザーIDを入力してください。（認証実装後は不要になります）
          </p>
          <input
            type="text"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            placeholder="ユーザーID (例: clxx...)"
            style={{
              padding: "0.5rem 0.75rem",
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "6px",
              color: "var(--text)",
            }}
          />
          <button
            type="submit"
            style={{
              padding: "0.5rem 1rem",
              background: "var(--accent)",
              border: "none",
              borderRadius: "6px",
              color: "white",
            }}
          >
            シフトを表示
          </button>
        </form>
      ) : (
        <p style={{ color: "var(--text-muted)", fontSize: "0.875rem", marginBottom: "1rem" }}>
          ユーザーID: {savedUserId}
          <button
            type="button"
            onClick={() => {
              setSavedUserId("");
              setShifts([]);
              localStorage.removeItem(USER_ID_KEY);
            }}
            style={{
              marginLeft: "0.5rem",
              padding: "0.25rem 0.5rem",
              fontSize: "0.75rem",
              background: "transparent",
              border: "1px solid var(--border)",
              borderRadius: "4px",
              color: "var(--text-muted)",
            }}
          >
            別のIDで見る
          </button>
        </p>
      )}

      {error && (
        <p style={{ color: "var(--danger)", marginBottom: "1rem" }}>{error}</p>
      )}

      {loading && <p style={{ color: "var(--text-muted)" }}>読み込み中...</p>}

      {!loading && shifts.length === 0 && savedUserId && !error && (
        <p style={{ color: "var(--text-muted)" }}>この期間のシフトはありません。</p>
      )}

      {!loading && shifts.length > 0 && (
        <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {shifts.map((s) => (
            <li
              key={s.id}
              style={{
                padding: "1rem",
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: "8px",
              }}
            >
              <div style={{ fontWeight: 600 }}>{formatDate(s.scheduleDay?.date ?? "")}</div>
              <div style={{ color: "var(--text-muted)", marginTop: "0.25rem" }}>
                {s.startTime} ～ {s.endTime}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
