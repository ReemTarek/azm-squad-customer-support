export interface NotificationChannel {
  readonly name: string;
  send(to: string, subject: string, message: string): Promise<void>;
}
