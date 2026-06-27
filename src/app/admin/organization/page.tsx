"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import { api } from "@/lib/api";

export default function OrganizationPage() {
  const { data: session } = useSession();
  const organizationId = session?.user?.organizationId ?? "";

  const { data: org, mutate } = useSWR(
    organizationId ? ["org", organizationId] : null,
    () => api.organizations.get(organizationId)
  );

  const [name, setName] = useState("");
  const [openTime, setOpenTime] = useState("");
  const [closeTime, setCloseTime] = useState("");
  const [openTime2, setOpenTime2] = useState("");
  const [closeTime2, setCloseTime2] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!org) return;
    setName(org.name);
    setOpenTime(org.openTime ?? "");
    setCloseTime(org.closeTime ?? "");
    setOpenTime2(org.openTime2 ?? "");
    setCloseTime2(org.closeTime2 ?? "");
  }, [org]);

  const handleSave = async () => {
    if (!organizationId || !name.trim()) return;
    setSaving(true);
    setSaved(false);
    try {
      await api.organizations.update(organizationId, {
        name: name.trim(),
        openTime: openTime || null,
        closeTime: closeTime || null,
        openTime2: openTime2 || null,
        closeTime2: closeTime2 || null,
      });
      await mutate();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  const isDirty = org && (
    name !== org.name ||
    openTime !== (org.openTime ?? "") ||
    closeTime !== (org.closeTime ?? "") ||
    openTime2 !== (org.openTime2 ?? "") ||
    closeTime2 !== (org.closeTime2 ?? "")
  );

  return (
    <div className="animate-fade-in max-w-2xl">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold mb-2 tracking-tight">企業情報</h1>
        <p className="text-textMuted">組織の基本情報・営業時間を管理します。</p>
      </div>

      <div className="glass-card p-6 flex flex-col gap-6">

        {/* Organization Name */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="org-name" className="text-xs font-semibold text-textMuted uppercase tracking-wider">
            組織名
          </label>
          <input
            id="org-name"
            type="text"
            value={name}
            onChange={(e) => { setName(e.target.value); setSaved(false); }}
            placeholder="組織名を入力"
            className="bg-black/40 border border-border/50 rounded-lg px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-accent hover:border-textMuted transition-colors"
          />
        </div>

        <div className="border-t border-border/30" />

        {/* Business Hours */}
        <div className="flex flex-col gap-4">
          <span className="text-xs font-semibold text-textMuted uppercase tracking-wider">
            デフォルト営業時間
          </span>
          <p className="text-xs text-textMuted/70 -mt-2">
            日毎の上書きがない場合のデフォルト値です。夜の部は不要な場合は空欄のままにしてください。
          </p>

          {/* 昼の部 */}
          <div className="flex flex-col gap-1.5">
            <span className="text-sm text-textMuted">昼の部</span>
            <div className="flex items-center gap-3">
              <input
                type="time"
                value={openTime}
                onChange={(e) => { setOpenTime(e.target.value); setSaved(false); }}
                className="bg-black/40 border border-border/50 rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-accent hover:border-textMuted transition-colors"
              />
              <span className="text-textMuted text-sm">–</span>
              <input
                type="time"
                value={closeTime}
                onChange={(e) => { setCloseTime(e.target.value); setSaved(false); }}
                className="bg-black/40 border border-border/50 rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-accent hover:border-textMuted transition-colors"
              />
            </div>
          </div>

          {/* 夜の部 */}
          <div className="flex flex-col gap-1.5">
            <span className="text-sm text-textMuted">夜の部</span>
            <div className="flex items-center gap-3">
              <input
                type="time"
                value={openTime2}
                onChange={(e) => { setOpenTime2(e.target.value); setSaved(false); }}
                className="bg-black/40 border border-border/50 rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-accent hover:border-textMuted transition-colors"
              />
              <span className="text-textMuted text-sm">–</span>
              <input
                type="time"
                value={closeTime2}
                onChange={(e) => { setCloseTime2(e.target.value); setSaved(false); }}
                className="bg-black/40 border border-border/50 rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-accent hover:border-textMuted transition-colors"
              />
            </div>
          </div>
        </div>

        {/* Save button */}
        <div className="flex items-center gap-3 pt-2 border-t border-border/30">
          <button
            onClick={handleSave}
            disabled={saving || !isDirty || !name.trim()}
            className="px-5 py-2 rounded-lg bg-accent/20 border border-accent/50 text-accent text-sm font-semibold hover:bg-accent/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? "保存中..." : "保存"}
          </button>
          {saved && (
            <span className="text-sm text-green-400 flex items-center gap-1.5 animate-fade-in">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              保存しました
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
