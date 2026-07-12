# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start Next.js dev server on :3000
npm run build        # Production build
npm run lint         # ESLint
npm test             # Run Vitest unit tests once
npm run test:watch   # Vitest in watch mode
npm run test:e2e     # Run Playwright E2E tests (src: e2e/*.spec.ts)
npm run test:e2e:ui  # Playwright in UI mode

# Single test file
npx vitest run src/__tests__/api/shifts.test.ts

# Database
npx prisma db push        # Apply schema to DB (no migration files)
npx prisma studio         # Open Prisma Studio GUI
npx prisma db seed        # Seed with tsx prisma/seed.ts
```

## Environment Setup

Copy `.env.example` to `.env` and configure `DATABASE_URL`. The default points to `192.168.100.2:5432`; use `docker-compose up -d` to spin up a local PostgreSQL instance on the same port instead.

`NEXT_PUBLIC_API_URL` is intentionally left empty — the app defaults to the same-origin Next.js Route Handlers (`/api/...`).

Auth also requires `AUTH_SECRET` (`openssl rand -base64 32`). `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET` are optional — Google sign-in is only enabled when `AUTH_GOOGLE_ID` is set.

## Architecture

This is a **monorepo Next.js 15 App Router** app with the backend API co-located as Route Handlers. There is no separate backend process.

```
src/
  app/
    api/           # Next.js Route Handlers (the backend)
      auth/[...nextauth]/
      organizations/
      users/
      shifts/[id]/
      shifts/my/
      schedule/days/[date]/
      schedule/warnings/
      leave/[id]/
    admin/         # Admin dashboard (client components + DnD)
    my-shifts/     # Member view
    login/         # Sign-in page
  lib/
    api.ts         # Typed fetch wrapper used by client components
    prisma.ts      # Singleton PrismaClient (dev hot-reload safe)
  auth.ts          # NextAuth providers + JWT/session callbacks
  auth.config.ts   # Shared NextAuth config (used by middleware and auth.ts)
  middleware.ts    # Route protection (auth + role checks)
  types/index.ts   # Shared domain types (Organization, User, ScheduleDay, ShiftAssignment, LeaveRecord, etc.)
prisma/
  schema.prisma    # Source of truth for DB schema
  seed.ts          # Dev seed data
```

### Data Model

```
Organization ──< User
Organization ──< ScheduleDay ──< ShiftAssignment >── User
User ──< LeaveRecord
```

- `ScheduleDay` records a date + `minRequired` (minimum staff count) + `isHoliday`; upserted on shift creation. Marking a day as holiday sets `minRequired` to 0 and clears its shifts.
- `Organization`/`ScheduleDay` both carry optional `openTime`/`closeTime` (+ a second `openTime2`/`closeTime2` session) for business-hours coverage checks; per-day values override the org default.
- `ShiftAssignment` stores `startTime`/`endTime` as `"HH:MM"` strings (not `DateTime`).
- `LeaveRecord` tracks `PREFERRED_OFF`/`PAID_LEAVE` per user per day (unique on `userId`+`date`).
- `User.passwordHash` is optional (only set for Credentials/email-password sign-in; Google-only users have none).
- One user per day per organization: duplicate assignment returns 409.

### Key Patterns

- **API layer**: `src/lib/api.ts` provides a typed client (`api.organizations`, `api.users`, `api.schedule`, `api.shifts`, `api.leave`) used uniformly across all client components. Route Handlers validate input with Zod.
- **Data fetching**: SWR with composite keys (e.g., `["scheduleDays", orgId, start, end]`) in page components.
- **Drag-and-drop**: `@dnd-kit` — draggable shift cards (`DraggableCard`) drop onto day columns (`DayColumn`), which calls `api.shifts.update` with a new `date`.
- **Warning system**: `/api/schedule/warnings` returns two kinds of issues, surfaced in a collapsible panel on the admin page — `staffWarnings` (days where assigned staff count < `minRequired`, or gaps in business-hours coverage) and `laborViolations` (7+ consecutive days worked, or >40 hrs in an ISO week). Holidays are excluded from `staffWarnings`.
- **Auth**: NextAuth.js v5 (Auth.js) with Google OAuth (conditional on `AUTH_GOOGLE_ID`) and email/password (Credentials + bcryptjs). `src/auth.ts` / `src/auth.config.ts` define providers and JWT/session callbacks (session carries `userId`/`organizationId`/`role`). `middleware.ts` blocks unauthenticated requests (redirect to `/login`, or 401 for `/api/*`) and restricts `/admin` and non-GET `/api/users` to `ADMIN` role. Route Handlers read `organizationId`/`userId` from `auth()` rather than trusting client input.
- **DB adapter**: `src/lib/prisma.ts` picks the driver at runtime — Prisma Postgres URLs (`prisma://` or containing `prisma.io`) use `withAccelerate()`; any other Postgres URL (e.g. local Docker) uses `@prisma/adapter-pg` directly.

### Testing

- Unit tests live in `src/__tests__/api/` and test Route Handler functions directly (not via HTTP). They mock `@/lib/prisma` with `vi.mock` and import handler functions (`POST`, `PATCH`, `DELETE`) to call them with synthetic `Request` objects.
- E2E tests live in `e2e/*.spec.ts` (Playwright) and drive the admin dashboard and schedule page through a real browser.
