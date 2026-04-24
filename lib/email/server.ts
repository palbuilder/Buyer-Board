import { Resend } from "resend";
import { buildBuyerBoardUrl, hasEmailDeliveryEnv } from "@/lib/email/config";

let resendClient: Resend | null = null;

function getResendClient() {
  if (!hasEmailDeliveryEnv()) {
    return null;
  }

  if (!resendClient) {
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }

  return resendClient;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export async function sendBuyerBoardEmail(input: {
  to: string;
  subject: string;
  body: string;
  href?: string;
}) {
  const resend = getResendClient();
  const from = process.env.BUYERBOARD_EMAIL_FROM?.trim();

  if (!resend || !from) {
    return;
  }

  const actionUrl = input.href ? buildBuyerBoardUrl(input.href) : undefined;
  const preferencesUrl = buildBuyerBoardUrl("/dashboard?tab=buyer#notification-settings");
  const escapedSubject = escapeHtml(input.subject);
  const escapedBody = escapeHtml(input.body);
  const escapedActionUrl = actionUrl ? escapeHtml(actionUrl) : undefined;
  const escapedPreferencesUrl = escapeHtml(preferencesUrl);

  await resend.emails.send({
    from,
    to: input.to,
    subject: input.subject,
    text: actionUrl ? `${input.body}\n\nOpen: ${actionUrl}` : input.body,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #0C1821; max-width: 620px; margin: 0 auto; padding: 24px;">
        <div style="background: #FDF0D5; border: 1px solid rgba(12,24,33,0.08); border-radius: 20px; padding: 24px;">
          <p style="font-size: 12px; letter-spacing: 0.18em; text-transform: uppercase; color: #577590; margin: 0 0 12px;">BuyerBoard</p>
          <h1 style="font-size: 24px; margin: 0 0 12px;">${escapedSubject}</h1>
          <p style="font-size: 16px; margin: 0 0 16px;">${escapedBody}</p>
          ${
            escapedActionUrl
              ? `<p style="margin: 24px 0 0;">
                  <a href="${escapedActionUrl}" style="display: inline-block; background: #126590; color: #ffffff; text-decoration: none; padding: 12px 18px; border-radius: 999px; font-weight: 600;">
                    Open BuyerBoard
                  </a>
                </p>`
              : ""
          }
          <p style="margin: 24px 0 0; font-size: 13px; color: #577590;">
            You are receiving this because important BuyerBoard alerts are enabled on your account.
            <a href="${escapedPreferencesUrl}" style="color: #126590;">Manage notification settings</a>.
          </p>
        </div>
      </div>
    `,
  });
}
