import nodemailer from "nodemailer";
import type { NotificationChannel } from "../notificationChannel";
import { env } from "../../config/env";

/**
 * Real email channel via SMTP (works with Gmail using an app password:
 * https://myaccount.google.com/apppasswords). Falls back to logging
 * instead of throwing if SMTP isn't configured, so a missing/incomplete
 * credential never breaks the request that triggered the notification.
 */
export class SmtpEmailChannel implements NotificationChannel {
  readonly name = "email";
  private transporter = env.smtpUser && env.smtpPass
    ? nodemailer.createTransport({
        host: env.smtpHost,
        port: env.smtpPort,
        secure: env.smtpPort === 465,
        auth: { user: env.smtpUser, pass: env.smtpPass },
        // Nodemailer's defaults (2min / 30s / 10min) are far too long now that
        // this transport is exercised inline on a high-frequency endpoint
        // (every staff reply, not just the rare resolved/closed transition).
        // Keep these short so a slow/hung SMTP host can't stall a routine
        // "send reply" request for minutes.
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 10_000,
      })
    : null;

  async send(to: string, subject: string, message: string): Promise<void> {
    if (!this.transporter) {
      console.log(`[email:unconfigured] SMTP_USER/SMTP_PASS not set — would send to=${to} subject="${subject}"`);
      return;
    }

    await this.transporter.sendMail({
      from: env.smtpUser,
      to,
      subject,
      text: message,
    });
  }
}
