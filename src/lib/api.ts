import type { User, Organization, ScheduleDay, ShiftAssignment, WarningsResponse, LeaveRecord, LeaveType } from "@/types";

const API = process.env.NEXT_PUBLIC_API_URL ?? "";

async function get<T>(path: string, params?: Record<string, string>): Promise<T> {
  const base = API || (typeof window !== "undefined" ? window.location.origin : "http://localhost:3000");
  const url = new URL(path, base);
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const base = API || (typeof window !== "undefined" ? window.location.origin : "http://localhost:3000");
  const res = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function put<T>(path: string, body: unknown): Promise<T> {
  const base = API || (typeof window !== "undefined" ? window.location.origin : "http://localhost:3000");
  const res = await fetch(`${base}${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function patch<T>(path: string, body: unknown): Promise<T> {
  const base = API || (typeof window !== "undefined" ? window.location.origin : "http://localhost:3000");
  const res = await fetch(`${base}${path}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function del(path: string): Promise<void> {
  const base = API || (typeof window !== "undefined" ? window.location.origin : "http://localhost:3000");
  const res = await fetch(`${base}${path}`, { method: "DELETE" });
  if (!res.ok) throw new Error(await res.text());
}

export const api = {
  organizations: {
    list: () => get<Organization[]>("/api/organizations"),
    get: (id: string) => get<Organization>(`/api/organizations/${id}`),
    create: (name: string) => post<Organization>("/api/organizations", { name }),
    update: (id: string, data: { name?: string; openTime?: string | null; closeTime?: string | null; openTime2?: string | null; closeTime2?: string | null }) =>
      patch<Organization>(`/api/organizations/${id}`, data),
  },
  users: {
    list: () => get<User[]>("/api/users"),
    create: (data: { email: string; name: string; role?: string }) =>
      post<User>("/api/users", data),
    update: (
      id: string,
      data: { defaultStartTime?: string | null; defaultEndTime?: string | null }
    ) => patch<User>(`/api/users/${id}`, data),
  },
  schedule: {
    days: (from: string, to: string) =>
      get<ScheduleDay[]>("/api/schedule/days", { from, to }),
    setMinRequired: (date: string, minRequired: number) =>
      put<ScheduleDay>(`/api/schedule/days/${date}`, { minRequired }),
    setHoliday: (date: string, isHoliday: boolean) =>
      put<ScheduleDay>(`/api/schedule/days/${date}`, { isHoliday }),
    setHours: (date: string, openTime: string | null, closeTime: string | null, openTime2?: string | null, closeTime2?: string | null) =>
      put<ScheduleDay>(`/api/schedule/days/${date}`, { openTime, closeTime, openTime2, closeTime2 }),
    warnings: (from: string, to: string) =>
      get<WarningsResponse>("/api/schedule/warnings", { from, to }),
    bulkFill: (from: string, to: string) =>
      post<{ created: number }>("/api/schedule/bulk-fill", { from, to }),
  },
  shifts: {
    my: (from?: string, to?: string) =>
      get<ShiftAssignment[]>("/api/shifts/my", { ...(from && { from }), ...(to && { to }) }),
    create: (data: {
      date: string;
      userId: string;
      startTime: string;
      endTime: string;
    }) => post<ShiftAssignment>("/api/shifts", data),
    update: (id: string, data: { date?: string; userId?: string; startTime?: string; endTime?: string }) =>
      patch<ShiftAssignment>(`/api/shifts/${id}`, data),
    delete: (id: string) => del(`/api/shifts/${id}`),
  },
  leave: {
    list: (from: string, to: string) =>
      get<LeaveRecord[]>("/api/leave", { from, to }),
    set: (date: string, type: LeaveType) =>
      post<LeaveRecord>("/api/leave", { date, type }),
    cancel: (id: string) => del(`/api/leave/${id}`),
  },
};
