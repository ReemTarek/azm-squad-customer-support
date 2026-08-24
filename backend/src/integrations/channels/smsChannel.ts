import type { NotificationChannel } from "../notificationChannel";

/**
 * Mock adapter demonstrating the integration boundary for SMS
 * notifications. A real implementation would swap this for e.g.
 * Twilio, using the same NotificationChannel interface.
 */
export class ConsoleSmsChannel implements NotificationChannel {
  readonly name = "sms";

  async send(to: string, subject: string, message: string): Promise<void> {
    console.log(`[sms:mock] to=${to} body="${subject}: ${message}"`);
  }
}
