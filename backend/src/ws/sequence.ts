export async function getNextSequence(db: D1Database, conversationId: string): Promise<number> {
  // Ensure conversation row exists or create it
  await db.prepare(`
    INSERT INTO conversations (id, type, current_sequence)
    VALUES (?, 'direct', 1)
    ON CONFLICT(id) DO UPDATE SET
      current_sequence = current_sequence + 1,
      updated_at = datetime('now')
  `).bind(conversationId).run();

  const row = await db.prepare(
    'SELECT current_sequence FROM conversations WHERE id = ?'
  ).bind(conversationId).first<{ current_sequence: number }>();

  return row ? row.current_sequence : 1;
}
