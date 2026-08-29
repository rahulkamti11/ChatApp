import { insertLocalMessage, updateMessageStatus } from '../db/queries/messages';

const DEV_PC_IP = '10.60.145.14';
const CLOUDFLARE_WS_URL = 'wss://chatapp-backend.rahulkamti11.workers.dev/ws';
const LOCAL_WS_URL = `ws://${DEV_PC_IP}:8787/ws`;

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

    // Try local dev server first, fallback to Cloudflare
    try {
      this.ws = new WebSocket(`${LOCAL_WS_URL}?token=${token}`);
    } catch {
      this.ws = new WebSocket(`${CLOUDFLARE_WS_URL}?token=${token}`);
    }

    this.ws.onopen = () => {
      console.log('[WebSocket] Connected');
      this.isConnecting = false;
      this.emit('connection_change', { status: 'connected' });
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

    this.ws.onerror = (error) => {
      // Quietly ignore connection errors during offline preview mode
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
        });

        this.send({
          event: 'ack',
          messageId: data.id,
          conversationId: data.conversationId,
          sequence: data.sequence,
        });
        break;

      case 'delivery_receipt':
        await updateMessageStatus(data.messageId, data.status);
        break;
    }

    const handlers = this.listeners.get(data.event);
    if (handlers) {
      handlers.forEach((fn) => fn(data));
    }
  }

  public send(payload: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }
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
