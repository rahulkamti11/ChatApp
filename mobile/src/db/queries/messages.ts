import { getLocalDatabase } from '../client';

export interface LocalMessageInput {
  id: string;
  conversationId: string;
  senderId: string;
  sequence: number;
  type: string;
  content: string | null;
  mediaUrl?: string | null;
  mediaLocalPath?: string | null;
  mediaMetadata?: string | null;
  replyToId?: string | null;
  reactions?: string | null;
  status: 'pending' | 'sent' | 'delivered' | 'read';
  disappearMode?: string | null;
  createdAt: string;
  otherUserId?: string;
  otherDisplayName?: string;
}

export async function insertLocalMessage(msg: LocalMessageInput): Promise<void> {
  const db = await getLocalDatabase();
  await db.runAsync(
    `INSERT OR IGNORE INTO local_messages (
      id, conversation_id, sender_id, sequence, type, content,
      media_url, media_local_path, media_metadata, reply_to_id,
      reactions, status, disappear_mode, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      msg.id,
      msg.conversationId,
      msg.senderId,
      msg.sequence,
      msg.type,
      msg.content || null,
      msg.mediaUrl || null,
      msg.mediaLocalPath || null,
      msg.mediaMetadata || null,
      msg.replyToId || null,
      msg.reactions || null,
      msg.status,
      msg.disappearMode || null,
      msg.createdAt,
    ]
  );

  const res = await db.runAsync(
    `UPDATE local_conversations SET
      last_message_preview = ?,
      last_message_at = ?,
      last_sequence = MAX(last_sequence, ?)
    WHERE id = ?`,
    [msg.content || '[Media]', msg.createdAt, msg.sequence, msg.conversationId]
  );

  // If conversation does not exist yet (e.g. first incoming message from another user)
  if (res.changes === 0) {
    const otherId = msg.otherUserId || msg.senderId;
    const displayName = msg.otherDisplayName || ('User ' + otherId.substring(0, 5));
    await db.runAsync(
      `INSERT INTO local_conversations (
        id, type, other_user_id, other_display_name, last_message_preview, last_message_at, last_sequence, updated_at
      ) VALUES (?, 'direct', ?, ?, ?, ?, ?, datetime('now'))`,
      [msg.conversationId, otherId, displayName, msg.content || '[Media]', msg.createdAt, msg.sequence]
    );
  }
}

export async function getMessagesForConversation(
  conversationId: string,
  limit: number = 50
): Promise<any[]> {
  const db = await getLocalDatabase();
  const rows = await db.getAllAsync(
    `SELECT * FROM local_messages
     WHERE conversation_id = ?
     ORDER BY sequence ASC
     LIMIT ?`,
    [conversationId, limit]
  );
  return rows;
}

export async function updateMessageStatus(
  messageId: string,
  status: 'pending' | 'sent' | 'delivered' | 'read'
): Promise<void> {
  const db = await getLocalDatabase();
  await db.runAsync(
    `UPDATE local_messages SET status = ? WHERE id = ?`,
    [status, messageId]
  );
}

export async function updateConversationMessagesStatus(
  conversationId: string,
  status: 'delivered' | 'read'
): Promise<void> {
  const db = await getLocalDatabase();
  await db.runAsync(
    `UPDATE local_messages SET status = ? WHERE conversation_id = ? AND status != 'read'`,
    [status, conversationId]
  );
}

export async function getPendingOutboxMessages(): Promise<any[]> {
  const db = await getLocalDatabase();
  return await db.getAllAsync(
    `SELECT m.*, c.other_user_id as recipient_id
     FROM local_messages m
     LEFT JOIN local_conversations c ON m.conversation_id = c.id
     WHERE m.status = 'pending'
     ORDER BY m.sequence ASC`
  );
}

