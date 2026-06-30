import * as XLSX from "xlsx";
import type { ScheduleDay, User } from "@/types";

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

export function exportShifts(days: ScheduleDay[], users: User[], month: string) {
  const headers = [
    "名前",
    ...days.map((d) => {
      const dt = new Date(d.date.slice(0, 10) + "T00:00:00Z");
      return `${dt.getUTCMonth() + 1}/${dt.getUTCDate()}(${WEEKDAYS[dt.getUTCDay()]})`;
    }),
  ];

  const sortedUsers = [...users].sort((a, b) => a.name.localeCompare(b.name, "ja"));

  const rows = sortedUsers.map((user) => {
    const cells = days.map((day) => {
      const shift = day.shiftAssignments.find((s) => s.userId === user.id);
      if (shift) return `${shift.startTime}-${shift.endTime}`;
      const leave = day.leaveRecords.find((l) => l.userId === user.id);
      if (leave?.type === "PAID_LEAVE") return "有給";
      if (leave?.type === "PREFERRED_OFF") return "希望休";
      return "";
    });
    return [user.name, ...cells];
  });

  const minRow = ["最低人数", ...days.map((d) => d.minRequired)];

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows, minRow]);
  ws["!cols"] = [{ wch: 14 }, ...days.map(() => ({ wch: 14 }))];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, `${month} シフト表`);
  XLSX.writeFile(wb, `シフト表_${month}.xlsx`);
}
