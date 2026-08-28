import { Hono } from 'hono';
import { getOrAllocateVirtualNumber } from '../virtual-number/service.js';
import { signJWT } from '../../lib/jwt.js';

const auth = new Hono<{ Bindings: { DB: D1Database; JWT_SECRET?: string } }>();

async function hashPassword(password: string): Promise<string> {
  const msgUint8 = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

auth.post('/register', async (c) => {
  try {
    const body = await c.req.json();
    const { displayName, password, username } = body;

    if (!displayName || !password) {
      return c.json({ error: 'Display name and password are required' }, 400);
    }

    const userId = 'usr_' + crypto.randomUUID().replace(/-/g, '').substring(0, 12);
    const virtualNumber = await getOrAllocateVirtualNumber(c.env.DB);
    const hashedPassword = await hashPassword(password);
    const userUsername = username ? username.toLowerCase().replace(/[^a-z0-9_]/g, '') : null;

    if (userUsername) {
      const existing = await c.env.DB.prepare('SELECT id FROM users WHERE username = ?').bind(userUsername).first();
      if (existing) {
        return c.json({ error: 'Username is already taken' }, 400);
      }
    }

    await c.env.DB.prepare(
      'INSERT INTO users (id, virtual_number, username, display_name, password_hash) VALUES (?, ?, ?, ?, ?)'
    ).bind(userId, virtualNumber, userUsername, displayName, hashedPassword).run();

    await c.env.DB.prepare(
      "UPDATE virtual_numbers SET status = 'assigned', assigned_user_id = ?, assigned_at = datetime('now') WHERE phone_number = ?"
    ).bind(userId, virtualNumber).run();

    const secret = c.env.JWT_SECRET || 'chatapp_default_secret_key_2026';
    const token = await signJWT({ userId, virtualNumber, username: userUsername, displayName }, secret);

    return c.json({
      message: 'User registered successfully',
      token,
      user: {
        id: userId,
        virtualNumber,
        username: userUsername,
        displayName,
        avatarUrl: null,
        statusBio: 'Hey there! I am using Qwink'
      }
    });
  } catch (err: any) {
    return c.json({ error: err.message || String(err), stack: err.stack }, 500);
  }
});

auth.post('/login', async (c) => {
  try {
    const body = await c.req.json();
    const { identifier, password } = body;

    if (!identifier || !password) {
      return c.json({ error: 'Identifier and password are required' }, 400);
    }

    const hashedPassword = await hashPassword(password);
    const user = await c.env.DB.prepare(
      'SELECT * FROM users WHERE (virtual_number = ? OR username = ?) AND password_hash = ?'
    ).bind(identifier, identifier.replace('@', ''), hashedPassword).first<any>();

    if (!user) {
      return c.json({ error: 'Invalid credentials' }, 401);
    }

    const secret = c.env.JWT_SECRET || 'chatapp_default_secret_key_2026';
    const token = await signJWT({
      userId: user.id,
      virtualNumber: user.virtual_number,
      username: user.username,
      displayName: user.display_name
    }, secret);

    return c.json({
      token,
      user: {
        id: user.id,
        virtualNumber: user.virtual_number,
        username: user.username,
        displayName: user.display_name,
        avatarUrl: user.avatar_url,
        statusBio: user.status_bio,
        showVirtualNumber: Boolean(user.show_virtual_number),
        cloudSyncEnabled: Boolean(user.cloud_sync_enabled)
      }
    });
  } catch (err: any) {
    return c.json({ error: err.message || String(err), stack: err.stack }, 500);
  }
});

export default auth;
