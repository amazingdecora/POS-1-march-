import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';

import { pool } from './lib/pool';
import { runMigrations } from './db/migrate';
import { requireAdmin } from './middleware/auth';
import { authRouter } from './routes/auth';
import { workshopRouter } from './routes/workshop';
import { adminRouter } from './routes/admin';

dotenv.config();

const app = express();
const port = process.env.PORT ?? 4000;

app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN ?? '*'
}));
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'connected' });
  } catch (err) {
    console.error('Healthcheck DB error', err);
    res.status(200).json({ status: 'ok', db: 'disconnected' });
  }
});

app.use('/api/auth', authRouter);
app.use('/api/workshop', workshopRouter);
app.use('/api/admin', requireAdmin, adminRouter);

async function start (): Promise<void> {
  try {
    await runMigrations();
  } catch (e) {
    console.error('Migration/seed failed (is DATABASE_URL set?):', e);
  }
  app.listen(Number(port), '0.0.0.0', () => {
    console.log(`API server listening on port ${port}`);
  });
}

void start();
