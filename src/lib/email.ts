import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const FROM_EMAIL = process.env.EMAIL_FROM || "LiveFleet AI <noreply@livefleetai.com>";

export interface EmailPayload {
  to: string;
  subject: string;
  html: string;
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
    <h1 style="margin: 0; font-size: 20px; color: #0f172a;">Live Fleet AI</h1>
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
    This is an automated notification from Live Fleet AI. Do not reply to this email.
  </p>
</body>
</html>`;

  return { subject, html };
}
