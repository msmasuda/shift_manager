"use client";

import { useSession } from "next-auth/react";
import useSWR from "swr";
import { api } from "@/lib/api";

function formatDayOfWeek(d: string) {
  const dt = new Date(d);
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return weekdays[dt.getUTCDay()];
}

export default function MyShiftsPage() {
  const { data: session } = useSession();
  const userId = session?.user?.id;

  const { data: shifts, error, isLoading } = useSWR(
    userId ? ["my-shifts", userId] : null,
    async () => {
      const from = new Date();
      const to = new Date();
      to.setMonth(to.getMonth() + 3);
      return api.shifts.my(from.toISOString().slice(0, 10), to.toISOString().slice(0, 10));
    }
  );

  return (
    <div className="max-w-2xl mx-auto">

      <div className="mb-10">
        <h1 className="text-3xl font-extrabold mb-2 tracking-tight">My Shifts</h1>
        <p className="text-textMuted">直近のあなたのシフトスケジュールです。</p>
      </div>

      <div className="animate-slide-up">
        {error && (
          <div className="glass-card p-4 border-danger/50 bg-danger/10 text-danger flex items-center gap-3 mb-6">
            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <span>データの取得に失敗しました。</span>
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
            <div className="absolute left-[39px] top-6 bottom-6 w-[2px] bg-border/50 hidden sm:block rounded-full"></div>

            <ul className="flex flex-col gap-4">
              {shifts.map((s, idx) => (
                <li
                  key={s.id}
                  className="group relative flex flex-col sm:flex-row gap-4 sm:gap-8 items-start sm:items-center p-4 sm:p-5 glass-card interactive-element hover:border-accent/40"
                  style={{ animationDelay: `${idx * 50}ms`, animationFillMode: 'both' }}
                >
                  <div className="hidden sm:flex absolute left-[-4px] md:left-[35px] w-2.5 h-2.5 rounded-full bg-accent shadow-[0_0_10px_rgba(99,102,241,0.8)] z-10 scale-0 group-hover:scale-100 transition-transform duration-300"></div>

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

                  <div className="flex-1 bg-black/30 border border-white/5 rounded-lg px-6 py-4 flex items-center justify-between w-full group-hover:bg-accent/5 transition-colors">
                    <div className="flex flex-col">
                      <span className="text-[10px] text-textMuted uppercase tracking-widest mb-1 font-semibold">Time</span>
                      <div className="flex items-center gap-3">
                        <span className="text-xl font-bold tracking-tight text-foreground">{s.startTime}</span>
                        <span className="text-textMuted/50">―</span>
                        <span className="text-xl font-bold tracking-tight text-foreground">{s.endTime}</span>
                      </div>
                    </div>

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
    </div>
  );
}
