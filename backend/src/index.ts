import 'dotenv/config';
import express from 'express';
import { corsMiddleware } from './middleware/cors.js';
import healthRouter from './routes/health.js';
import roomsRouter from './routes/rooms.js';

const app = express();
const PORT = Number(process.env.PORT) || 4000;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(corsMiddleware);
app.use(express.json());

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/health', healthRouter);
app.use('/api/rooms', roomsRouter);

// 404 catch-all
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀  Chess 3D backend running on http://localhost:${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/health`);
  console.log(`   Rooms:  http://localhost:${PORT}/api/rooms\n`);
});

export default app;
