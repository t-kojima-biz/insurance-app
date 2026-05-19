import { v4 as uuidv4 } from 'uuid';
import { getDb } from '@/lib/db';

export interface PortfolioInsightRow {
  id: string;
  type: 'gap' | 'redundancy' | 'recommendation';
  text: string;
  isCustom: boolean;
}

export function listInsights(caseId: string): PortfolioInsightRow[] {
  const db = getDb();
  const rows = db.prepare(
    'SELECT id, type, text, is_custom FROM portfolio_insights WHERE case_id = ? ORDER BY sort_order'
  ).all(caseId) as { id: string; type: string; text: string; is_custom: number }[];

  return rows.map(r => ({
    id: r.id,
    type: r.type as PortfolioInsightRow['type'],
    text: r.text,
    isCustom: r.is_custom === 1,
  }));
}

export function hasInsights(caseId: string): boolean {
  const db = getDb();
  const row = db.prepare('SELECT COUNT(*) as cnt FROM portfolio_insights WHERE case_id = ?').get(caseId) as { cnt: number };
  return row.cnt > 0;
}

export function saveInsights(caseId: string, insights: Omit<PortfolioInsightRow, 'id'>[]): PortfolioInsightRow[] {
  const db = getDb();
  const ts = new Date().toISOString();

  const result: PortfolioInsightRow[] = [];

  db.transaction(() => {
    db.prepare('DELETE FROM portfolio_insights WHERE case_id = ?').run(caseId);

    const stmt = db.prepare(
      'INSERT INTO portfolio_insights (id, case_id, type, text, is_custom, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    );

    insights.forEach((insight, i) => {
      const id = uuidv4();
      stmt.run(id, caseId, insight.type, insight.text, insight.isCustom ? 1 : 0, i, ts, ts);
      result.push({ id, type: insight.type, text: insight.text, isCustom: insight.isCustom });
    });
  })();

  return result;
}

export function deleteInsights(caseId: string): void {
  const db = getDb();
  db.prepare('DELETE FROM portfolio_insights WHERE case_id = ?').run(caseId);
}
