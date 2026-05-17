import { Router } from 'express';
import type { Request, Response } from 'express';
import multer from 'multer';
import { importCsv } from '../services/csvImport.js';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

router.post('/api/policies/import-csv', upload.single('file'), (req: Request, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'CSV ファイルが添付されていません' });
      return;
    }

    const caseId = (req.body?.caseId as string) || (req.query?.caseId as string) || 'default';
    const overwrite = req.body?.overwriteDuplicates === 'true' || req.query?.overwriteDuplicates === 'true';
    const result = importCsv(caseId, req.file.buffer, overwrite);

    if (result.code === 'DUPLICATE_POLICY_NUMBER') {
      res.status(409).json(result);
      return;
    }

    if (result.failedCount > 0 || (result.errors.length > 0 && !result.state)) {
      res.status(400).json(result);
      return;
    }

    res.json(result);
  } catch (err) {
    console.error('[POST /api/policies/import-csv]', err);
    res.status(500).json({ error: 'CSV 取り込みに失敗しました' });
  }
});

export default router;
