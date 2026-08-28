import { Hono } from 'hono';
import { authMiddleware } from '../../middleware/auth.js';
import { ConnectionManager } from '../../ws/connections.js';
import { getNextSequence } from '../../ws/sequence.js';

const messages = new Hono<{ Bindings: { DB: D1Database } }>();
messages.use('*', authMiddleware);

messages.post('/send', async (c) => {
  try {
    const authUser = c.get('user');
    const body = await c.req.json();
    const { id, conversationId, recipientId, type, content, mediaUrl, mediaMetadata, replyToId } = body;

    if (!id || !conversationId || !recipientId) {
      return c.json({ error: 'Missing required message parameters' }, 400);
    }

    const sequence = await getNextSequence(c.env.DB, conversationId);
    const createdAt = new Date().toISOString();

    const messagePayload = {
      event: 'message_received',
      id,
      conversationId,
      senderId: authUser.userId,
      recipientId,
      sequence,
      type: type || 'text',
      content: content || null,
      mediaUrl: mediaUrl || null,
      mediaMetadata: mediaMetadata || null,
      replyToId: replyToId || null,
      createdAt,
    };

    const payloadString = JSON.stringify(messagePayload);
    const recipientSocket = ConnectionManager.get(recipientId);

    if (recipientSocket && recipientSocket.readyState === WebSocket.OPEN) {
      recipientSocket.send(payloadString);
    } else {
      await c.env.DB.prepare(`
        INSERT INTO pending_messages (id, conversation_id, sender_id, recipient_id, sequence, encrypted_payload)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(id, conversationId, authUser.userId, recipientId, sequence, payloadString).run();
    }

    return c.json({
      messageId: id,
      conversationId,
      sequence,
      status: recipientSocket ? 'delivered' : 'sent',
      createdAt,
    });
  } catch (err: any) {
    return c.json({ error: err.message || 'Failed to send message' }, 500);
  }
});

messages.post('/sync', async (c) => {
  try {
    const authUser = c.get('user');
    const { lastSequence, conversationId } = await c.req.json();

    const pending = await c.env.DB.prepare(`
      SELECT * FROM pending_messages 
      WHERE recipient_id = ? AND (? IS NULL OR conversation_id = ?) AND sequence > ?
      ORDER BY sequence ASC
    `).bind(authUser.userId, conversationId || null, conversationId || null, lastSequence || 0).all();

    const missedMessages = (pending.results || []).map((row: any) => JSON.parse(row.encrypted_payload));

    return c.json({ messages: missedMessages });
  } catch (err: any) {
    return c.json({ error: err.message || 'Failed to sync messages' }, 500);
  }
});

export default messages;
