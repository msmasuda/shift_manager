export type UserRole = "ADMIN" | "MEMBER";

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
}

export interface ScheduleDay {
  id: string;
  date: string;
  minRequired: number;
  openTime?: string | null;
  closeTime?: string | null;
  openTime2?: string | null;
  closeTime2?: string | null;
  shiftAssignments: ShiftAssignment[];
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
