import { Router } from 'express';
import { getDb } from '../db.js';

const router = Router();

router.get('/api/health', (_req, res) => {
  let dbStatus = 'error';
  try {
    const db = getDb();
    const row = db.prepare('SELECT 1 AS ok').get() as { ok: number } | undefined;
    if (row?.ok === 1) dbStatus = 'ok';
  } catch {
    // db connection failed
  }

  res.json({ status: 'ok', database: dbStatus });
});

export default router;
