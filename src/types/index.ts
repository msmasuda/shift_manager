export type UserRole = "ADMIN" | "MEMBER";
export type LeaveType = "PREFERRED_OFF" | "PAID_LEAVE";

export interface Organization {
  id: string;
  name: string;
  openTime?: string | null;
  closeTime?: string | null;
  openTime2?: string | null;
  closeTime2?: string | null;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  defaultStartTime?: string | null;
  defaultEndTime?: string | null;
}

export interface ScheduleDay {
  id: string;
  date: string;
  minRequired: number;
  isHoliday: boolean;
  openTime?: string | null;
  closeTime?: string | null;
  openTime2?: string | null;
  closeTime2?: string | null;
  shiftAssignments: ShiftAssignment[];
  leaveRecords: LeaveRecord[];
}

export interface LeaveRecord {
  id: string;
  userId: string;
  date: string;
  type: LeaveType;
}

export interface ShiftAssignment {
  id: string;
  scheduleDayId: string;
  userId: string;
  user?: User;
  startTime: string;
  endTime: string;
  scheduleDay?: { date: string; minRequired: number };
}

export interface TimeGap {
  start: string;
  end: string;
}

export interface ScheduleWarning {
  date: string;
  minRequired: number;
  assignedCount: number;
  insufficient: boolean;
  openTime?: string;
  closeTime?: string;
  gaps: TimeGap[];
}

export interface LaborViolation {
  userId: string;
  userName: string;
  type: "WEEKLY_HOURS" | "CONSECUTIVE_DAYS";
  detail: string;
}

export interface WarningsResponse {
  staffWarnings: ScheduleWarning[];
  laborViolations: LaborViolation[];
}
