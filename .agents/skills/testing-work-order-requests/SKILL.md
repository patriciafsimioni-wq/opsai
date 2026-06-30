---
name: testing-work-order-requests
description: Test the Work Order Requests feature end-to-end including PO number generation, form submission, review/approval workflow, and data persistence. Use when verifying WO Request UI or API changes.
---

# Testing Work Order Requests

## Prerequisites

- Dev server running: `npx next dev --turbopack` from `/home/ubuntu/opsai`
- Database seeded: `npx prisma migrate reset --force && npx prisma db seed`
- Browser open to `http://localhost:3000/work-order-requests`
- Logged in as admin (admin@livefleet.ai / admin123) for full access (review + approve/reject)

## Demo Accounts

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@livefleet.ai | admin123 |
| Manager | manager@livefleet.ai | manager123 |
| Driver | driver@livefleet.ai | driver123 |

## Key Test Areas

### 1. PO Number Auto-Generation
- PO numbers use 2-letter station prefix + zero-padded sequence number
- Station prefix mapping: IAH->IA, AUS->AU, HRL->HR, ACT->AC, LRD->LR, CLL->CL, BPT->BP
- Each station has a start sequence (defined in `src/lib/constants.ts` PO_START)
- New requests use max(existing_max + 1, PO_START) for that station's prefix
- Verify PO# appears in: table column, review modal, detail (expanded) view

### 2. Form Submission
- Station dropdown filters vehicles to that station only
- Vehicle selection auto-fills odometer from database
- Required fields: Station, Vehicle (or Other), Service, Requested Date
- "Other" vehicle option shows a text input for custom vehicle identifier
- Parts are multi-select chip buttons
- Submit should show success message and new row appears at top of table

### 3. Review/Approval Workflow
- Only ADMIN and MANAGER roles see "Review" buttons on pending requests
- Review modal shows PO#, requester, station, vehicle, service details
- Approve/Reject with optional review note
- Status changes reflected in table immediately
- KPI cards (Total, Pending, Approved, Rejected) update on changes

### 4. Data Persistence
- PO# is immutable — does not change when status changes
- Expanding a row (chevron) shows full detail view with PO Number field
- Filter tabs (All/Pending/Approved/Rejected) correctly filter rows

## Common Issues

### Database Reset Required After Schema Changes
If you modify the Prisma schema, you must:
1. `npx prisma migrate reset --force` (drops DB, re-applies migrations)
2. `npx prisma db seed` (re-seeds data)
3. Restart dev server (kill and re-run `npx next dev --turbopack`)
4. Log out and back in (JWT contains user IDs that change after reset)

### Stale JWT After DB Reset
After `prisma migrate reset`, user IDs change. Old JWT tokens will cause 500 errors on form submission (foreign key constraint violation). Fix: log out, log back in.

### Dev Server Must Be Restarted After Migration
The dev server caches Prisma client. After schema changes + migration, kill the old server process and restart to pick up new fields.

### Vehicle Dropdown Shows Wrong Vehicles
The vehicle dropdown filters by station. If you change station, the vehicle dropdown should update. If it doesn't show expected vehicles, the station's vehicles might not be seeded — check `prisma/seed.ts`.

## Test Procedure (Recommended)

1. Start recording (maximize browser first)
2. Navigate to /work-order-requests
3. Verify table displays with PO# column and all seeded data
4. Create new request — verify PO# generated correctly
5. Create second request for same station — verify increment
6. Create request for different station — verify prefix change
7. Click Review on a pending request — verify PO# in modal
8. Approve/Reject — verify status change and PO# persistence
9. Expand row — verify detail view shows PO Number
10. Stop recording

## Code References

- `src/lib/constants.ts`: PO_PREFIX and PO_START mappings
- `src/app/api/work-order-requests/route.ts`: GET (list) and POST (create with PO generation)
- `src/app/api/work-order-requests/[id]/route.ts`: PUT (approve/reject)
- `src/components/WorkOrderRequestsClient.tsx`: Full UI component
- `prisma/schema.prisma`: WorkOrderRequest model with poNumber field
- `prisma/seed.ts`: Seed data generation with PO numbers

## Devin Secrets Needed

None — uses app-level authentication with demo accounts hardcoded in seed data.
