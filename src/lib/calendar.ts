export type CalendarCell = { date: string; day: number } | null;

export function buildCalendarCells(yearMonth: string): CalendarCell[] {
  const [year, month] = yearMonth.split("-").map(Number);
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cells: CalendarCell[] = Array.from({ length: firstWeekday }, () => null);

  for (let day = 1; day <= lastDay; day++) {
    cells.push({
      date: `${yearMonth}-${String(day).padStart(2, "0")}`,
      day,
    });
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}
