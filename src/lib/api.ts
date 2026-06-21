import type { User, ScheduleDay, ShiftAssignment, ScheduleWarning } from "@/types";

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
    list: () => get<{ id: string; name: string }[]>("/api/organizations"),
    create: (name: string) => post<{ id: string; name: string }>("/api/organizations", { name }),
  },
  users: {
    list: (organizationId: string) =>
      get<User[]>("/api/users", { organizationId }),
    create: (data: { organizationId: string; email: string; name: string; role?: string }) =>
      post<User>("/api/users", data),
  },
  schedule: {
    days: (organizationId: string, from: string, to: string) =>
      get<ScheduleDay[]>("/api/schedule/days", { organizationId, from, to }),
    setMinRequired: (date: string, organizationId: string, minRequired: number) =>
      put<ScheduleDay>(`/api/schedule/days/${date}`, { organizationId, minRequired }),
    warnings: (organizationId: string, from: string, to: string) =>
      get<ScheduleWarning[]>("/api/schedule/warnings", { organizationId, from, to }),
  },
  shifts: {
    my: (userId: string, from?: string, to?: string) =>
      get<ShiftAssignment[]>("/api/shifts/my", { userId, ...(from && { from }), ...(to && { to }) }),
    create: (data: {
      organizationId: string;
      date: string;
      userId: string;
      startTime: string;
      endTime: string;
    }) => post<ShiftAssignment>("/api/shifts", data),
    update: (id: string, data: { date?: string; userId?: string; startTime?: string; endTime?: string }) =>
      patch<ShiftAssignment>(`/api/shifts/${id}`, data),
    delete: (id: string) => del(`/api/shifts/${id}`),
  },
};
