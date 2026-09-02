# Test Plan — TROVA data import + brand-aware stations + SYNCTX Samsara "Sync live" button

Environment: live deployments
- TROVA: https://trova-one.vercel.app (NEXT_PUBLIC_BRAND=TROVA, own DB)
- SYNCTX: https://opsai-opal.vercel.app (NEXT_PUBLIC_BRAND=SYNCTX)
- Login: admin@livefleet.ai / admin123

Why these tests would fail if broken: a broken import would show 0 or wrong counts / wrong stations; a broken brand config would show the 7 Texas stations on TROVA; a missing button would not appear / not trigger a network call.

## DB baseline (established via script, for cross-check)
- Active vehicles (offboardStatus null): 36 — RNH 22, ORF 14
- Fuel logs: 1,382 ($105,293 spend)
- Service work orders (COMPLETED): 2,257 ($346,594)
- FareEye routes: 864 — ORF 456, RNH 408

---

## Test 1 — TROVA Vehicles page shows exactly 36 active vehicles, ORF/RNH only
Steps:
1. Go to trova-one.vercel.app → Vehicles.
2. Read the "Total Vehicles (excludes off-boarding)" stat card.
3. Open the Station filter dropdown.
4. Select station = RNH; note row count. Select ORF; note row count.

Pass/fail:
- Total Vehicles card reads **36** (NOT 97, NOT 169, NOT 0).
- Station dropdown options are exactly **All stations, ORF, RNH** — must NOT contain IAH/AUS/HRL/ACT/LRD/CLL/BPT.
- RNH filter shows **22** vehicles; ORF shows **14**.
- Vehicle rows show real makes (FORD/GMC/INTERNATIONAL), not "UNKNOWN".

## Test 2 — TROVA Fuel page shows 1,382 transactions with station + new columns
Steps:
1. Go to Fuel page. Ensure date range covers imported data (fuel dates span ~2026-03; set month/all as needed to reveal rows).
2. Inspect table columns and a sample row.

Pass/fail:
- Fuel rows render with **Station = ORF or RNH** only.
- Table includes **Location** and **Txn Time** columns; at least some rows show a populated Txn Time (e.g. "11:27") and a Location (e.g. "SHEETZ..., POWHATAN, VA").
- Price/Gal and Volume (Gal) columns show plausible values (e.g. ~$3.0/gal, ~21 gal), not 0.
- Total fuel spend / fill-up counts are non-zero and consistent with ~1,382 records over the period.

## Test 3 — TROVA FareEye Routes shows 864 routes across ORF/RNH
Steps:
1. Go to FareEye Routes. Set range to cover May 2026 (route dates are 2026-05-01+).
2. Read total routes summary; open station filter.

Pass/fail:
- Station filter offers only ORF/RNH.
- Total routes over the full period = **864** (ORF 456 / RNH 408). Utilization values are 0–~120% (not raw fractions like 0.93), SPORH non-zero.

## Test 4 — TROVA Service Costs / Finance shows spend by ORF/RNH
Steps:
1. Go to Service Costs (or Finance Report).
2. Confirm station breakdown.

Pass/fail:
- Station tabs/rows show **ORF and RNH only** (no Texas stations, no "Consolidated TX").
- Aggregate service spend is non-zero (order ~$346k across the dataset).

## Test 5 (the changed SYNCTX feature) — "Sync live" button in dashboard blue box
Steps:
1. Go to opsai-opal.vercel.app dashboard.
2. In the blue hero box, locate the "Live on Samsara · running now" strip.
3. Confirm a **"Sync live"** button appears next to the "N vans" count.
4. Click it. Observe button state + result text.

Pass/fail:
- A button labeled **"Sync live"** with a refresh icon is visible in the blue box (was NOT there before this change).
- On click, it shows a spinner / "Syncing…" state, then displays a result like "Updated X of Y" (or an error string if the Samsara token lacks scope — that is a legitimate observed outcome, not a UI bug).
- A POST request to **/api/samsara/sync** is fired (verify via response/refresh; the live station counts refresh afterward).
- Regression: the SYNCTX station chips still show the 7 Texas stations (brand config didn't leak TROVA's ORF/RNH into SYNCTX).

---
Recording: one continuous pass over TROVA (Tests 1–4) then SYNCTX (Test 5), with annotations per test.
