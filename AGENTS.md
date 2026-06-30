# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start Next.js dev server on :3000
npm run build        # Production build
npm run lint         # ESLint
npm test             # Run Vitest unit tests once
npm run test:watch   # Vitest in watch mode

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

## Architecture

This is a **monorepo Next.js 15 App Router** app with the backend API co-located as Route Handlers. There is no separate backend process.

```
src/
  app/
    api/           # Next.js Route Handlers (the backend)
      organizations/
      users/
      shifts/[id]/
      shifts/my/
      schedule/days/[date]/
      schedule/warnings/
    admin/         # Admin dashboard (client components + DnD)
    my-shifts/     # Member view
  lib/
    api.ts         # Typed fetch wrapper used by client components
    prisma.ts      # Singleton PrismaClient (dev hot-reload safe)
  types/index.ts   # Shared domain types (Organization, User, ScheduleDay, ShiftAssignment, etc.)
prisma/
  schema.prisma    # Source of truth for DB schema
  seed.ts          # Dev seed data
```

### Data Model

```
Organization ──< User
Organization ──< ScheduleDay ──< ShiftAssignment >── User
```

- `ScheduleDay` records a date + `minRequired` (minimum staff count); upserted on shift creation.
- `ShiftAssignment` stores `startTime`/`endTime` as `"HH:MM"` strings (not `DateTime`).
- One user per day per organization: duplicate assignment returns 409.

### Key Patterns

- **API layer**: `src/lib/api.ts` provides a typed client (`api.organizations`, `api.users`, `api.schedule`, `api.shifts`) used uniformly across all client components. Route Handlers validate input with Zod.
- **Data fetching**: SWR with composite keys (e.g., `["scheduleDays", orgId, start, end]`) in page components.
- **Drag-and-drop**: `@dnd-kit` — draggable shift cards (`DraggableCard`) drop onto day columns (`DayColumn`), which calls `api.shifts.update` with a new `date`.
- **Warning system**: `/api/schedule/warnings` returns days where assigned staff count < `minRequired`; surfaced as a banner in the admin page.
- **No auth**: `organizationId` is passed as a query param / selected via dropdown. Authentication is planned (NextAuth.js or Clerk) but not implemented.

### Testing

Tests live in `src/__tests__/api/` and test Route Handler functions directly (not via HTTP). They mock `@/lib/prisma` with `vi.mock` and import handler functions (`POST`, `PATCH`, `DELETE`) to call them with synthetic `Request` objects.
