# Test Report — TROVA data import + brand-aware stations + SYNCTX "Sync live" button

**How tested:** Ran the live deployments (trova-one.vercel.app and opsai-opal.vercel.app) end-to-end through the UI as admin, verifying the imported TROVA data renders correctly across pages and that the new SYNCTX Samsara sync button works.

**Result:** All 5 tests passed. No blockers.

## Escalations / caveats
- None blocking. Two contextual notes:
  - The month/day views on Fuel & FareEye show per-period counts (e.g. July = 47 fill-ups, 72 routes). The full-dataset totals (1,382 fuel / 864 routes) span multiple months and were cross-checked against the database, not tallied on a single screen.
  - Fuel rows correctly show a "Duplicate" badge on records the importer's dedup flagged — expected behavior, not an error.

## Test results
- **Test 1 — TROVA Vehicles: 36 active, ORF/RNH only** — passed. Fleet Overview reads **36**; station dropdown offers only **All stations / ORF / RNH** (no Texas stations); rows show real makes (INTERNATIONAL MV607, FORD TRANSIT 250) and "Mike Albert" lease.
- **Test 2 — TROVA Fuel columns + data** — passed. Rows show station RNH, **Location** ("WAWA 8626, RICHMOND, VA"), **Txn Time** ("15:37"), real Volume (12.6 Gal) and Price/Gal ($3.78).
- **Test 3 — TROVA FareEye routes** — passed. Routes aggregate by **RNH/ORF only**, station filter offers only ORF/RNH, utilization normalized as % (up to 99.1%, not raw fractions).
- **Test 4 — TROVA Service Costs by station** — passed. Total **$346,594.15 / 2,257 services** (matches DB); Cost-by-Station and per-category table show **ORF & RNH columns only**.
- **Test 5 — SYNCTX "Sync live" button** — passed. Button present in the dashboard blue box; clicking it ran `/api/samsara/sync` and displayed **"Updated 123 of 175"**. SYNCTX still shows only its 7 Texas stations (no ORF/RNH leak from brand config).

## Evidence

### Test 1 — TROVA Vehicles (36 active, ORF/RNH only)
| Fleet overview = 36 | Station filter = only ORF/RNH |
|---|---|
| ![36 active vehicles](/home/ubuntu/screenshots/ss_c23e9172.png) | ![ORF/RNH filter](/home/ubuntu/screenshots/ss_56cc2121.png) |

### Test 2 — TROVA Fuel (Location + Txn Time)
![Fuel rows with Location and Txn Time](/home/ubuntu/screenshots/ss_zoom_367f5272.png)

### Test 3 — TROVA FareEye (ORF/RNH, % utilization)
| Month view by station | Station filter ORF/RNH only |
|---|---|
| ![FareEye month](/home/ubuntu/screenshots/ss_483d18a3.png) | ![FareEye filter](/home/ubuntu/screenshots/ss_df160cae.png) |

### Test 4 — TROVA Service Costs
![Service costs $346,594 by ORF/RNH](/home/ubuntu/screenshots/ss_16002d6f.png)

### Test 5 — SYNCTX "Sync live" button
| Blue box with Sync live button | After click: "Updated 123 of 175" |
|---|---|
| ![Sync live button](/home/ubuntu/screenshots/ss_ac221b72.png) | ![Updated 123 of 175](/home/ubuntu/screenshots/ss_zoom_61dc3809.png) |
