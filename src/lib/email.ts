import { Resend } from "resend";
import { BRAND } from "@/lib/brand";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const FROM_EMAIL = process.env.EMAIL_FROM || `${BRAND} <onboarding@resend.dev>`;

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

export async function sendEmail(payload: EmailPayload): Promise<{ success: boolean; error?: string }> {
  if (!resend) {
    console.warn("[Email] RESEND_API_KEY not set — skipping email send");
    return { success: false, error: "RESEND_API_KEY not configured" };
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
