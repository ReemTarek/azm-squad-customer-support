import type { NotificationChannel } from "./notificationChannel";
import { ConsoleEmailChannel } from "./channels/emailChannel";
import { ConsoleSmsChannel } from "./channels/smsChannel";
import { ConsoleWhatsAppChannel } from "./channels/whatsappChannel";
import { writeAuditLog } from "../lib/audit";

const channels: Record<string, NotificationChannel> = {
  email: new ConsoleEmailChannel(),
  sms: new ConsoleSmsChannel(),
  whatsapp: new ConsoleWhatsAppChannel(),
};

/**
 * Sends a notification through the named channel and records it in the
 * audit log. Swapping a mock channel for a real provider (see the
 * channels/ adapters) requires no change here or at any call site.
 */
export async function notifyCustomer(
  channelName: keyof typeof channels,
  to: string,
  subject: string,
  message: string,
  actorId: string
): Promise<void> {
  const channel = channels[channelName];
  if (!channel) throw new Error(`Unknown notification channel: ${channelName}`);

  await channel.send(to, subject, message);
  await writeAuditLog(actorId, "notification.sent", "Notification", to, { channel: channelName, subject });
}
