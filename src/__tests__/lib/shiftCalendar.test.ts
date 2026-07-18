import { describe, expect, it } from "vitest";
import { buildCalendarCells } from "@/lib/calendar";

describe("buildCalendarCells", () => {
  it("日曜日始まりの月を余白なしで生成する", () => {
    const cells = buildCalendarCells("2026-02");
    expect(cells).toHaveLength(28);
    expect(cells[0]).toEqual({ date: "2026-02-01", day: 1 });
    expect(cells[27]).toEqual({ date: "2026-02-28", day: 28 });
  });

  it("月初前と月末後を空セルで埋めて週単位にする", () => {
    const cells = buildCalendarCells("2026-07");
    expect(cells).toHaveLength(35);
    expect(cells.slice(0, 3)).toEqual([null, null, null]);
    expect(cells[3]).toEqual({ date: "2026-07-01", day: 1 });
    expect(cells[33]).toEqual({ date: "2026-07-31", day: 31 });
    expect(cells[34]).toBeNull();
  });
});
