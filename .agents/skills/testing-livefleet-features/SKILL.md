---
name: testing-livefleet-features
description: Test Live Fleet AI features end-to-end including Fuel filters, Finance Report views, Smart Upload classification, FareEye Routes, and Work Order Requests. Use when verifying UI or API changes to any fleet management feature.
---

# Testing Live Fleet AI Features

## Prerequisites

- Dev server running: `npx next dev --turbopack` from `/home/ubuntu/opsai`
- Database seeded: `npx prisma migrate reset --force && npx prisma db seed`
- Browser open to `http://localhost:3000`
- Logged in as admin (admin@livefleet.ai / admin123)

## Demo Accounts

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@livefleet.ai | admin123 |
| Manager | manager@livefleet.ai | manager123 |
| Driver | driver@livefleet.ai | driver123 |

## Key Test Areas

### 1. Fuel Page Filters (`/fuel`)
- **Station dropdown**: Shows "All stations" + 7 stations (ACT, AUS, BPT, CLL, HRL, IAH, LRD)
- **Week/Month toggle**: Switches between monthly and weekly date ranges
- **Date navigation**: Left/right arrows move between weeks or months
- **Stat cards update**: Total Spend, Total Volume, Avg Price/L, Fill-ups all reflect filters
- **Table filtering**: Only rows matching selected station appear
- **API endpoint**: `/api/fuel?station=X&range=week|month&date=YYYY-MM-DD`

### 2. Finance Report (`/finance-report`)
- **Week/Month toggle**: Switches between monthly (month selector dropdown) and weekly (date nav arrows) views
- **Station tabs**: 8 tabs — Consolidated TX, IAH, AUS, HRL, LRD, ACT, CLL, BPT
- **14 PM categories**: Brakes, Tires, Oil Change, Brake Calipers, Drivetrain, Transmission, etc.
- **Table header**: Shows station name (e.g., "BPT - Beaumont") when tab selected
- **YTD summary cards**: YTD Actual Spend, YTD Budget, Annual Budget, Remainder
- **API endpoint**: `/api/finance-report?year=X&month=Y&view=week&weekDate=YYYY-MM-DD`

### 3. Smart Upload (`/uploads`)
- **Drop zone**: Accepts .xlsx, .csv, .pdf, .png, .jpg files (max 20 MB)
- **AI classification**: Matches file headers/filename to categories
- **Categories**: Fleet/Vehicles, Service History, FareEye Routes, PM Budget, Fuel Log, Driver Data, Invoice, Document, Photo
- **Classification rules**: Header keyword matching (min 3 matches for most categories)
- **Preview**: Expandable table showing first 5 rows of classified data
- **Multiple files**: Can upload multiple files; each classified independently
- **API endpoint**: POST `/api/uploads/classify` with multipart form data

### 4. FareEye Routes (`/fareye-routes`)
- **Day/Week/Month toggle**: Aggregates route data by selected period
- **Station filter**: Filters routes by station
- **Summary stats**: Total routes, total miles, avg utilization, avg SPORH
- **API endpoint**: `/api/fareye-routes?range=day|week|month&date=YYYY-MM-DD&station=X`

### 5. Reports & Analytics (`/reports`)
- **Station dropdown**: Shows "All stations" + 7 stations (ACT, AUS, BPT, CLL, HRL, IAH, LRD)
- **Week/Month toggle**: Switches between monthly and weekly date ranges
- **Date navigation**: Left/right arrows move between weeks or months
- **8 KPI cards**: Total Costs, Fuel Spend, Maintenance Spend, Fill-ups, Total Vehicles, Active Vehicles, Avg Mileage, Work Orders
- **MoM trend indicators**: Fuel Spend and Maintenance Spend show % change vs previous month
- **10+ charts**: Cost Trend (6mo), Fleet by Status donut, Monthly Fuel Spend, Avg Fuel Price, Fuel by Station, Top Maintenance Services, Vehicles by Type, Mileage Distribution, Top 10 Cost Vehicles, Monthly Fill-ups
- **Chart subtitles update**: "this month" ↔ "this week" based on toggle
- **Export CSV button**: Downloads report data
- **API endpoint**: `/api/reports?station=X&range=week|month&date=YYYY-MM-DD`
- **Baseline (all stations, June 2026 month)**: $22,977 total, $22,225 fuel, $751 maint, 228 fill-ups, 133 vehicles, 125 active, 51,592 mi avg mileage, 12 WOs
- **Baseline (BPT, June 2026 month)**: $407 total, 6 fill-ups, 4 vehicles, 9,135 mi avg mileage
- **Baseline (all stations, week Jun 29–Jul 5)**: $861 fuel, 9 fill-ups

### 6. KM → Mileage Labels
- All distance labels changed from "km" to "mi" across the app
- **Fuel modal**: "Odometer (mi)" field label in Log Fuel Purchase dialog
- **Vehicles table**: Odometer column shows "X mi"
- **Vehicle detail page**: Odometer card shows "X mi", trip distances show "X mi"
- **Drivers detail page**: Trip distances show "X mi"
- **Files changed**: FuelClient.tsx, VehiclesClient.tsx, vehicles/[id]/page.tsx, drivers/[id]/page.tsx, TripsClient.tsx

### 7. Work Order Requests (`/work-order-requests`)
- See separate skill: `testing-work-order-requests/SKILL.md`

## Test Data Reference

| Data | Count | Notes |
|------|-------|-------|
| Vehicles | 133 | Across 7 stations (IAH 63, AUS 37, HRL 12, ACT 7, LRD 7, BPT 4, CLL 3) |
| Fuel Logs | ~836 | Seeded with random data, ~228 per month |
| Service Records | 208+ | Real maintenance history from Services+History.xlsx |
| FareEye Routes | 45 | IAH station, June 30 data |
| PM Budgets | 672 | 14 categories x 12 months x 4 stations |

## Test Files for Smart Upload

- `/home/ubuntu/attachments/c843ab61.../Fleet-2.xlsx` — should classify as "Fleet / Vehicles" (high)
- `/home/ubuntu/attachments/293afe12.../Services+History.xlsx` — should classify as "Service History" (high)
- `/home/ubuntu/attachments/c6fb2a4e.../Fareye.xlsx` — should classify as "FareEye Routes" (high)
- PM PDF files — should classify as "PM Budget" (medium, filename-based)

Note: When uploading via curl, you must set the MIME type explicitly (e.g., `type=application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`) or the API may reject the file as "Unsupported file type: application/octet-stream". The browser file input handles this automatically.

## Common Issues

### API Returns Login Redirect
If API calls return HTML (the login page) instead of JSON, your session cookie is expired. Log in again via POST `/api/auth/login` with `{"email":"admin@livefleet.ai","password":"admin123"}` and save the cookie.

### Database Reset Required After Schema Changes
If you modify the Prisma schema:
1. `npx prisma migrate reset --force`
2. `npx prisma db seed`
3. Restart dev server
4. Log out and back in (JWT contains user IDs that change after reset)

### Stale JWT After DB Reset
After `prisma migrate reset`, user IDs change. Old JWT tokens cause 500 errors. Fix: log out, log back in.

### Smart Upload MIME Type Issue
When testing Smart Upload via curl/API, the file's content type must be set correctly. The browser handles this automatically, but curl sends `application/octet-stream` by default. Use `-F "file=@path;type=application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"` for .xlsx files.

### Reports Page Shows Zeros on First Load
After code changes, the Reports page may show all zeros and "Loading..." for the date on first load. This is likely a stale browser cache. Hard-refresh with Ctrl+Shift+R to force recompilation. The API itself (`/api/reports`) may work fine via curl even when the browser shows zeros.

### Prisma groupBy with Non-Nullable Enum Fields
Don't use `{ field: { not: null } }` in a `where` clause for Prisma `groupBy` on non-nullable enum fields — Prisma rejects it with "Argument 'not' must not be null". Instead, omit the `where` clause entirely since the field can't be null anyway.

### Finance Report Shows All Dashes for New Stations
ACT, CLL, BPT may show all dashes in the Finance Report because they don't have PM budget data configured. This is expected — only IAH, AUS, HRL, LRD have budget entries.

## Test Procedure

1. Query API for baseline data counts before starting UI tests
2. Maximize browser window (`wmctrl -r :ACTIVE: -b add,maximized_vert,maximized_horz`)
3. Start recording
4. Test each feature area with specific assertions (count changes, label updates, classification results)
5. Use annotate_recording for structured test annotations
6. Stop recording and write test report with screenshots

## Code References

- `src/components/FuelClient.tsx`: Fuel page with station/week/month controls
- `src/components/FinanceReportClient.tsx`: Finance Report with week/month toggle
- `src/components/UploadsClient.tsx`: Smart Upload with classification display
- `src/components/FareyeRoutesClient.tsx`: FareEye Routes with aggregation
- `src/app/api/fuel/route.ts`: Fuel API with station + date range filtering
- `src/app/api/finance-report/route.ts`: Finance Report API with week view support
- `src/app/api/uploads/classify/route.ts`: File classification rules engine
- `src/app/api/fareye-routes/route.ts`: FareEye Routes API
- `src/components/ReportsClient.tsx`: Reports & Analytics with station/week/month controls
- `src/app/api/reports/route.ts`: Reports API with station + date range filtering

## Devin Secrets Needed

None — uses app-level authentication with demo accounts hardcoded in seed data.
