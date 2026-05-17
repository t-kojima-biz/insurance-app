import { Router } from 'express';
import type { Request, Response } from 'express';
import { getAppState, initFromSample, saveAppState, resetToSample, clearData, updateExportTimestamp } from '../services/appState.js';
import { validateAppState } from '../validators/appState.js';

const router = Router();

function getCaseId(req: Request): string {
  return (req.query.caseId as string) || 'default';
}

router.get('/api/app-state', (req: Request, res: Response) => {
  try {
    const caseId = getCaseId(req);
    const state = getAppState(caseId);
    if (!state) {
      res.status(404).json({ error: '案件が見つかりません' });
      return;
    }
    res.json(state);
  } catch (err) {
    console.error('[GET /api/app-state]', err);
    res.status(500).json({ error: 'データの取得に失敗しました' });
  }
});

router.put('/api/app-state', (req: Request, res: Response) => {
  try {
    const contentType = req.headers['content-type'];
    if (!contentType || !contentType.includes('application/json')) {
      res.status(415).json({ error: 'Content-Type は application/json が必要です' });
      return;
    }

    const { valid, errors } = validateAppState(req.body);
    if (!valid) {
      res.status(400).json({ errors });
      return;
    }

    const caseId = getCaseId(req);
    const saved = saveAppState(caseId, req.body);
    res.json(saved);
  } catch (err) {
    console.error('[PUT /api/app-state]', err);
    res.status(500).json({ error: '保存に失敗しました' });
  }
});

router.post('/api/app-state/reset', (req: Request, res: Response) => {
  try {
    const caseId = getCaseId(req);
    const state = resetToSample(caseId);
    res.json(state);
  } catch (err) {
    console.error('[POST /api/app-state/reset]', err);
    res.status(500).json({ error: 'リセットに失敗しました' });
  }
});

router.post('/api/app-state/clear', (req: Request, res: Response) => {
  try {
    const caseId = getCaseId(req);
    const state = clearData(caseId);
    res.json(state);
  } catch (err) {
    console.error('[POST /api/app-state/clear]', err);
    res.status(500).json({ error: 'データ消去に失敗しました' });
  }
});

router.get('/api/app-state/export', (req: Request, res: Response) => {
  try {
    const caseId = getCaseId(req);
    const state = getAppState(caseId);
    if (!state) {
      res.status(404).json({ error: '案件が見つかりません' });
      return;
    }

    updateExportTimestamp(caseId);

    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const ts = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const filename = `insurance-app-state-${ts}.json`;

    const exportData = {
      schemaVersion: 1,
      exportedAt: now.toISOString(),
      ...state,
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.json(exportData);
  } catch (err) {
    console.error('[GET /api/app-state/export]', err);
    res.status(500).json({ error: 'JSON 出力に失敗しました' });
  }
});

export default router;
