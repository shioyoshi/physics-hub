export interface Message {
  id: string;
  channelId: string;
  content: string;
  authorId: string;
  authorName: string;
  imageUrl: string | null;
  mentions: string[];
  reactions: Record<string, string[]>;
  threadId: string | null;
  parentMessageId: string | null;
  replyCount: number;
  isEdited: boolean;
  isPinned: boolean;
  scheduledAt: Date | null;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Draft {
  id: string;
  channelId: string;
  userId: string;
  content: string;
  updatedAt: Date;
}

export interface DMConversation {
  id: string;
  participants: string[];
  participantNames: Record<string, string>;
  lastMessage: string | null;
  lastMessageAt: Date | null;
  createdAt: Date;
}

export interface DMMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  content: string;
  imageUrl: string | null;
  isRead: boolean;
  createdAt: Date;
}
