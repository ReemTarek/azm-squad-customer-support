import type { NotificationChannel } from "../notificationChannel";

/**
 * Mock adapter demonstrating the integration boundary for WhatsApp
 * notifications. A real implementation would swap this for the Meta
 * WhatsApp Cloud API (free sandbox tier available), using the same
 * NotificationChannel interface.
 */
export class ConsoleWhatsAppChannel implements NotificationChannel {
  readonly name = "whatsapp";

  async send(to: string, subject: string, message: string): Promise<void> {
    console.log(`[whatsapp:mock] to=${to} body="${subject}: ${message}"`);
  }
}
