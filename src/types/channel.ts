export type ChannelCategory = "general" | "project" | "topic" | "announcement";
export type ChannelType = "default" | "thread";

export interface Channel {
  id: string;
  name: string;
  description: string;
  category: ChannelCategory;
  channelType: ChannelType;
  isPrivate: boolean;
  allowedRoles: string[];
  allowedUsers: string[];
  isArchived: boolean;
  pinnedMessageIds: string[];
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  lastMessageAt: Date | null;
}
