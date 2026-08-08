import cors from 'cors';
import 'dotenv/config';

const allowedOrigin = process.env.FRONTEND_ORIGIN || 'http://localhost:5173';

export const corsMiddleware = cors({
  origin: [allowedOrigin, 'http://localhost:5173', 'http://127.0.0.1:5173'],
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
});
