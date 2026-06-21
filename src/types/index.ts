export type UserRole = "ADMIN" | "MEMBER";

export interface Organization {
  id: string;
  name: string;
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

export interface ScheduleWarning {
  date: string;
  minRequired: number;
  assignedCount: number;
  insufficient: boolean;
}
