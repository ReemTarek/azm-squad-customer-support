import type { NotificationChannel } from "../notificationChannel";

/**
 * Mock adapter demonstrating the integration boundary for email
 * notifications. A real implementation would swap this for e.g.
 * Nodemailer + SMTP or a transactional provider (Resend, SendGrid),
 * using the same NotificationChannel interface — no caller changes.
 */
export class ConsoleEmailChannel implements NotificationChannel {
  readonly name = "email";

  async send(to: string, subject: string, message: string): Promise<void> {
    console.log(`[email:mock] to=${to} subject="${subject}" body="${message}"`);
  }
}
