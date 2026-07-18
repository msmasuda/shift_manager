import { describe, expect, it } from "vitest";
import {
  findDailyUnderstaffedIntervals,
  findUnderstaffedIntervals,
} from "@/lib/staffingCoverage";

describe("findUnderstaffedIntervals", () => {
  it("営業時間を通して最低人数を満たす場合は不足なし", () => {
    const shifts = [
      { startTime: "09:00", endTime: "18:00" },
      { startTime: "08:30", endTime: "18:30" },
    ];
    expect(findUnderstaffedIntervals(shifts, 2, "09:00", "18:00")).toEqual([]);
  });

  it("勤務者がいても最低人数を下回る時間帯を検出する", () => {
    const shifts = [
      { startTime: "09:00", endTime: "18:00" },
      { startTime: "10:00", endTime: "17:00" },
    ];
    expect(findUnderstaffedIntervals(shifts, 2, "09:00", "18:00")).toEqual([
      { start: "09:00", end: "10:00" },
      { start: "17:00", end: "18:00" },
    ]);
  });

  it("連続する不足区間を一つにまとめる", () => {
    const shifts = [
      { startTime: "10:00", endTime: "12:00" },
      { startTime: "12:00", endTime: "17:00" },
    ];
    expect(findUnderstaffedIntervals(shifts, 2, "09:00", "18:00")).toEqual([
      { start: "09:00", end: "18:00" },
    ]);
  });

  it("昼と夜の営業時間をそれぞれ判定する", () => {
    const shifts = [{ startTime: "09:00", endTime: "15:00" }];
    expect(findDailyUnderstaffedIntervals(shifts, 1, [
      { openTime: "09:00", closeTime: "14:00" },
      { openTime: "17:00", closeTime: "21:00" },
    ])).toEqual([{ start: "17:00", end: "21:00" }]);
  });
});
