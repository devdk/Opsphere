import nodemailer, { type Transporter } from "nodemailer";

let transporter: Transporter | null = null;

/**
 * Gmail SMTP transporter using an App Password.
 * Requires GMAIL_USER and GMAIL_APP_PASSWORD in the environment.
 */
export function getTransporter(): Transporter {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    throw new Error(
      "GMAIL_USER and GMAIL_APP_PASSWORD must be set in .env.local."
    );
  }
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });
  }
  return transporter;
}

export interface SendEmailInput {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

/**
 * Send an email. Returns the messageId on success.
 */
export async function sendEmail(input: SendEmailInput): Promise<string> {
  const t = getTransporter();
  const info = await t.sendMail({
    from: process.env.GMAIL_USER,
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html,
  });
  return info.messageId;
}

/**
 * Send a copy of an email to the PREVIEW_EMAIL address for review,
 * instead of the real recipient. Handy for testing outreach drafts.
 */
export async function sendPreview(input: SendEmailInput): Promise<string> {
  const preview = process.env.PREVIEW_EMAIL || process.env.GMAIL_USER;
  if (!preview) {
    throw new Error("PREVIEW_EMAIL or GMAIL_USER must be set.");
  }
  return sendEmail({
    ...input,
    to: preview,
    subject: `[PREVIEW → ${input.to}] ${input.subject}`,
  });
}

/** Verify SMTP credentials. Resolves true if the server accepts the login. */
export async function verifyMailer(): Promise<boolean> {
  const t = getTransporter();
  await t.verify();
  return true;
}
