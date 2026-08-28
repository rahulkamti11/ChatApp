import { Context, Next } from 'hono';
import { verifyJWT } from '../lib/jwt.js';

export async function authMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized: Missing or invalid token' }, 401);
  }
  
  const token = authHeader.substring(7);
  const secret = c.env.JWT_SECRET || 'chatapp_default_secret_key_2026';
  const payload = await verifyJWT(token, secret);
  
  if (!payload) {
    return c.json({ error: 'Unauthorized: Invalid or expired token' }, 401);
  }
  
  c.set('user', payload);
  await next();
}
