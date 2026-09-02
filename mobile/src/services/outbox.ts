import { getPendingOutboxMessages, updateMessageStatus } from '../db/queries/messages';
import { socketService } from './socket';
import { apiRequest } from './api';

let isFlushing = false;

export async function flushOutbox(token: string | null, onMessageSent?: () => void): Promise<void> {
  if (!token || isFlushing) return;
  isFlushing = true;

  try {
    const pendingMessages = await getPendingOutboxMessages();
    if (!pendingMessages || pendingMessages.length === 0) {
      isFlushing = false;
      return;
    }

    let anySent = false;

    for (const msg of pendingMessages) {
      let recipientId = msg.recipient_id;
      if (!recipientId && msg.conversation_id && msg.conversation_id.includes('_')) {
        const parts = msg.conversation_id.split('_');
        recipientId = parts.find((p: string) => p !== msg.sender_id);
      }
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

      // 2. Fallback to REST API if WebSocket not open
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
          if (res && (res.status === 'sent' || res.status === 'delivered')) {
            sent = true;
          }
        } catch (e) {
          // Network still down; leave in pending state
          break;
        }
      }

      if (sent) {
        await updateMessageStatus(msg.id, 'sent');
        anySent = true;
      }
    }

    if (anySent) {
      socketService.emit('outbox_flushed', {});
      if (onMessageSent) {
        onMessageSent();
      }
    }
  } catch (err) {
    console.error('[Outbox] Flush error:', err);
  } finally {
    isFlushing = false;
  }
}
