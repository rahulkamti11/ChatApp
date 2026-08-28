import { DisappearMode } from './message.js';

export type ConversationType = 'direct' | 'group';
export type MemberRole = 'owner' | 'admin' | 'member';

export interface ConversationMember {
  id: string;
  conversationId: string;
  userId: string;
  role: MemberRole;
  lastReadSequence: number;
  lastDeliveredSequence: number;
  isHidden: boolean;
  isPinned: boolean;
  muteUntil: string | null;
  joinedAt: string;
}

export interface Conversation {
  id: string;
  type: ConversationType;
  title: string | null;
  avatarUrl: string | null;
  createdBy: string | null;
  currentSequence: number;
  disappearMode: DisappearMode;
  lastMessagePreview: string | null;
  lastMessageAt: string | null;
  unreadCount?: number;
  otherUser?: {
    id: string;
    displayName: string;
    username: string | null;
    virtualNumber: string | null;
    avatarUrl: string | null;
    isOnline: boolean;
  };
  createdAt: string;
  updatedAt: string;
}
