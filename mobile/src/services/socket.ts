import { insertLocalMessage, updateMessageStatus, updateConversationMessagesStatus } from '../db/queries/messages';
import { flushOutbox } from './outbox';

// Production Cloudflare Workers WebSocket endpoint
const CLOUDFLARE_WS_URL = 'wss://chatapp-backend.kamti03rahul.workers.dev/ws';

class SocketService {
  private ws: WebSocket | null = null;
  private token: string | null = null;
  private listeners: Map<string, Set<(data: any) => void>> = new Map();
  private isConnecting: boolean = false;

  public connect(token: string) {
    this.token = token;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.isConnecting = true;

    // Connect directly to Cloudflare Workers production endpoint
    this.ws = new WebSocket(`${CLOUDFLARE_WS_URL}?token=${token}`);

    this.ws.onopen = () => {
      console.log('[WebSocket] Connected to Cloudflare Workers');
      this.isConnecting = false;
      this.emit('connection_change', { status: 'connected' });
      // Flush any queued offline messages
      flushOutbox(this.token);
    };

    this.ws.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);
        await this.handleIncomingEvent(data);
      } catch (err) {
        console.error('[WebSocket] Error parsing message:', err);
      }
    };

    this.ws.onclose = () => {
      this.isConnecting = false;
      this.emit('connection_change', { status: 'disconnected' });
    };

    this.ws.onerror = (_error) => {
      // Quietly ignore connection errors to avoid Expo Go toast popups
    };
  }

  private async handleIncomingEvent(data: any) {
    switch (data.event) {
      case 'message_received':
        await insertLocalMessage({
          id: data.id,
          conversationId: data.conversationId,
          senderId: data.senderId,
          sequence: data.sequence,
          type: data.type || 'text',
          content: data.content,
          mediaUrl: data.mediaUrl,
          mediaMetadata: data.mediaMetadata ? JSON.stringify(data.mediaMetadata) : null,
          replyToId: data.replyToId,
          status: 'delivered',
          createdAt: data.createdAt || new Date().toISOString(),
          otherUserId: data.senderId,
        });

        this.send({
          event: 'ack',
          messageId: data.id,
          conversationId: data.conversationId,
          senderId: data.senderId,
          sequence: data.sequence,
        });
        break;

      case 'delivery_receipt':
        if (data.messageId) {
          await updateMessageStatus(data.messageId, data.status);
        }
        if (data.conversationId && data.status === 'read') {
          await updateConversationMessagesStatus(data.conversationId, 'read');
        }
        break;
    }

    const handlers = this.listeners.get(data.event);
    if (handlers) {
      handlers.forEach((fn) => fn(data));
    }
  }

  public isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  // Returns true if the message was sent over an open WebSocket, false otherwise.
  // The return value is used by chat/[id].tsx to decide whether to fall back to REST API.
  public send(payload: any): boolean {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
      return true;
    }
    return false;
  }

  public on(event: string, callback: (data: any) => void) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);

    return () => {
      const handlers = this.listeners.get(event);
      if (handlers) {
        handlers.delete(callback);
      }
    };
  }

  private emit(event: string, data: any) {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.forEach((fn) => fn(data));
    }
  }

  public disconnect() {
    this.token = null;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

export const socketService = new SocketService();
