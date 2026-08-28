import { Message, MessageStatus, DisappearMode } from './message.js';

export type WSEventType =
  | 'auth'
  | 'send_message'
  | 'message_received'
  | 'ack'
  | 'delivery_receipt'
  | 'typing'
  | 'presence'
  | 'edit_message'
  | 'delete_message'
  | 'reaction'
  | 'call_offer'
  | 'call_answer'
  | 'ice_candidate'
  | 'call_end'
  | 'error';

export interface WSBasePayload {
  event: WSEventType;
}

export interface WSAuthPayload extends WSBasePayload {
  event: 'auth';
  token: string;
}

export interface WSSendMessagePayload extends WSBasePayload {
  event: 'send_message';
  id: string;
  conversationId: string;
  recipientId: string;
  type: string;
  content: string | null;
  mediaUrl: string | null;
  mediaMetadata: any | null;
  replyToId: string | null;
  disappearMode: DisappearMode;
}

export interface WSAckPayload extends WSBasePayload {
  event: 'ack';
  messageId: string;
  conversationId: string;
  sequence: number;
}

export interface WSDeliveryReceiptPayload extends WSBasePayload {
  event: 'delivery_receipt';
  messageId: string;
  conversationId: string;
  status: MessageStatus;
}

export interface WSTypingPayload extends WSBasePayload {
  event: 'typing';
  conversationId: string;
  recipientId: string;
  isTyping: boolean;
}
