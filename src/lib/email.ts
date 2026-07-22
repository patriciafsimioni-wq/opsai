import { Resend } from "resend";
import nodemailer from "nodemailer";
import { BRAND } from "@/lib/brand";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

// SMTP transport (e.g. Google Workspace). Preferred when configured because it
// needs no DNS changes on domains already set up in Workspace. Falls back to
// Resend when SMTP env vars are absent.
const smtpConfigured =
  !!process.env.SMTP_HOST && !!process.env.SMTP_USER && !!process.env.SMTP_PASS;

const smtpTransport = smtpConfigured
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: Number(process.env.SMTP_PORT ?? 587) === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    })
  : null;

// "From" precedence: explicit EMAIL_FROM, else the SMTP user, else Resend sandbox.
const FROM_EMAIL =
  process.env.EMAIL_FROM ||
  (process.env.SMTP_USER ? `${BRAND} <${process.env.SMTP_USER}>` : `${BRAND} <onboarding@resend.dev>`);

export interface EmailPayload {
  to: string;
  subject: string;
  html: string;
}

// Resolve the portal's public URL for links in emails. Prefers an explicit
// override, then Vercel's production domain, then a safe default.
export function getAppUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return "https://opsai-opal.vercel.app";
}

function shell(title: string, accent: string, bodyHtml: string): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1e293b;">
  <div style="border-bottom: 3px solid ${accent}; padding-bottom: 16px; margin-bottom: 24px;">
    <h1 style="margin: 0; font-size: 20px; color: #0f172a;">${BRAND}</h1>
    <p style="margin: 4px 0 0; font-size: 13px; color: #64748b;">${title}</p>
  </div>
  ${bodyHtml}
  <p style="font-size: 13px; color: #64748b; margin-top: 32px; padding-top: 16px; border-top: 1px solid #e2e8f0;">
    This is an automated notification from ${BRAND}.
  </p>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function buildMessageEmail(params: {
  recipientName: string;
  senderName: string;
  body: string;
  isReply: boolean;
  appUrl: string;
}): { subject: string; html: string } {
  const { recipientName, senderName, body, isReply, appUrl } = params;
  const subject = isReply
    ? `New reply from ${senderName} — ${BRAND}`
    : `New message from ${senderName} — ${BRAND}`;
  const html = shell(
    isReply ? "New reply" : "New message",
    "#2563eb",
    `
  <p style="font-size: 14px; line-height: 1.6;">Hi ${escapeHtml(recipientName)},</p>
  <p style="font-size: 14px; line-height: 1.6;">
    You have a new ${isReply ? "reply" : "message"} from <strong>${escapeHtml(senderName)}</strong>:
  </p>
  <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 16px; margin: 16px 0; font-size: 14px; line-height: 1.6; white-space: pre-wrap;">${escapeHtml(body)}</div>
  <div style="text-align: center; margin: 24px 0;">
    <a href="${appUrl}/messages" style="display: inline-block; background: #2563eb; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">Open in ${BRAND}</a>
  </div>`,
  );
  return { subject, html };
}

export function buildAlertDigestEmail(params: {
  recipientName: string;
  alerts: { severity: string; message: string; context?: string | null }[];
  appUrl: string;
}): { subject: string; html: string } {
  const { recipientName, alerts, appUrl } = params;
  const criticalCount = alerts.filter((a) => a.severity === "CRITICAL").length;
  const subject = `${alerts.length} flagged issue${alerts.length === 1 ? "" : "s"} on ${BRAND}${criticalCount ? ` (${criticalCount} critical)` : ""}`;
  const rows = alerts
    .map((a) => {
      const color = a.severity === "CRITICAL" ? "#dc2626" : "#d97706";
      return `<tr>
      <td style="padding: 8px 12px; border: 1px solid #e2e8f0; color: ${color}; font-weight: 600; white-space: nowrap;">${escapeHtml(a.severity)}</td>
      <td style="padding: 8px 12px; border: 1px solid #e2e8f0;">${escapeHtml(a.message)}${a.context ? ` <span style="color:#64748b;">— ${escapeHtml(a.context)}</span>` : ""}</td>
    </tr>`;
    })
    .join("");
  const html = shell(
    "Flagged Issues",
    "#dc2626",
    `
  <p style="font-size: 14px; line-height: 1.6;">Hi ${escapeHtml(recipientName)},</p>
  <p style="font-size: 14px; line-height: 1.6;">
    The following <strong>${alerts.length}</strong> issue${alerts.length === 1 ? " was" : "s were"} flagged and need attention:
  </p>
  <table style="width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 13px;">
    <thead><tr>
      <th style="padding: 8px 12px; border: 1px solid #e2e8f0; background: #f8fafc; text-align: left;">Severity</th>
      <th style="padding: 8px 12px; border: 1px solid #e2e8f0; background: #f8fafc; text-align: left;">Issue</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div style="text-align: center; margin: 24px 0;">
    <a href="${appUrl}/alerts" style="display: inline-block; background: #dc2626; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">Review Alerts</a>
  </div>`,
  );
  return { subject, html };
}

export function buildIssueEmail(params: {
  recipientName: string;
  kind: "assigned" | "comment" | "status";
  actorName: string;
  issueTitle: string;
  issueStatus?: string;
  priority?: string;
  body?: string;
  appUrl: string;
}): { subject: string; html: string } {
  const { recipientName, kind, actorName, issueTitle, issueStatus, priority, body, appUrl } = params;

  let title: string;
  let subject: string;
  let lead: string;
  if (kind === "assigned") {
    title = "Issue Assigned to You";
    subject = `You've been assigned an issue — ${issueTitle}`;
    lead = `<strong>${escapeHtml(actorName)}</strong> assigned an issue to you${priority ? ` (${escapeHtml(priority)} priority)` : ""}.`;
  } else if (kind === "status") {
    title = "Issue Updated";
    subject = `Issue updated — ${issueTitle}`;
    lead = `<strong>${escapeHtml(actorName)}</strong> updated the status${issueStatus ? ` to <strong>${escapeHtml(issueStatus)}</strong>` : ""}.`;
  } else {
    title = "New Reply on Issue";
    subject = `New reply on issue — ${issueTitle}`;
    lead = `<strong>${escapeHtml(actorName)}</strong> replied on an issue you're following.`;
  }

  const html = shell(
    title,
    "#dc2626",
    `
  <p style="font-size: 14px; line-height: 1.6;">Hi ${escapeHtml(recipientName)},</p>
  <p style="font-size: 14px; line-height: 1.6;">${lead}</p>
  <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin: 16px 0;">
    <p style="margin: 0; font-size: 15px; font-weight: 600; color: #0f172a;">${escapeHtml(issueTitle)}</p>
    ${issueStatus ? `<p style="margin: 6px 0 0; font-size: 13px; color: #64748b;">Status: ${escapeHtml(issueStatus)}</p>` : ""}
  </div>
  ${body ? `<div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 16px 0; font-size: 14px; line-height: 1.6; white-space: pre-wrap;">${escapeHtml(body)}</div>` : ""}
  <div style="text-align: center; margin: 24px 0;">
    <a href="${appUrl}/issues" style="display: inline-block; background: #dc2626; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">Open the Issue</a>
  </div>
  <p style="font-size: 13px; color: #64748b; line-height: 1.6;">
    Reply directly in the portal to keep the conversation going until the issue is resolved.
  </p>`,
  );
  return { subject, html };
}

export async function sendEmail(payload: EmailPayload): Promise<{ success: boolean; error?: string }> {
  // Prefer SMTP (Google Workspace) when configured; no DNS changes required.
  if (smtpTransport) {
    try {
      await smtpTransport.sendMail({
        from: FROM_EMAIL,
        to: payload.to,
        subject: payload.subject,
        html: payload.html,
      });
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error("[Email] SMTP send failed:", message);
      return { success: false, error: message };
    }
  }

  if (!resend) {
    console.warn("[Email] No email transport configured (SMTP_* or RESEND_API_KEY) — skipping send");
    return { success: false, error: "No email transport configured" };
  }

  try {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
    });

    if (error) {
      console.error("[Email] Send failed:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[Email] Exception:", message);
    return { success: false, error: message };
  }
}

// A getting-started / guide email. Unlike the invite, this does NOT reset or
// include a password — it just points the user to the login page and the
// interactive guide, with a short note on what their role can do.
export function buildGuideEmail(params: {
  name: string;
  role: string;
  appUrl: string;
}): { subject: string; html: string } {
  const { name, role, appUrl } = params;
  const roleBlurbs: Record<string, string> = {
    ADMIN: "You have full access — manage users, vehicles, work orders, finance, and settings across every station.",
    GENERAL_MANAGER: "You can oversee the whole fleet across all stations — vehicles, work orders, finance, and reports.",
    FLEET_MANAGER: "You can manage vehicles, maintenance, work orders, and reports across all stations.",
    STATION_MANAGER: "You'll see and manage everything for your assigned station — vehicles, services, work orders, and drivers.",
    MANAGER: "You can manage day-to-day operations — vehicles, work orders, and services.",
    MECHANIC: "You can view assigned work orders and log completed services.",
    VENDOR: "You can view the fleet and submit work order requests for any vehicle.",
    DRIVER: "You can complete DVIRs and see your assigned vehicle and routes — best used from your phone.",
    DATA_ENTRY: "You can view and enter data across all stations — vehicles, work orders, fuel, finance, and reports.",
  };
  const blurb = roleBlurbs[role] || "Here's how to get started.";

  const subject = `Getting started with ${BRAND}`;

  const html = shell(
    "Getting Started",
    "#2563eb",
    `
  <p style="font-size: 14px; line-height: 1.6;">Hi ${escapeHtml(name)},</p>
  <p style="font-size: 14px; line-height: 1.6;">
    Welcome to <strong>${BRAND}</strong>, our fleet management portal. ${escapeHtml(blurb)}
  </p>
  <p style="font-size: 14px; line-height: 1.6;">
    Log in with the email and temporary password from your invitation. If you don't have it,
    use <strong>"Change password"</strong> after logging in, or ask your administrator to resend it.
  </p>

  <div style="text-align: center; margin: 24px 0;">
    <a href="${appUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px; margin: 4px;">Log In</a>
    <a href="${appUrl}/guide" style="display: inline-block; background: #0f172a; color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px; margin: 4px;">Open the Guide</a>
  </div>

  <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 16px 0;">
    <p style="margin: 0 0 8px; font-size: 14px; font-weight: 600; color: #0f172a;">Add it to your phone like an app</p>
    <p style="margin: 0 0 4px; font-size: 13px; line-height: 1.6;">
      <strong>iPhone (Safari):</strong> open ${appUrl} → tap the Share button → <strong>Add to Home Screen</strong>.
    </p>
    <p style="margin: 0; font-size: 13px; line-height: 1.6;">
      <strong>Android (Chrome):</strong> open ${appUrl} → tap the ⋮ menu → <strong>Add to Home screen</strong>.
    </p>
  </div>`,
  );

  return { subject, html };
}

export function buildInviteEmail(params: {
  name: string;
  email: string;
  password: string;
  role: string;
  stations: string | null;
  appUrl: string;
}): { subject: string; html: string } {
  const { name, email, password, role, stations, appUrl } = params;
  const roleLabels: Record<string, string> = {
    ADMIN: "Administrator",
    GENERAL_MANAGER: "General Manager",
    FLEET_MANAGER: "Fleet Manager",
    STATION_MANAGER: "Station Manager",
    MECHANIC: "Mechanic",
    VENDOR: "Vendor",
    MANAGER: "Manager",
    DRIVER: "Driver",
    DATA_ENTRY: "Data Entry",
  };
  const roleLabel = roleLabels[role] || role;

  const subject = `You've been invited to ${BRAND}`;

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1e293b;">
  <div style="border-bottom: 3px solid #2563eb; padding-bottom: 16px; margin-bottom: 24px;">
    <h1 style="margin: 0; font-size: 20px; color: #0f172a;">${BRAND}</h1>
    <p style="margin: 4px 0 0; font-size: 13px; color: #64748b;">Account Invitation</p>
  </div>

  <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
    <p style="margin: 0; font-size: 14px; font-weight: 600; color: #2563eb;">
      Welcome to the team!
    </p>
  </div>

  <p style="font-size: 14px; line-height: 1.6;">Hi ${name},</p>
  <p style="font-size: 14px; line-height: 1.6;">
    You've been invited to <strong>${BRAND}</strong> — our fleet management platform. Here are your login credentials:
  </p>

  <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 14px;">
    <tr>
      <td style="padding: 8px 12px; border: 1px solid #e2e8f0; background: #f8fafc; font-weight: 600; width: 140px;">Login URL</td>
      <td style="padding: 8px 12px; border: 1px solid #e2e8f0;"><a href="${appUrl}" style="color: #2563eb;">${appUrl}</a></td>
    </tr>
    <tr>
      <td style="padding: 8px 12px; border: 1px solid #e2e8f0; background: #f8fafc; font-weight: 600;">Email</td>
      <td style="padding: 8px 12px; border: 1px solid #e2e8f0;">${email}</td>
    </tr>
    <tr>
      <td style="padding: 8px 12px; border: 1px solid #e2e8f0; background: #f8fafc; font-weight: 600;">Password</td>
      <td style="padding: 8px 12px; border: 1px solid #e2e8f0; font-family: monospace;">${password}</td>
    </tr>
    <tr>
      <td style="padding: 8px 12px; border: 1px solid #e2e8f0; background: #f8fafc; font-weight: 600;">Role</td>
      <td style="padding: 8px 12px; border: 1px solid #e2e8f0;">${roleLabel}</td>
    </tr>
    ${stations ? `<tr>
      <td style="padding: 8px 12px; border: 1px solid #e2e8f0; background: #f8fafc; font-weight: 600;">Station(s)</td>
      <td style="padding: 8px 12px; border: 1px solid #e2e8f0;">${stations.split(",").join(", ")}</td>
    </tr>` : ""}
  </table>

  <div style="text-align: center; margin: 24px 0;">
    <a href="${appUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">Log In to ${BRAND}</a>
  </div>

  <p style="font-size: 13px; color: #64748b; margin-top: 32px; padding-top: 16px; border-top: 1px solid #e2e8f0;">
    This is an automated invitation from ${BRAND}. Please keep your credentials secure.
  </p>
</body>
</html>`;

  return { subject, html };
}

export function buildApprovalEmail(params: {
  requesterName: string;
  poNumber: string;
  woNumber?: string;
  status: "APPROVED" | "REJECTED";
  vehicleName: string;
  serviceTitle: string;
  approverName?: string;
  notes?: string;
}): { subject: string; html: string } {
  const { requesterName, poNumber, woNumber, status, vehicleName, serviceTitle, approverName, notes } = params;
  const isApproved = status === "APPROVED";
  const statusColor = isApproved ? "#16a34a" : "#dc2626";
  const statusLabel = isApproved ? "Approved" : "Rejected";

  const subject = `Work Order Request ${statusLabel} — ${poNumber}${woNumber ? ` / ${woNumber}` : ""}`;

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1e293b;">
  <div style="border-bottom: 3px solid ${statusColor}; padding-bottom: 16px; margin-bottom: 24px;">
    <h1 style="margin: 0; font-size: 20px; color: #0f172a;">${BRAND}</h1>
    <p style="margin: 4px 0 0; font-size: 13px; color: #64748b;">Work Order Request Notification</p>
  </div>

  <div style="background: ${isApproved ? "#f0fdf4" : "#fef2f2"}; border: 1px solid ${isApproved ? "#bbf7d0" : "#fecaca"}; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
    <p style="margin: 0; font-size: 14px; font-weight: 600; color: ${statusColor};">
      ${isApproved ? "✓" : "✗"} Request ${statusLabel}
    </p>
  </div>

  <p style="font-size: 14px; line-height: 1.6;">Hi ${requesterName},</p>
  <p style="font-size: 14px; line-height: 1.6;">
    Your work order request has been <strong style="color: ${statusColor};">${statusLabel.toLowerCase()}</strong>${approverName ? ` by ${approverName}` : ""}.
  </p>

  <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 14px;">
    <tr>
      <td style="padding: 8px 12px; border: 1px solid #e2e8f0; background: #f8fafc; font-weight: 600; width: 140px;">PO Number</td>
      <td style="padding: 8px 12px; border: 1px solid #e2e8f0;">${poNumber}</td>
    </tr>
    ${woNumber ? `<tr>
      <td style="padding: 8px 12px; border: 1px solid #e2e8f0; background: #f8fafc; font-weight: 600;">WO Number</td>
      <td style="padding: 8px 12px; border: 1px solid #e2e8f0;">${woNumber}</td>
    </tr>` : ""}
    <tr>
      <td style="padding: 8px 12px; border: 1px solid #e2e8f0; background: #f8fafc; font-weight: 600;">Vehicle</td>
      <td style="padding: 8px 12px; border: 1px solid #e2e8f0;">${vehicleName}</td>
    </tr>
    <tr>
      <td style="padding: 8px 12px; border: 1px solid #e2e8f0; background: #f8fafc; font-weight: 600;">Service</td>
      <td style="padding: 8px 12px; border: 1px solid #e2e8f0;">${serviceTitle}</td>
    </tr>
    <tr>
      <td style="padding: 8px 12px; border: 1px solid #e2e8f0; background: #f8fafc; font-weight: 600;">Status</td>
      <td style="padding: 8px 12px; border: 1px solid #e2e8f0; color: ${statusColor}; font-weight: 600;">${statusLabel}</td>
    </tr>
    ${notes ? `<tr>
      <td style="padding: 8px 12px; border: 1px solid #e2e8f0; background: #f8fafc; font-weight: 600;">Notes</td>
      <td style="padding: 8px 12px; border: 1px solid #e2e8f0;">${notes}</td>
    </tr>` : ""}
  </table>

  <p style="font-size: 13px; color: #64748b; margin-top: 32px; padding-top: 16px; border-top: 1px solid #e2e8f0;">
    This is an automated notification from ${BRAND}. Do not reply to this email.
  </p>
</body>
</html>`;

  return { subject, html };
}

export function buildWorkOrderAssignmentEmail(params: {
  vendorName: string;
  newItem: { title: string; vehicle: string; station: string };
  openOrders: { title: string; vehicle: string; station: string; poNumber: string | null; status: string }[];
  appUrl: string;
}): { subject: string; html: string } {
  const { vendorName, newItem, openOrders, appUrl } = params;

  const subject = `New work order assigned to you — ${newItem.title}`;

  const rows = openOrders
    .map(
      (o) => `<tr>
      <td style="padding: 8px 12px; border: 1px solid #e2e8f0;">${o.poNumber ?? "—"}</td>
      <td style="padding: 8px 12px; border: 1px solid #e2e8f0;">${o.title}</td>
      <td style="padding: 8px 12px; border: 1px solid #e2e8f0;">${o.vehicle}</td>
      <td style="padding: 8px 12px; border: 1px solid #e2e8f0;">${o.station}</td>
      <td style="padding: 8px 12px; border: 1px solid #e2e8f0;">${o.status}</td>
    </tr>`,
    )
    .join("");

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 640px; margin: 0 auto; padding: 20px; color: #1e293b;">
  <div style="border-bottom: 3px solid #2563eb; padding-bottom: 16px; margin-bottom: 24px;">
    <h1 style="margin: 0; font-size: 20px; color: #0f172a;">${BRAND}</h1>
    <p style="margin: 4px 0 0; font-size: 13px; color: #64748b;">Work Order Assignment</p>
  </div>

  <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
    <p style="margin: 0; font-size: 14px; font-weight: 600; color: #2563eb;">
      A new service was assigned to you: ${newItem.title} — ${newItem.vehicle} (${newItem.station})
    </p>
  </div>

  <p style="font-size: 14px; line-height: 1.6;">Hi ${vendorName},</p>
  <p style="font-size: 14px; line-height: 1.6;">
    You have <strong>${openOrders.length}</strong> open work order${openOrders.length === 1 ? "" : "s"} assigned to you.
    When you finish a service, open it in the portal and click <strong>Service Done</strong> to record the details — it goes straight to logged services.
  </p>

  <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 13px;">
    <thead>
      <tr>
        <th style="padding: 8px 12px; border: 1px solid #e2e8f0; background: #f8fafc; text-align: left;">PO#</th>
        <th style="padding: 8px 12px; border: 1px solid #e2e8f0; background: #f8fafc; text-align: left;">Service</th>
        <th style="padding: 8px 12px; border: 1px solid #e2e8f0; background: #f8fafc; text-align: left;">Vehicle</th>
        <th style="padding: 8px 12px; border: 1px solid #e2e8f0; background: #f8fafc; text-align: left;">Station</th>
        <th style="padding: 8px 12px; border: 1px solid #e2e8f0; background: #f8fafc; text-align: left;">Status</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <div style="text-align: center; margin: 24px 0;">
    <a href="${appUrl}/maintenance" style="display: inline-block; background: #2563eb; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">View My Work Orders</a>
  </div>

  <p style="font-size: 13px; color: #64748b; margin-top: 32px; padding-top: 16px; border-top: 1px solid #e2e8f0;">
    This is an automated notification from ${BRAND}. Do not reply to this email.
  </p>
</body>
</html>`;

  return { subject, html };
}
