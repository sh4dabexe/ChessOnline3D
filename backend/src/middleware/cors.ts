import cors from 'cors';
import 'dotenv/config';

const allowedOrigin = process.env.FRONTEND_ORIGIN || 'http://localhost:5173';

export const corsMiddleware = cors({
  origin: (origin, callback) => {
    // Dynamically allow any origin (very robust for development/previews)
    callback(null, true);
  },
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
});
