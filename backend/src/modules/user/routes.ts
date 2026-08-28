import { Hono } from 'hono';
import { authMiddleware } from '../../middleware/auth.js';

const user = new Hono<{ Bindings: { DB: D1Database } }>();
user.use('*', authMiddleware);

user.get('/me', async (c) => {
  const authUser = c.get('user');
  const userRecord = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(authUser.userId).first<any>();
  
  if (!userRecord) {
    return c.json({ error: 'User not found' }, 404);
  }
  
  return c.json({
    id: userRecord.id,
    virtualNumber: userRecord.virtual_number,
    username: userRecord.username,
    displayName: userRecord.display_name,
    avatarUrl: userRecord.avatar_url,
    statusBio: userRecord.status_bio,
    showVirtualNumber: Boolean(userRecord.show_virtual_number),
    showLastSeen: Boolean(userRecord.show_last_seen),
    showReadReceipts: Boolean(userRecord.show_read_receipts),
    cloudSyncEnabled: Boolean(userRecord.cloud_sync_enabled),
    createdAt: userRecord.created_at
  });
});

user.patch('/profile', async (c) => {
  const authUser = c.get('user');
  const body = await c.req.json();
  const { displayName, statusBio, avatarUrl, showVirtualNumber, cloudSyncEnabled } = body;
  
  await c.env.DB.prepare(
    UPDATE users SET
      display_name = COALESCE(?, display_name),
      status_bio = COALESCE(?, status_bio),
      avatar_url = COALESCE(?, avatar_url),
      show_virtual_number = COALESCE(?, show_virtual_number),
      cloud_sync_enabled = COALESCE(?, cloud_sync_enabled),
      updated_at = datetime('now')
    WHERE id = ?
  ).bind(
    displayName ?? null,
    statusBio ?? null,
    avatarUrl ?? null,
    showVirtualNumber !== undefined ? (showVirtualNumber ? 1 : 0) : null,
    cloudSyncEnabled !== undefined ? (cloudSyncEnabled ? 1 : 0) : null,
    authUser.userId
  ).run();
  
  return c.json({ message: 'Profile updated successfully' });
});

user.patch('/username', async (c) => {
  const authUser = c.get('user');
  const { username } = await c.req.json();
  
  if (!username) {
    return c.json({ error: 'Username is required' }, 400);
  }
  
  const cleanUsername = username.toLowerCase().replace(/[^a-z0-9_]/g, '');
  if (cleanUsername.length < 3 || cleanUsername.length > 20) {
    return c.json({ error: 'Username must be between 3 and 20 characters' }, 400);
  }
  
  const existing = await c.env.DB.prepare('SELECT id FROM users WHERE username = ? AND id != ?').bind(cleanUsername, authUser.userId).first();
  if (existing) {
    return c.json({ error: 'Username is already taken' }, 400);
  }
  
  await c.env.DB.prepare('UPDATE users SET username = ?, updated_at = datetime(\now\) WHERE id = ?').bind(cleanUsername, authUser.userId).run();
  
  return c.json({ message: 'Username updated successfully', username: cleanUsername });
});

user.get('/search', async (c) => {
  const query = c.req.query('q');
  if (!query) {
    return c.json({ users: [] });
  }
  
  const cleanQuery = query.replace('@', '').trim();
  const results = await c.env.DB.prepare(
    SELECT id, display_name, username, virtual_number, avatar_url, show_virtual_number, status_bio
    FROM users
    WHERE (username LIKE ? OR virtual_number LIKE ? OR display_name LIKE ?)
    LIMIT 20
  ).bind(%%, %%, %%).all();
  
  const users = (results.results || []).map((u: any) => ({
    id: u.id,
    displayName: u.display_name,
    username: u.username,
    virtualNumber: u.show_virtual_number ? u.virtual_number : null,
    avatarUrl: u.avatar_url,
    statusBio: u.status_bio
  }));
  
  return c.json({ users });
});

export default user;
