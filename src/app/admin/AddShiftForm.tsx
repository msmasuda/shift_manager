"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import type { User } from "@/types";

interface AddShiftFormProps {
  organizationId: string;
  users: User[];
  rangeStart: string;
  rangeEnd: string;
  onAdded: () => Promise<void>;
}

export function AddShiftForm({
  organizationId,
  users,
  rangeStart,
  rangeEnd,
  onAdded,
}: AddShiftFormProps) {
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
      // Optionally keep same date/times for quick multi-add, or reset
      setStartTime("09:00");
      setEndTime("18:00");
      await onAdded();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="glass-card mb-8 animate-slide-up" style={{ animationDelay: '100ms', animationFillMode: 'both' }}>
      <div className="px-6 py-4 border-b border-border/50 bg-black/10 flex items-center gap-3 rounded-t-xl">
        <div className="w-8 h-8 rounded bg-accent/20 flex items-center justify-center">
          <svg className="w-4 h-4 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
        </div>
        <h3 className="font-bold text-lg text-foreground tracking-tight">シフトの追加</h3>
      </div>
      
      <form onSubmit={handleSubmit} className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          <label className="flex flex-col gap-1.5 focus-within:text-accent transition-colors">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-textMuted group-focus-within:text-accent">Date</span>
            <input
              type="date"
              value={date}
              min={rangeStart}
              max={rangeEnd}
              onChange={(e) => setDate(e.target.value)}
              className="styled-input"
            />
          </label>
          
          <label className="flex flex-col gap-1.5 focus-within:text-accent transition-colors">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-textMuted group-focus-within:text-accent">Staff Member</span>
            <div className="relative">
              <select
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                className="styled-input appearance-none w-full"
              >
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-textMuted">
                 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </div>
            </div>
          </label>
          
          <label className="flex flex-col gap-1.5 focus-within:text-accent transition-colors">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-textMuted group-focus-within:text-accent">Start Time</span>
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="styled-input"
            />
          </label>
          
          <label className="flex flex-col gap-1.5 focus-within:text-accent transition-colors">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-textMuted group-focus-within:text-accent">End Time</span>
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="styled-input"
            />
          </label>
        </div>
        
        <div className="mt-6 flex justify-end">
          <button
            type="submit"
            disabled={submitting}
            className="btn-primary w-full md:w-auto min-w-[160px] flex items-center justify-center gap-2"
          >
            {submitting ? (
               <>
                 <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                 追加中...
               </>
            ) : "追加する"}
          </button>
        </div>
      </form>
    </div>
  );
}
