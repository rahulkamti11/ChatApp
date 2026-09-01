import { ConnectionManager } from './connections.js';
import { getNextSequence } from './sequence.js';
import { verifyJWT } from '../lib/jwt.js';

export async function handleWebSocketUpgrade(
  request: Request,
  env: { DB: D1Database; JWT_SECRET?: string }
): Promise<Response> {
  const url = new URL(request.url);
  const token = url.searchParams.get('token');

  if (!token) {
    return new Response('Unauthorized: Token missing', { status: 401 });
  }

  const secret = env.JWT_SECRET || 'chatapp_default_secret_key_2026';
  const user = await verifyJWT(token, secret);

  if (!user) {
    return new Response('Unauthorized: Invalid token', { status: 401 });
  }

  const webSocketPair = new WebSocketPair();
  const [client, server] = Object.values(webSocketPair);

  server.accept();
  ConnectionManager.add(user.userId, server);

  // Update user online status
  await env.DB.prepare('UPDATE users SET is_online = 1 WHERE id = ?').bind(user.userId).run();

  // Deliver pending offline messages from D1
  try {
    const pending = await env.DB.prepare(
      'SELECT * FROM pending_messages WHERE recipient_id = ? ORDER BY sequence ASC'
    ).bind(user.userId).all();

    if (pending.results && pending.results.length > 0) {
      for (const row of pending.results as any[]) {
        server.send(row.encrypted_payload);
      }
    }
  } catch (err) {
    console.error('[WS] Failed to fetch pending messages:', err);
  }

  server.addEventListener('message', async (event) => {
    try {
      const data = JSON.parse(event.data as string);

      switch (data.event) {
        case 'send_message': {
          const sequence = await getNextSequence(env.DB, data.conversationId);
          const createdAt = new Date().toISOString();

          const messagePayload = {
            event: 'message_received',
            id: data.id,
            conversationId: data.conversationId,
            senderId: user.userId,
            recipientId: data.recipientId,
            sequence,
            type: data.type || 'text',
            content: data.content,
            mediaUrl: data.mediaUrl || null,
            mediaMetadata: data.mediaMetadata || null,
            replyToId: data.replyToId || null,
            createdAt,
          };

          const payloadString = JSON.stringify(messagePayload);
          const recipientSocket = ConnectionManager.get(data.recipientId);

          if (recipientSocket && recipientSocket.readyState === WebSocket.OPEN) {
            // Online delivery via WebSocket
            recipientSocket.send(payloadString);

            // Notify sender immediately that message was delivered to recipient
            server.send(
              JSON.stringify({
                event: 'delivery_receipt',
                messageId: data.id,
                conversationId: data.conversationId,
                status: 'delivered',
              })
            );
          } else {
            // Recipient OFFLINE: queue in D1 pending_messages table
            await env.DB.prepare(`
              INSERT INTO pending_messages (id, conversation_id, sender_id, recipient_id, sequence, encrypted_payload)
              VALUES (?, ?, ?, ?, ?, ?)
            `).bind(data.id, data.conversationId, user.userId, data.recipientId, sequence, payloadString).run();

            // Notify sender that message was sent to server
            server.send(
              JSON.stringify({
                event: 'delivery_receipt',
                messageId: data.id,
                conversationId: data.conversationId,
                status: 'sent',
              })
            );
          }
          break;
        }

        case 'ack': {
          // Recipient phone ACK'd receipt -> delete from pending_messages
          await env.DB.prepare(
            'DELETE FROM pending_messages WHERE id = ? AND recipient_id = ?'
          ).bind(data.messageId, user.userId).run();

          // Notify sender of delivery receipt
          const senderId = data.senderId;
          if (senderId) {
            const senderSocket = ConnectionManager.get(senderId);
            if (senderSocket && senderSocket.readyState === WebSocket.OPEN) {
              senderSocket.send(
                JSON.stringify({
                  event: 'delivery_receipt',
                  messageId: data.messageId,
                  conversationId: data.conversationId,
                  status: 'delivered',
                })
              );
            }
          }
          break;
        }

        case 'read_receipt': {
          const senderId = data.senderId;
          if (senderId) {
            const senderSocket = ConnectionManager.get(senderId);
            if (senderSocket && senderSocket.readyState === WebSocket.OPEN) {
              senderSocket.send(
                JSON.stringify({
                  event: 'delivery_receipt',
                  conversationId: data.conversationId,
                  status: 'read',
                })
              );
            }
          }
          break;
        }
      }
    } catch (err) {
      console.error('[WS] Error processing message:', err);
    }
  });

  server.addEventListener('close', async () => {
    ConnectionManager.remove(user.userId);
    await env.DB.prepare(
      'UPDATE users SET is_online = 0, last_seen_at = datetime("now") WHERE id = ?'
    ).bind(user.userId).run();
  });

  return new Response(null, { status: 101, webSocket: client });
}
