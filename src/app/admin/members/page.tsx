"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import { api } from "@/lib/api";
import type { User } from "@/types";

function MemberRow({
  user,
  onSaved,
}: {
  user: User;
  onSaved: () => Promise<void>;
}) {
  const [startTime, setStartTime] = useState(user.defaultStartTime ?? "");
  const [endTime, setEndTime] = useState(user.defaultEndTime ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setStartTime(user.defaultStartTime ?? "");
    setEndTime(user.defaultEndTime ?? "");
  }, [user.defaultStartTime, user.defaultEndTime]);

  const isDirty =
    startTime !== (user.defaultStartTime ?? "") ||
    endTime !== (user.defaultEndTime ?? "");

  const handleSave = async () => {
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      await api.users.update(user.id, {
        defaultStartTime: startTime || null,
        defaultEndTime: endTime || null,
      });
      await onSaved();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="glass-card p-4 flex flex-col md:flex-row md:items-center gap-3 md:gap-6">
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-foreground truncate">{user.name}</div>
        <div className="text-xs text-textMuted truncate">{user.email}</div>
      </div>
      <span
        className={`text-[10px] font-bold px-2 py-0.5 rounded-full self-start md:self-auto shrink-0 ${
          user.role === "ADMIN"
            ? "bg-accent/15 text-accent border border-accent/30"
            : "bg-white/5 text-textMuted border border-white/10"
        }`}
      >
        {user.role === "ADMIN" ? "管理者" : "メンバー"}
      </span>
      <div className="flex items-center gap-2">
        <span className="text-[11px] text-textMuted w-9 shrink-0">開始</span>
        <input
          type="time"
          value={startTime}
          onChange={(e) => {
            setStartTime(e.target.value);
            setSaved(false);
          }}
          className="bg-black/40 border border-border/50 rounded-lg px-3 py-1.5 text-sm text-foreground focus:outline-none focus:border-accent hover:border-textMuted transition-colors"
        />
        <span className="text-textMuted text-sm">–</span>
        <span className="text-[11px] text-textMuted w-9 shrink-0">終了</span>
        <input
          type="time"
          value={endTime}
          onChange={(e) => {
            setEndTime(e.target.value);
            setSaved(false);
          }}
          className="bg-black/40 border border-border/50 rounded-lg px-3 py-1.5 text-sm text-foreground focus:outline-none focus:border-accent hover:border-textMuted transition-colors"
        />
      </div>
      <div className="flex items-center gap-2 min-w-[140px]">
        <button
          onClick={handleSave}
          disabled={saving || !isDirty}
          className="px-4 py-1.5 rounded-lg bg-accent/20 border border-accent/50 text-accent text-sm font-semibold hover:bg-accent/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {saving ? "保存中..." : "保存"}
        </button>
        {saved && <span className="text-xs text-green-400">保存済み</span>}
        {error && <span className="text-xs text-red-400">{error}</span>}
      </div>
    </div>
  );
}

export default function MembersPage() {
  const { data: session } = useSession();
  const organizationId = session?.user?.organizationId ?? "";

  const { data: users, mutate } = useSWR(
    organizationId ? ["users", organizationId] : null,
    () => api.users.list()
  );

  return (
    <div className="animate-fade-in max-w-3xl">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold mb-2 tracking-tight">メンバー管理</h1>
        <p className="text-textMuted">
          メンバーごとの基本シフト時間を設定します。管理者ボードの「一括入力」で、この時間を使って空欄のシフトを一気に埋められます。
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {(users ?? []).map((u) => (
          <MemberRow
            key={u.id}
            user={u}
            onSaved={async () => {
              await mutate();
            }}
          />
        ))}
        {users && users.length === 0 && (
          <div className="glass-card p-8 text-center text-textMuted">
            メンバーがいません。
          </div>
        )}
      </div>
    </div>
  );
}
