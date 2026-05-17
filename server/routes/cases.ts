import { Router } from 'express';
import type { Request, Response } from 'express';
import { listCases, createCase, deleteCase } from '../services/cases.js';

const router = Router();

router.get('/api/cases', (_req: Request, res: Response) => {
  try {
    const cases = listCases();
    res.json(cases);
  } catch (err) {
    console.error('[GET /api/cases]', err);
    res.status(500).json({ error: '案件一覧の取得に失敗しました' });
  }
});

router.post('/api/cases', (_req: Request, res: Response) => {
  try {
    const newCase = createCase();
    res.status(201).json(newCase);
  } catch (err) {
    console.error('[POST /api/cases]', err);
    res.status(500).json({ error: '案件の作成に失敗しました' });
  }
});

router.delete('/api/cases/:id', (req: Request, res: Response) => {
  try {
    const deleted = deleteCase(req.params.id);
    if (!deleted) {
      res.status(404).json({ error: '案件が見つかりません' });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('[DELETE /api/cases/:id]', err);
    res.status(500).json({ error: '案件の削除に失敗しました' });
  }
});

export default router;
