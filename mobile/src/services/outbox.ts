import { getPendingOutboxMessages, updateMessageStatus } from '../db/queries/messages';
import { socketService } from './socket';
import { apiRequest } from './api';

let isFlushing = false;

export async function flushOutbox(token: string | null): Promise<void> {
  if (!token || isFlushing) return;
  isFlushing = true;

  try {
    const pendingMessages = await getPendingOutboxMessages();
    if (!pendingMessages || pendingMessages.length === 0) {
      isFlushing = false;
      return;
    }

    for (const msg of pendingMessages) {
      const recipientId = msg.recipient_id;
      if (!recipientId) continue;

      let sent = false;

      // 1. Try sending via WebSocket if open
      if (socketService.isConnected()) {
        sent = socketService.send({
          event: 'send_message',
          id: msg.id,
          conversationId: msg.conversation_id,
          recipientId,
          type: msg.type || 'text',
          content: msg.content,
        });
      }

      // 2. Fallback to REST API if WebSocket failed
      if (!sent) {
        try {
          const res = await apiRequest('/api/messages/send', {
            method: 'POST',
            body: JSON.stringify({
              id: msg.id,
              conversationId: msg.conversation_id,
              recipientId,
              type: msg.type || 'text',
              content: msg.content,
            }),
          }, token);
          if (res && res.status) {
            sent = true;
          }
        } catch (e) {
          // Network still down; leave in pending state
          break;
        }
      }

      if (sent) {
        await updateMessageStatus(msg.id, 'sent');
      }
    }
  } catch (err) {
    console.error('[Outbox] Flush error:', err);
  } finally {
    isFlushing = false;
  }
}
