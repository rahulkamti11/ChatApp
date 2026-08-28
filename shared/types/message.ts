export type MessageType = 'text' | 'image' | 'video' | 'audio' | 'gif' | 'document' | 'system';
export type MessageStatus = 'pending' | 'sent' | 'delivered' | 'read';
export type DisappearMode = 'instant' | '24h' | '7d' | '30d' | null;

export interface MediaMetadata {
  width?: number;
  height?: number;
  durationSec?: number;
  fileSizeBytes?: number;
  mimeType?: string;
  fileName?: string;
}

export interface MessageReaction {
  userId: string;
  emoji: string;
  createdAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  sequence: number;
  type: MessageType;
  content: string | null;
  mediaUrl: string | null;
  mediaLocalPath?: string | null;
  mediaMetadata: MediaMetadata | null;
  replyToId: string | null;
  reactions: MessageReaction[];
  status: MessageStatus;
  isEdited: boolean;
  editedAt: string | null;
  isDeleted: boolean;
  disappearMode: DisappearMode;
  disappearAt: string | null;
  createdAt: string;
}
