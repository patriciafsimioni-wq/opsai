import Link from "next/link";
import { BRAND } from "@/lib/brand";

export const metadata = {
  title: `${BRAND} — User Guide`,
  description: `Complete user guide for ${BRAND} fleet management platform`,
};

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20">
      <h2 className="mb-4 border-b border-slate-200 pb-2 text-xl font-bold text-slate-800">{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-slate-700">{children}</div>
    </section>
  );
}

function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-2 text-base font-semibold text-slate-700">{title}</h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return <li className="ml-4 list-disc">{children}</li>;
}

function Screenshot({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="my-4 overflow-hidden rounded-xl border border-slate-200 shadow-sm">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} className="w-full" loading="lazy" />
    </div>
  );
}

function RoleTable() {
  const roles = [
    ["Admin", "Full access to everything, user management, \"View as\" role switcher"],
    ["General Manager", "Full access to everything, \"View as\" role switcher"],
    ["Fleet Manager", "Fleet operations, reports, budgets, approvals, \"View as\" role switcher"],
    ["Station Manager", "Operations filtered to their station (no Fleet Finance access)"],
    ["Manager", "Operations, maintenance, vehicles, drivers"],
    ["Mechanic", "Log services, view work orders, manage vehicles, PM schedule"],
    ["Vendor", "Vehicles, Work Orders, WO Requests, Log Service, PM Schedule, DVIR, Service Catalog, Issue Tracker"],
    ["Driver", "Dashboard, vehicles, DVIR"],
  ];
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border border-slate-200 rounded-lg">
        <thead><tr className="bg-slate-50"><th className="px-4 py-2 text-left font-semibold border-b">Role</th><th className="px-4 py-2 text-left font-semibold border-b">Access</th></tr></thead>
        <tbody>
          {roles.map(([role, access]) => (
            <tr key={role} className="border-b border-slate-100 hover:bg-slate-50">
              <td className="px-4 py-2 font-medium">{role}</td>
              <td className="px-4 py-2 text-slate-600">{access}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const toc = [
  { id: "getting-started", label: "Getting Started" },
  { id: "dashboard", label: "Dashboard" },
  { id: "vehicles", label: "Vehicles" },
  { id: "drivers", label: "Drivers" },
  { id: "fareye", label: "FareEye Routes" },
  { id: "maintenance", label: "Maintenance" },
  { id: "dvir", label: "DVIR" },
  { id: "wo-requests", label: "WO Requests" },
  { id: "issues", label: "Issue Tracker" },
  { id: "fuel", label: "Fuel Management" },
  { id: "finance", label: "Finance Report" },
  { id: "fleet-finance", label: "Fleet Finance" },
  { id: "offboarding", label: "Offboarding" },
  { id: "map", label: "Live Map" },
  { id: "alerts", label: "Alerts" },
  { id: "safety", label: "Safety" },
  { id: "reports", label: "Reports" },
  { id: "uploads", label: "Smart Upload" },
  { id: "users", label: "User Management" },
  { id: "samsara", label: "Samsara Integration" },
  { id: "pwa", label: "Mobile App (PWA)" },
  { id: "tips", label: "Tips & Best Practices" },
  { id: "troubleshooting", label: "Troubleshooting" },
];

export default function GuidePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-lg font-bold text-slate-800">{BRAND}</h1>
            <p className="text-xs text-slate-500">User Guide</p>
          </div>
          <Link href="/login" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors">
            Log In
          </Link>
        </div>
      </header>

      <div className="mx-auto flex max-w-6xl gap-8 px-6 py-8">
        {/* Sidebar TOC */}
        <nav className="hidden lg:block w-56 shrink-0">
          <div className="sticky top-24 space-y-1">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Contents</p>
            {toc.map((item) => (
              <a key={item.id} href={`#${item.id}`} className="block rounded-md px-3 py-1.5 text-sm text-slate-600 hover:bg-blue-50 hover:text-blue-700 transition-colors">
                {item.label}
              </a>
            ))}
          </div>
        </nav>

        {/* Main content */}
        <main className="min-w-0 flex-1 space-y-10">
          {/* Hero */}
          <div className="rounded-xl bg-blue-600 p-8 text-white">
            <h1 className="text-2xl font-bold">Welcome to {BRAND}</h1>
            <p className="mt-2 text-blue-100">Your complete fleet management platform &mdash; covering vehicle lifecycle, maintenance, fuel, routing, safety, and financial decision-making all in one place.</p>
          </div>

          <Section id="getting-started" title="Getting Started">
            <SubSection title="Logging In">
              <ol className="ml-4 list-decimal space-y-1">
                <li>Open your browser and navigate to the {BRAND} URL</li>
                <li>Log in with your assigned email and password</li>
                <li>You&apos;ll land on the <strong>Dashboard</strong> (Fleet Overview)</li>
              </ol>
            </SubSection>
            <SubSection title="User Roles">
              <RoleTable />
            </SubSection>
            <SubSection title="&quot;View As&quot; Role Switcher">
              <p>Admins, GMs, and Fleet Managers can preview what any role sees by using the <strong>&quot;View as&quot;</strong> dropdown in the top bar &mdash; without logging out.</p>
            </SubSection>
          </Section>

          <Section id="dashboard" title="Dashboard (Fleet Overview)">
            <Screenshot src="/guide-screenshots/dashboard.png" alt="Dashboard - Fleet Overview" />
            <p>The dashboard is <strong>role-aware</strong> &mdash; each user only sees widgets for the pages they have access to. <strong>All boxes and cards are clickable</strong> and link to their corresponding page.</p>
            <SubSection title="Issue Tracker Box">
              <p>Always visible at the top. Shows open issues assigned to you or created by you. Displays &quot;No open issues&quot; when empty.</p>
            </SubSection>
            <SubSection title="KPI Cards (clickable)">
              <ul>
                <Bullet><strong>Vehicles</strong> &rarr; Vehicles page</Bullet>
                <Bullet><strong>Active Now</strong> (with utilization %) &rarr; Vehicles page</Bullet>
                <Bullet><strong>Drivers</strong> &rarr; Drivers page</Bullet>
                <Bullet><strong>Open Alerts</strong> &rarr; Alerts page</Bullet>
                <Bullet><strong>Open Work Orders</strong> &rarr; Maintenance page</Bullet>
                <Bullet><strong>Fuel (30d)</strong> &rarr; Fuel page</Bullet>
              </ul>
            </SubSection>
            <SubSection title="This Week Summary (clickable)">
              <ul>
                <Bullet><strong>Fuel Spend This Week</strong> (with % change vs last week) &rarr; Fuel page</Bullet>
                <Bullet><strong>Services Completed</strong> &rarr; Maintenance page</Bullet>
                <Bullet><strong>Routes Dispatched</strong> (with miles planned) &rarr; FareEye Routes page</Bullet>
                <Bullet><strong>Maintenance Cost (90d)</strong> &rarr; Maintenance page</Bullet>
              </ul>
            </SubSection>
            <SubSection title="Charts (clickable)">
              <ul>
                <Bullet><strong>Fleet Status</strong>: Donut chart &rarr; Vehicles page</Bullet>
                <Bullet><strong>FareEye Routes</strong>: Daily planned miles (last 7 days) &rarr; FareEye Routes page</Bullet>
                <Bullet><strong>Fuel Spend</strong>: Weekly trend (last 8 weeks) &rarr; Fuel page</Bullet>
              </ul>
            </SubSection>
            <SubSection title="Lower Panels">
              <ul>
                <Bullet><strong>Recent Alerts</strong>: Scrollable list with severity badges, each linking to the vehicle/driver</Bullet>
                <Bullet><strong>Top Drivers</strong>: By safety score &rarr; Drivers page</Bullet>
              </ul>
            </SubSection>
            <SubSection title="Compliance & Fleet Health">
              <ul>
                <Bullet><strong>Compliance Audit</strong>: Expired registrations, missing registration dates, insurance status</Bullet>
                <Bullet><strong>Vehicle Age Compliance</strong>: Flags cargo vans &gt; 4 years and box trucks &gt; 7 years</Bullet>
                <Bullet><strong>Recently Onboarded / Offboarded</strong>: Last 30 days activity</Bullet>
                <Bullet><strong>Samsara Status</strong>: Vehicles missing cameras or not transmitting</Bullet>
              </ul>
            </SubSection>
          </Section>

          <Section id="vehicles" title="Vehicles">
            <Screenshot src="/guide-screenshots/vehicles.png" alt="Vehicles page" />
            <SubSection title="Vehicle List">
              <ul>
                <Bullet><strong>Summary bar</strong> at top showing total count and <strong>donut chart</strong> of status distribution</Bullet>
                <Bullet>View all vehicles with DX#, station, type, status, leasing company, odometer, and fuel level</Bullet>
                <Bullet><strong>Search</strong> by name, plate, or VIN</Bullet>
                <Bullet><strong>Filter</strong> by status (Active, Out of Service, Maintenance)</Bullet>
                <Bullet><strong>Sync Samsara</strong> pulls real odometer/GPS data</Bullet>
                <Bullet><strong>Check Cameras</strong> identifies vehicles without Samsara cameras</Bullet>
                <Bullet><strong>Flag Issue</strong> button on each vehicle detail page</Bullet>
              </ul>
            </SubSection>
            <SubSection title="Vehicle Detail Page">
              <ul>
                <Bullet><strong>Fleet Health Score</strong> (0&ndash;100): Green (Healthy) &rarr; Yellow (Monitor) &rarr; Orange (Plan Replacement) &rarr; Red (Replace Now)</Bullet>
                <Bullet><strong>Financial Summary</strong>: Total lifetime cost, cost/mile, cost/day, cost breakdown</Bullet>
                <Bullet><strong>Lease &amp; Financial</strong>: Monthly payments, remaining payments, lease end date, market vs book value</Bullet>
                <Bullet><strong>PM Schedule</strong>: Alerts for services never performed, upcoming services within 2,000 miles</Bullet>
                <Bullet><strong>Edit Vehicle Info</strong>: Update year, make, model, VIN, station, plate, type, etc.</Bullet>
                <Bullet><strong>Branding</strong>: Yellow DHL or White Non-Branded with photo upload (file or camera)</Bullet>
                <Bullet><strong>Offboard Vehicle</strong>: Requires reason, checklist, and 4 photos</Bullet>
              </ul>
            </SubSection>
          </Section>

          <Section id="drivers" title="Drivers">
            <Screenshot src="/guide-screenshots/drivers.png" alt="Drivers page" />
            <ul>
              <Bullet>Synced from Samsara (215+ drivers)</Bullet>
              <Bullet>View driver details, assigned vehicle, safety score</Bullet>
              <Bullet><strong>Flag Issue</strong> button on each driver detail page</Bullet>
            </ul>
            <SubSection title="Filters & Sorting">
              <ul>
                <Bullet><strong>Station filter</strong>: Filter by station (AUS, IAH, ACT, etc.)</Bullet>
                <Bullet><strong>License status filter</strong>: Show all, expired, expiring in 30/60/90 days</Bullet>
                <Bullet><strong>Sort by</strong>: Name, Station, Expiration Date, Safety Score</Bullet>
                <Bullet>Expired licenses highlighted in red with &quot;(Expired)&quot; tag</Bullet>
              </ul>
            </SubSection>
          </Section>

          <Section id="fareye" title="FareEye Routes">
            <Screenshot src="/guide-screenshots/fareye-routes.png" alt="FareEye Routes page" />
            <ul>
              <Bullet>View daily dispatched routes with planned vs actual miles</Bullet>
              <Bullet>Filter by station and date</Bullet>
              <Bullet><strong>Flag Issue</strong> button available on individual routes</Bullet>
            </ul>
            <SubSection title="Mileage Report Download">
              <p>Click the <strong>Download</strong> button to export a CSV mileage report:</p>
              <ul>
                <Bullet><strong>Date range</strong>: Per day, per week, or per month</Bullet>
                <Bullet><strong>Station</strong>: By individual station or all stations</Bullet>
                <Bullet>Includes summary rows and station breakdown</Bullet>
              </ul>
            </SubSection>
          </Section>

          <Section id="maintenance" title="Maintenance">
            <Screenshot src="/guide-screenshots/maintenance.png" alt="Maintenance / Work Orders page" />
            <SubSection title="Pending WO Requests Banner">
              <p>When there are pending requests, a <strong>prominent amber banner</strong> appears at the top showing each request&apos;s PO#, service, vehicle, station, and requester with a link to review.</p>
            </SubSection>
            <SubSection title="Work Orders Table">
              <ul>
                <Bullet><strong>WO#</strong> and <strong>PO#</strong> columns show work order and purchase order numbers</Bullet>
                <Bullet>Filter by vehicle, station, status, or search</Bullet>
                <Bullet>Each work order shows service type, cost, parts, labor, vendor, odometer</Bullet>
              </ul>
            </SubSection>
            <SubSection title="Bulk Status Change">
              <p>Use checkboxes to select individual work orders (or &quot;Select All&quot;), choose the target status, and click <strong>&quot;Update All&quot;</strong>.</p>
            </SubSection>
            <SubSection title="PM Schedule">
              <ul>
                <Bullet><strong>Assign to Vendor/Mechanic</strong>: Click the person+ icon to create a scheduled work order</Bullet>
                <Bullet><strong>Dismiss/Skip</strong> alerts that aren&apos;t applicable</Bullet>
                <Bullet>Color-coded: Red = overdue, Orange = upcoming, Green = on track</Bullet>
              </ul>
            </SubSection>
            <SubSection title="Service Providers">
              <p>Go to <strong>Service Catalog</strong> page to manage service providers. Admins can add new providers and delete existing ones. These providers appear in the Log Service form.</p>
            </SubSection>
          </Section>

          <Section id="dvir" title="DVIR (Driver Vehicle Inspection Report)">
            <Screenshot src="/guide-screenshots/dvir.png" alt="DVIR page" />
            <p><strong>All users can access this.</strong></p>
            <SubSection title="New Inspection">
              <ol className="ml-4 list-decimal space-y-1">
                <li>Select a vehicle from the dropdown</li>
                <li>Enter current odometer reading</li>
                <li>For each of 14 items, mark <strong>Pass</strong>, <strong>Fail</strong>, or <strong>N/A</strong></li>
                <li>Add photos using file upload or camera</li>
                <li>Submit &mdash; automatic alerts for Windshield, Body Damage, or Brakes failures</li>
              </ol>
            </SubSection>
          </Section>

          <Section id="wo-requests" title="Work Order Requests">
            <Screenshot src="/guide-screenshots/work-order-requests.png" alt="Work Order Requests page" />
            <SubSection title="Submitting a Request">
              <ol className="ml-4 list-decimal space-y-1">
                <li>Fill out: vehicle, service needed, priority, description</li>
                <li>Enter your email for notifications</li>
                <li>Submit &mdash; PO number auto-generated, management users receive alert</li>
              </ol>
            </SubSection>
            <SubSection title="Bulk Select & Approve/Reject">
              <p>Use checkboxes to select requests, choose Approve or Reject, and process all at once.</p>
            </SubSection>
            <SubSection title="Table Columns">
              <p>PO Number, Date Submitted, Service Date, Station, Vehicle, Service, Status</p>
            </SubSection>
          </Section>

          <Section id="issues" title="Issue Tracker">
            <Screenshot src="/guide-screenshots/issues.png" alt="Issue Tracker page" />
            <p>Flag and track issues across your fleet operations. Issues are <strong>private</strong> &mdash; only visible to the creator, the assigned person, and Admins/GMs/Fleet Managers.</p>
            <SubSection title="Creating Issues">
              <ul>
                <Bullet>From the Issues page: Click &quot;New Issue&quot;</Bullet>
                <Bullet>From other pages: Use the &quot;Flag Issue&quot; button (available on Fuel Duplicates, Vehicles, Drivers, FareEye, Maintenance, DVIR, Safety)</Bullet>
              </ul>
            </SubSection>
            <SubSection title="Categories">
              <p>Fuel, Maintenance, DVIR, Safety, Operations, Vehicles, Drivers, FareEye Routes, Other</p>
            </SubSection>
            <SubSection title="Workflow">
              <p><strong>Open</strong> &rarr; <strong>In Progress</strong> &rarr; <strong>Resolved</strong>. Add comments, assign/reassign users, set priority.</p>
            </SubSection>
          </Section>

          <Section id="fuel" title="Fuel Management">
            <Screenshot src="/guide-screenshots/fuel.png" alt="Fuel Management page" />
            <ul>
              <Bullet>View all fuel transactions with date, vehicle, driver, station, type, volume, price/gal, total cost</Bullet>
              <Bullet>Filter by station, fuel type, and date (Week/Month) &mdash; all dates in US Central Time</Bullet>
              <Bullet><strong>Duplicates tab</strong>: Flags same-vehicle, same-day charges with Flag Issue button</Bullet>
              <Bullet><strong>Card Status</strong>: Cards unused 15+ days flagged as &quot;Card Not Working&quot;</Bullet>
            </ul>
          </Section>

          <Section id="finance" title="Finance Report">
            <Screenshot src="/guide-screenshots/finance-report.png" alt="Finance Report page" />
            <ul>
              <Bullet>Monthly financial overview with slide-style presentation</Bullet>
              <Bullet>Selected month badge shown in top-left of slides toolbar</Bullet>
              <Bullet><strong>Chart trend slides</strong>: Monthly YoY, YTD YoY, Actual vs Budget, YTD Budget</Bullet>
              <Bullet><strong>Data table slide</strong>: Station + service category breakdown</Bullet>
              <Bullet><strong>PDF Export</strong>: All slides as a single PDF with proper margins, full content captured</Bullet>
            </ul>
          </Section>

          <Section id="fleet-finance" title="Fleet Finance (Executive Dashboard)">
            <Screenshot src="/guide-screenshots/fleet-finance.png" alt="Fleet Finance page" />
            <p>High-level financial KPIs for leadership (not accessible to Station Managers or below):</p>
            <ul>
              <Bullet>Total Fleet Asset Value, Total Amount Invested, Lease Commitments</Bullet>
              <Bullet>Monthly Operating Cost, Average Cost per Vehicle</Bullet>
              <Bullet>Fleet Health Distribution, Replacement Budget Forecast (12/24/36 months)</Bullet>
              <Bullet>Upcoming Lease Expirations (30/60/90 days)</Bullet>
              <Bullet>High-Cost Vehicles (Cost/Mile &gt; $1.00)</Bullet>
            </ul>
          </Section>

          <Section id="offboarding" title="Offboarding">
            <Screenshot src="/guide-screenshots/offboarding.png" alt="Offboarding page" />
            <ul>
              <Bullet>Track vehicles being offboarded with reason, mileage, pickup date, sold amount</Bullet>
              <Bullet><strong>Edit button</strong> on in-progress vehicles to change reason, mileage, pickup date, sold amount</Bullet>
            </ul>
          </Section>

          <Section id="map" title="Live Map">
            <ul>
              <Bullet>Real-time GPS positions from Samsara (updates every 10 seconds)</Bullet>
              <Bullet>See all active vehicles on the map with location pins</Bullet>
              <Bullet>Filter by station</Bullet>
            </ul>
          </Section>

          <Section id="alerts" title="Alerts">
            <Screenshot src="/guide-screenshots/alerts.png" alt="Alerts page" />
            <ul>
              <Bullet>Every alert links to the vehicle/driver page to resolve</Bullet>
              <Bullet>Types: Maintenance due, registration expiring, DVIR failures, camera missing, license expiration, new WO requests</Bullet>
            </ul>
          </Section>

          <Section id="safety" title="Safety">
            <Screenshot src="/guide-screenshots/safety.png" alt="Safety page" />
            <ul>
              <Bullet>Safety events and scores synced from Samsara</Bullet>
              <Bullet>Click <strong>&quot;Sync from Samsara&quot;</strong> to pull real safety events and update scores</Bullet>
              <Bullet>Filter by 1/7/14/30 days</Bullet>
              <Bullet>Requires &quot;Safety Events &amp; Scores read&quot; permission on API token</Bullet>
            </ul>
          </Section>

          <Section id="reports" title="Reports">
            <Screenshot src="/guide-screenshots/reports.png" alt="Reports page" />
            <ul>
              <Bullet>Generate and export fleet reports</Bullet>
              <Bullet><strong>Cost Trend chart</strong>: Fuel vs maintenance cost over last 6 months</Bullet>
              <Bullet>All dates in US Central Time</Bullet>
            </ul>
          </Section>

          <Section id="uploads" title="Smart Upload">
            <Screenshot src="/guide-screenshots/uploads.png" alt="Smart Upload page" />
            <SubSection title="Uploading Data">
              <ol className="ml-4 list-decimal space-y-1">
                <li>Click <strong>&quot;Download Template&quot;</strong> to get the Excel template</li>
                <li>Fill in the appropriate tab (Fuel, Service History, FareEye, Fleet List, Leases)</li>
                <li>Upload the file &mdash; each sheet detected separately with its own <strong>Import</strong> button</li>
                <li>Duplicates and summary rows are automatically skipped</li>
              </ol>
            </SubSection>
          </Section>

          <Section id="users" title="User Management">
            <Screenshot src="/guide-screenshots/users.png" alt="User Management page" />
            <p>Admin/GM only:</p>
            <ul>
              <Bullet>View, edit, delete users</Bullet>
              <Bullet>Add/invite users &mdash; invitation email sent automatically via Resend</Bullet>
              <Bullet>Assign roles and manage permissions</Bullet>
            </ul>
          </Section>

          <Section id="samsara" title="Samsara Integration">
            <ul>
              <Bullet><strong>Vehicles</strong> &rarr; &quot;Sync Samsara&quot;: pulls odometer, GPS, engine state</Bullet>
              <Bullet><strong>Drivers</strong>: auto-synced from Samsara</Bullet>
              <Bullet><strong>Safety</strong> &rarr; &quot;Sync from Samsara&quot;: pulls real safety events and scores</Bullet>
              <Bullet>Requires Samsara API token with appropriate permissions</Bullet>
            </ul>
          </Section>

          <Section id="pwa" title="Mobile App (PWA)">
            <p>{BRAND} works as a Progressive Web App:</p>
            <ul>
              <Bullet><strong>iPhone</strong>: Open in Safari &rarr; Share button &rarr; &quot;Add to Home Screen&quot;</Bullet>
              <Bullet><strong>Android</strong>: Open in Chrome &rarr; 3-dot menu &rarr; &quot;Add to Home Screen&quot; or &quot;Install app&quot;</Bullet>
            </ul>
            <p>It appears as &quot;{BRAND}&quot; on your home screen and opens full-screen. Mobile hamburger menu available for navigation.</p>
          </Section>

          <Section id="tips" title="Tips & Best Practices">
            <ol className="ml-4 list-decimal space-y-1">
              <li>Run &quot;Sync Samsara&quot; weekly to keep odometer data fresh</li>
              <li>Submit DVIRs daily &mdash; especially for windshield and body damage</li>
              <li>Check the Compliance Audit on the dashboard regularly</li>
              <li>Use Smart Upload to bulk-import fuel and service data monthly</li>
              <li>Review Fleet Finance dashboard monthly for replacement planning</li>
              <li>Monitor the Duplicates tab in Fuel for potential card fraud</li>
              <li>Use the Issue Tracker to flag problems directly from the page where you spot them</li>
              <li>Check driver license expirations using the Drivers page filters</li>
              <li>Use bulk actions on Work Orders and WO Requests to process multiple items at once</li>
              <li>Download mileage reports from FareEye Routes for daily/weekly/monthly analysis</li>
            </ol>
          </Section>

          <Section id="troubleshooting" title="Troubleshooting">
            <div className="overflow-x-auto">
              <table className="w-full text-sm border border-slate-200 rounded-lg">
                <thead><tr className="bg-slate-50"><th className="px-4 py-2 text-left font-semibold border-b">Issue</th><th className="px-4 py-2 text-left font-semibold border-b">Solution</th></tr></thead>
                <tbody>
                  {[
                    ["Odometer shows 0", "Click \"Sync Samsara\" on Vehicles page"],
                    ["Map not loading", "Refresh browser; ensure WebGL/Canvas supported"],
                    ["Missing fuel driver names", "Re-upload fuel report with NAME column filled"],
                    ["Email not received", "Check RESEND_API_KEY is configured"],
                    ["Safety scores don't match Samsara", "Ensure API token has \"Safety Events & Scores read\" permission, then sync"],
                    ["Vendor can't see pages", "Have vendor log out and log back in after access update"],
                    ["Dates look wrong", "All dates use US Central Time — clear cache and refresh"],
                    ["Mobile menu not showing", "Tap hamburger icon in top-left corner"],
                  ].map(([issue, solution]) => (
                    <tr key={issue} className="border-b border-slate-100">
                      <td className="px-4 py-2 font-medium">{issue}</td>
                      <td className="px-4 py-2 text-slate-600">{solution}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
            For questions or issues, contact your Fleet Manager or system administrator.
          </div>
        </main>
      </div>
    </div>
  );
}
