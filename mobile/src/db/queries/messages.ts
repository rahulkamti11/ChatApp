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
  isIncoming?: boolean;
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

  const previewText = msg.content || (msg.type === 'image' ? '📷 Photo' : msg.type === 'video' ? '📹 Video' : msg.type === 'audio' ? '🎵 Voice Note' : '[Media]');

  // If message is incoming, increment unread_count; if outgoing, keep unread_count
  if (msg.isIncoming) {
    const res = await db.runAsync(
      `UPDATE local_conversations SET
        last_message_preview = ?,
        last_message_at = ?,
        last_sequence = MAX(last_sequence, ?),
        unread_count = unread_count + 1
      WHERE id = ?`,
      [previewText, msg.createdAt, msg.sequence, msg.conversationId]
    );

    if (res.changes === 0) {
      const otherId = msg.otherUserId || msg.senderId;
      const displayName = msg.otherDisplayName || ('User ' + otherId.substring(0, 5));
      await db.runAsync(
        `INSERT INTO local_conversations (
          id, type, other_user_id, other_display_name, last_message_preview, last_message_at, last_sequence, unread_count, updated_at
        ) VALUES (?, 'direct', ?, ?, ?, ?, ?, 1, datetime('now'))`,
        [msg.conversationId, otherId, displayName, previewText, msg.createdAt, msg.sequence]
      );
    }
  } else {
    const res = await db.runAsync(
      `UPDATE local_conversations SET
        last_message_preview = ?,
        last_message_at = ?,
        last_sequence = MAX(last_sequence, ?)
      WHERE id = ?`,
      [previewText, msg.createdAt, msg.sequence, msg.conversationId]
    );

    if (res.changes === 0) {
      const otherId = msg.otherUserId || msg.senderId;
      const displayName = msg.otherDisplayName || ('User ' + otherId.substring(0, 5));
      await db.runAsync(
        `INSERT INTO local_conversations (
          id, type, other_user_id, other_display_name, last_message_preview, last_message_at, last_sequence, unread_count, updated_at
        ) VALUES (?, 'direct', ?, ?, ?, ?, ?, 0, datetime('now'))`,
        [msg.conversationId, otherId, displayName, previewText, msg.createdAt, msg.sequence]
      );
    }
  }
}

export async function resetConversationUnread(conversationId: string): Promise<void> {
  const db = await getLocalDatabase();
  await db.runAsync(
    `UPDATE local_conversations SET unread_count = 0 WHERE id = ?`,
    [conversationId]
  );
}

export async function getMessagesForConversation(
  conversationId: string,
  limit: number = 100
): Promise<any[]> {
  const db = await getLocalDatabase();
  const rows = await db.getAllAsync(
    `SELECT m.*, 
       (SELECT COUNT(*) FROM local_starred_messages s WHERE s.message_id = m.id) as is_starred
     FROM local_messages m
     WHERE m.conversation_id = ?
     ORDER BY m.sequence ASC
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

export async function editLocalMessage(
  messageId: string,
  newContent: string,
  editedAt: string
): Promise<void> {
  const db = await getLocalDatabase();
  await db.runAsync(
    `UPDATE local_messages SET content = ?, is_edited = 1, edited_at = ? WHERE id = ?`,
    [newContent, editedAt, messageId]
  );

  const lastMsg: any = await db.getFirstAsync(
    `SELECT conversation_id, content FROM local_messages WHERE id = ?`,
    [messageId]
  );
  if (lastMsg) {
    await db.runAsync(
      `UPDATE local_conversations SET last_message_preview = ? WHERE id = ?`,
      [newContent, lastMsg.conversation_id]
    );
  }
}

export async function deleteLocalMessage(
  messageId: string,
  forEveryone: boolean
): Promise<void> {
  const db = await getLocalDatabase();
  if (forEveryone) {
    await db.runAsync(
      `UPDATE local_messages SET is_deleted = 1, content = '🚫 This message was deleted' WHERE id = ?`,
      [messageId]
    );
  } else {
    await db.runAsync(
      `DELETE FROM local_messages WHERE id = ?`,
      [messageId]
    );
  }

  await db.runAsync(`DELETE FROM local_starred_messages WHERE message_id = ?`, [messageId]);
}

export async function updateMessageReaction(
  messageId: string,
  userId: string,
  emoji: string,
  action: 'add' | 'remove'
): Promise<void> {
  const db = await getLocalDatabase();
  const row: any = await db.getFirstAsync(
    `SELECT reactions FROM local_messages WHERE id = ?`,
    [messageId]
  );

  let currentReactions: Record<string, string[]> = {};
  if (row && row.reactions) {
    try {
      currentReactions = JSON.parse(row.reactions);
    } catch (e) {
      currentReactions = {};
    }
  }

  for (const key of Object.keys(currentReactions)) {
    currentReactions[key] = currentReactions[key].filter((uid) => uid !== userId);
    if (currentReactions[key].length === 0) {
      delete currentReactions[key];
    }
  }

  if (action === 'add' && emoji) {
    if (!currentReactions[emoji]) {
      currentReactions[emoji] = [];
    }
    if (!currentReactions[emoji].includes(userId)) {
      currentReactions[emoji].push(userId);
    }
  }

  const reactionsJson = Object.keys(currentReactions).length > 0 ? JSON.stringify(currentReactions) : null;
  await db.runAsync(
    `UPDATE local_messages SET reactions = ? WHERE id = ?`,
    [reactionsJson, messageId]
  );
}

export async function toggleStarMessage(
  messageId: string,
  conversationId: string,
  isStarred: boolean
): Promise<void> {
  const db = await getLocalDatabase();
  if (isStarred) {
    await db.runAsync(
      `INSERT OR REPLACE INTO local_starred_messages (message_id, conversation_id, starred_at) VALUES (?, ?, datetime('now'))`,
      [messageId, conversationId]
    );
  } else {
    await db.runAsync(
      `DELETE FROM local_starred_messages WHERE message_id = ?`,
      [messageId]
    );
  }
}

export async function isMessageStarred(messageId: string): Promise<boolean> {
  const db = await getLocalDatabase();
  const row: any = await db.getFirstAsync(
    `SELECT 1 FROM local_starred_messages WHERE message_id = ?`,
    [messageId]
  );
  return !!row;
}

export async function getStarredMessages(): Promise<any[]> {
  const db = await getLocalDatabase();
  const rows = await db.getAllAsync(
    `SELECT m.*, s.starred_at, c.other_display_name, c.other_username
     FROM local_starred_messages s
     JOIN local_messages m ON s.message_id = m.id
     LEFT JOIN local_conversations c ON m.conversation_id = c.id
     ORDER BY s.starred_at DESC`
  );
  return rows;
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

