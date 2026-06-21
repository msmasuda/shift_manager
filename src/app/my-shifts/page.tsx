"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { api } from "@/lib/api";

const USER_ID_KEY = "shift_manager_user_id";

// Use timeZone: "UTC" because dates are stored as UTC midnight calendar dates.
// Without this, users in UTC- zones see the previous day.
function formatDate(d: string) {
  const dt = new Date(d);
  return dt.toLocaleDateString("ja-JP", {
    month: "numeric",
    day: "numeric",
    weekday: "short",
    timeZone: "UTC",
  });
}

function formatDayOfWeek(d: string) {
  const dt = new Date(d);
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return weekdays[dt.getUTCDay()];
}

export default function MyShiftsPage() {
  const [inputUserId, setInputUserId] = useState("");
  const [savedUserId, setSavedUserId] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem(USER_ID_KEY);
    if (saved) setSavedUserId(saved);
  }, []);

  const { data: shifts, error, isLoading } = useSWR(
    savedUserId ? ["my-shifts", savedUserId] : null,
    async ([, uid]) => {
      const from = new Date();
      const to = new Date();
      to.setMonth(to.getMonth() + 3);
      return api.shifts.my(uid, from.toISOString().slice(0, 10), to.toISOString().slice(0, 10));
    }
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const uid = inputUserId.trim();
    if (!uid) return;
    localStorage.setItem(USER_ID_KEY, uid);
    setSavedUserId(uid);
  };

  return (
    <div className="max-w-2xl mx-auto">

      <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold mb-2 tracking-tight">My Shifts</h1>
          <p className="text-textMuted">直近のあなたのシフトスケジュールです。</p>
        </div>

        {savedUserId && (
          <div className="glass-card px-4 py-2 flex items-center gap-3 animate-fade-in self-start md:self-auto">
            <span className="w-2 h-2 rounded-full bg-success shadow-[0_0_8px_rgba(52,211,153,0.8)]"></span>
            <div className="flex flex-col">
              <span className="text-[10px] text-textMuted uppercase tracking-wider">Active User ID</span>
              <span className="text-sm font-mono text-foreground font-semibold">{savedUserId.slice(0, 8)}...</span>
            </div>
            <button
              type="button"
              onClick={() => {
                setSavedUserId("");
                localStorage.removeItem(USER_ID_KEY);
              }}
              className="ml-2 text-xs text-textMuted hover:text-white underline underline-offset-2 transition-colors"
            >
              Sign out
            </button>
          </div>
        )}
      </div>

      {!savedUserId ? (
        <div className="glass-card p-8 md:p-10 max-w-lg mx-auto animate-slide-up">
          <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mb-6 mx-auto">
            <svg className="w-8 h-8 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-center mb-2">ユーザーを特定する</h2>
          <p className="text-sm text-textMuted text-center mb-8">
            確認用のユーザーIDを入力してください。
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <input
              type="text"
              value={inputUserId}
              onChange={(e) => setInputUserId(e.target.value)}
              placeholder="Enter User ID (ex. clxx...)"
              className="styled-input text-center text-lg tracking-wider font-mono py-3"
            />
            <button type="submit" className="btn-primary w-full py-3 mt-2 text-lg">
              シフトを表示する
            </button>
          </form>
        </div>
      ) : (
        <div className="animate-slide-up">
          {error && (
            <div className="glass-card p-4 border-danger/50 bg-danger/10 text-danger flex items-center gap-3 mb-6">
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <span>データの取得に失敗しました。IDをご確認ください。</span>
            </div>
          )}

          {isLoading && (
            <div className="flex justify-center items-center py-20">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-accent"></div>
            </div>
          )}

          {!isLoading && shifts?.length === 0 && !error && (
            <div className="glass-card p-12 text-center border-dashed border-border/50 bg-black/20">
              <svg className="w-12 h-12 text-textMuted mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              <p className="text-lg text-foreground font-medium mb-1">直近のシフトはありません</p>
              <p className="text-sm text-textMuted">スケジュールが追加されるとここに表示されます。</p>
            </div>
          )}

          {!isLoading && shifts && shifts.length > 0 && (
            <div className="relative">
              {/* Timeline graphic */}
              <div className="absolute left-[39px] top-6 bottom-6 w-[2px] bg-border/50 hidden sm:block rounded-full"></div>

              <ul className="flex flex-col gap-4">
                {shifts.map((s, idx) => (
                  <li
                    key={s.id}
                    className="group relative flex flex-col sm:flex-row gap-4 sm:gap-8 items-start sm:items-center p-4 sm:p-5 glass-card interactive-element hover:border-accent/40"
                    style={{ animationDelay: `${idx * 50}ms`, animationFillMode: 'both' }}
                  >
                    {/* Timeline dot */}
                    <div className="hidden sm:flex absolute left-[-4px] md:left-[35px] w-2.5 h-2.5 rounded-full bg-accent shadow-[0_0_10px_rgba(99,102,241,0.8)] z-10 scale-0 group-hover:scale-100 transition-transform duration-300"></div>

                    {/* Date Block */}
                    <div className="flex sm:flex-col items-center sm:items-end justify-center sm:w-24 gap-2 sm:gap-0 shrink-0">
                      <span className="text-2xl font-black text-foreground">
                        {new Date(s.scheduleDay?.date ?? "").getUTCDate()}
                      </span>
                      <div className="flex sm:flex-col items-center sm:items-end uppercase">
                        <span className="text-xs font-semibold text-accent tracking-widest">
                          {formatDayOfWeek(s.scheduleDay?.date ?? "")}
                        </span>
                        <span className="text-[10px] text-textMuted tracking-wider">
                          {new Date(s.scheduleDay?.date ?? "").toLocaleString('en-US', { month: 'short', timeZone: 'UTC' })}
                        </span>
                      </div>
                    </div>

                    {/* Time Block */}
                    <div className="flex-1 bg-black/30 border border-white/5 rounded-lg px-6 py-4 flex items-center justify-between w-full group-hover:bg-accent/5 transition-colors">
                      <div className="flex flex-col">
                        <span className="text-[10px] text-textMuted uppercase tracking-widest mb-1 font-semibold">Time</span>
                        <div className="flex items-center gap-3">
                          <span className="text-xl font-bold tracking-tight text-foreground">{s.startTime}</span>
                          <span className="text-textMuted/50">―</span>
                          <span className="text-xl font-bold tracking-tight text-foreground">{s.endTime}</span>
                        </div>
                      </div>

                      {/* Optional metadata (e.g duration) */}
                      <div className="hidden md:flex flex-col items-end">
                        <span className="px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-textMuted font-medium">
                          Confirmed
                        </span>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
