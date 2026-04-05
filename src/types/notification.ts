export type NotificationType =
  | "mention_channel"
  | "mention_thread"
  | "wiki_update"
  | "event_created"
  | "poll_created"
  | "approval_request"
  | "approval_result"
  | "inventory_update";

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  link: string;
  isRead: boolean;
  createdAt: Date;
}
