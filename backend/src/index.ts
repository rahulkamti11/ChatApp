import { Hono } from 'hono';
import authRoutes from './modules/auth/routes.js';
import userRoutes from './modules/user/routes.js';
import { handleWebSocketUpgrade } from './ws/handler.js';

const app = new Hono<{ Bindings: { DB: D1Database; MEDIA_BUCKET: R2Bucket; JWT_SECRET?: string } }>();

app.get('/', (c) => {
  return c.json({
    app: 'Qwink Chat API',
    status: 'online',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// Mount REST routes
app.route('/api/auth', authRoutes);
app.route('/api/user', userRoutes);

// WebSocket Upgrade route
app.get('/ws', async (c) => {
  if (c.req.header('Upgrade') !== 'websocket') {
    return c.text('Expected Upgrade: websocket', 426);
  }
  return handleWebSocketUpgrade(c.req.raw, c.env);
});

export default app;
