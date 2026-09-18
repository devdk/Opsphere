import { createMessage } from "./db";
import { sendEmail } from "./mailer";

export interface NotifyOpts {
  level?: "info" | "success" | "warning" | "error";
  title: string;
  body?: string;
  link?: string;
  /** Force an email even for non-error levels. Errors always email. */
  email?: boolean;
}

/**
 * Create an in-app notification (stored in messages). For important events
 * (errors, or when email=true) also send an email and log it as a message.
 * Email failures never throw.
 */
export async function notify(opts: NotifyOpts): Promise<void> {
  const level = opts.level ?? "info";
  createMessage({
    kind: "notification",
    level,
    title: opts.title,
    body: opts.body ?? null,
    link: opts.link ?? null,
  });

  const important = level === "error" || opts.email;
  if (!important) return;

  const to = process.env.PREVIEW_EMAIL || process.env.GMAIL_USER;
  if (!to || !process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) return;

  try {
    const base = process.env.APP_URL || "http://localhost:3000";
    const href = opts.link ? `${base}${opts.link}` : base;
    await sendEmail({
      to,
      subject: `[Command Centre] ${opts.title}`,
      html:
        `<p>${opts.body ?? opts.title}</p>` +
        `<p><a href="${href}">Open dashboard</a></p>`,
      text: `${opts.body ?? opts.title}\n${href}`,
    });
    createMessage({
      kind: "email",
      level,
      title: `Emailed: ${opts.title}`,
      body: opts.body ?? null,
      link: opts.link ?? null,
      recipient: to,
    });
  } catch {
    /* email is best-effort */
  }
}
