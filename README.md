# Live Fleet AI — Fleet Management Platform

A complete, production-grade fleet management web application: live GPS tracking,
maintenance & work orders, drivers, trips/dispatch, fuel, geofencing, alerts, and
analytics — all in one place.

![Stack](https://img.shields.io/badge/Next.js-16-black) ![TS](https://img.shields.io/badge/TypeScript-5-blue) ![Prisma](https://img.shields.io/badge/Prisma-6-2D3748)

## Features

- **Dashboard** — live KPIs, fleet status, trips, fuel spend, top drivers, upcoming maintenance.
- **Live Map** — real-time vehicle positions with a built-in GPS/telemetry simulator, geofence overlays, heading/speed, and a searchable vehicle list. Powered by MapLibre + OpenStreetMap (no API key required).
- **Vehicles** — full CRUD, status, fuel level, odometer, compliance docs, per-vehicle detail with maintenance/fuel/trip history.
- **Drivers** — full CRUD, license tracking, safety scores, ratings, assignments, per-driver detail.
- **Trips & Dispatch** — schedule trips, assign vehicles/drivers, update status, track distance.
- **Maintenance** — work orders with type/priority/status/cost, service scheduling, overdue tracking.
- **Fuel** — fuel logs with cost analytics (spend, volume, avg price).
- **Geofencing** — depot/customer/service/restricted zones drawn on the live map.
- **Alerts** — speeding, geofence, low-fuel, maintenance-due, document-expiry notifications with read/resolve.
- **Reports & Analytics** — cost trends, fleet composition, top-cost vehicles, CSV export.
- **Auth & RBAC** — session auth (JWT cookie) with three roles: **Admin**, **Manager** (full management), **Driver** (read-only).

## Tech Stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 16 (App Router) + React 19 |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| ORM / DB | Prisma 6 · SQLite (dev) — Postgres-ready |
| Auth | JWT session cookie (`jose`) + `bcryptjs` |
| Maps | MapLibre GL + OpenStreetMap |
| Charts | Recharts |
| Icons | lucide-react |

## Quick Start

```bash
npm install
cp .env.example .env        # adjust AUTH_SECRET for production
npm run setup               # prisma generate + db push + seed demo data
npm run dev                 # http://localhost:3000
```

### Demo accounts

| Role | Email | Password |
| --- | --- | --- |
| Admin | `admin@fleetops.com` | `admin123` |
| Manager | `manager@fleetops.com` | `manager123` |
| Driver | `driver@fleetops.com` | `driver123` |

## Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Start dev server |
| `npm run build` / `npm start` | Production build / serve |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run setup` | Generate client, push schema, seed |
| `npm run db:seed` | Re-seed demo data |
| `npm run db:reset` | Reset DB and re-seed |

## Going to Production

1. In `prisma/schema.prisma`, set `datasource.provider = "postgresql"`.
2. Point `DATABASE_URL` at your Postgres instance and run `npx prisma migrate deploy`.
3. Set a strong `AUTH_SECRET` (`openssl rand -hex 32`).
4. Replace the GPS simulator (`/api/simulate`) with your real telematics ingestion.

## Architecture

```
src/
  app/
    (dashboard)/        # authenticated app shell + pages
    api/                # route handlers (REST) for every resource
    login/              # public login
    middleware.ts       # auth gate
  components/            # UI primitives, charts, map, feature clients
  lib/                  # db, auth, api helpers, utils, constants, types
prisma/
  schema.prisma         # data model
  seed.ts               # realistic demo data
```
