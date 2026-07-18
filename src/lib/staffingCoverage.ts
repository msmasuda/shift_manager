import type { TimeGap } from "@/types";

type ShiftInterval = { startTime: string; endTime: string };

function toMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function toTimeString(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

/** 営業時間内で同時勤務人数が最低人数を下回る区間を返す。 */
export function findUnderstaffedIntervals(
  shifts: ShiftInterval[],
  minRequired: number,
  openTime: string,
  closeTime: string
): TimeGap[] {
  if (minRequired <= 0) return [];

  const open = toMinutes(openTime);
  const close = toMinutes(closeTime);
  if (open >= close) return [];

  const events = new Map<number, number>();
  events.set(open, 0);
  events.set(close, 0);

  for (const shift of shifts) {
    const start = Math.max(toMinutes(shift.startTime), open);
    const end = Math.min(toMinutes(shift.endTime), close);
    if (start >= end) continue;
    events.set(start, (events.get(start) ?? 0) + 1);
    events.set(end, (events.get(end) ?? 0) - 1);
  }

  const times = [...events.keys()].sort((a, b) => a - b);
  const intervals: TimeGap[] = [];
  let staffCount = 0;
  let shortageStart: number | null = null;

  for (let index = 0; index < times.length - 1; index++) {
    const time = times[index];
    staffCount += events.get(time) ?? 0;
    const nextTime = times[index + 1];
    const understaffed = nextTime > time && staffCount < minRequired;

    if (understaffed && shortageStart === null) shortageStart = time;
    if (!understaffed && shortageStart !== null) {
      intervals.push({ start: toTimeString(shortageStart), end: toTimeString(time) });
      shortageStart = null;
    }
  }

  if (shortageStart !== null) {
    intervals.push({ start: toTimeString(shortageStart), end: toTimeString(close) });
  }
  return intervals;
}

export function findDailyUnderstaffedIntervals(
  shifts: ShiftInterval[],
  minRequired: number,
  sessions: Array<{ openTime?: string | null; closeTime?: string | null }>
): TimeGap[] {
  return sessions.flatMap(({ openTime, closeTime }) =>
    openTime && closeTime
      ? findUnderstaffedIntervals(shifts, minRequired, openTime, closeTime)
      : []
  );
}
