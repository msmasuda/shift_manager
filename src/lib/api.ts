import type { User, Organization, ScheduleDay, ShiftAssignment, WarningsResponse, LeaveRecord, LeaveType } from "@/types";

const API = process.env.NEXT_PUBLIC_API_URL ?? "";

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const base = API || (typeof window !== "undefined" ? window.location.origin : "http://localhost:3000");
  const res = await fetch(new URL(path, base), {
    method,
    ...(body !== undefined && {
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    let message = text;
    try {
      message = JSON.parse(text).error ?? text;
    } catch {}
    throw new Error(message);
  }
  return res.status === 204 ? (undefined as T) : res.json();
}

function get<T>(path: string, params?: Record<string, string>): Promise<T> {
  const query = params ? `?${new URLSearchParams(params)}` : "";
  return request<T>("GET", path + query);
}
const post = <T>(path: string, body: unknown) => request<T>("POST", path, body);
const put = <T>(path: string, body: unknown) => request<T>("PUT", path, body);
const patch = <T>(path: string, body: unknown) => request<T>("PATCH", path, body);
const del = (path: string) => request<void>("DELETE", path);

/** API エラーをユーザーに通知する（UI ハンドラーの catch 用） */
export function alertError(error: unknown) {
  window.alert(error instanceof Error ? error.message : String(error));
}

export const api = {
  organizations: {
    get: (id: string) => get<Organization>(`/api/organizations/${id}`),
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
    bulkFill: (from: string, to: string, options?: { overwrite?: boolean; preview?: boolean }) =>
      post<{ created: number; updated: number }>("/api/schedule/bulk-fill", {
        from,
        to,
        overwrite: options?.overwrite ?? false,
        preview: options?.preview ?? false,
      }),
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
