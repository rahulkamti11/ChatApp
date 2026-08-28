import { Hono } from 'hono';
import authRoutes from './modules/auth/routes.js';
import userRoutes from './modules/user/routes.js';

const app = new Hono<{ Bindings: { DB: D1Database; MEDIA_BUCKET: R2Bucket; JWT_SECRET?: string } }>();

app.get('/', (c) => {
  return c.json({
    app: 'Qwink Chat API',
    status: 'online',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

app.route('/api/auth', authRoutes);
app.route('/api/user', userRoutes);

export default app;
