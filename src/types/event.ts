export type EventType = "meeting" | "practice" | "competition" | "other";
export type RSVPStatus = "going" | "maybe" | "not_going";

export interface PhysicsEvent {
  id: string;
  title: string;
  description: string;
  eventType: EventType;
  startDate: Date;
  endDate: Date | null;
  location: string;
  rsvps: Record<string, RSVPStatus>;
  createdBy: string;
  createdByName: string;
  createdAt: Date;
  updatedAt: Date;
}
