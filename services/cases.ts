import { v4 as uuidv4 } from 'uuid';
import { getDb } from '@/lib/db';

interface CaseSummary {
  id: string;
  title: string;
  primaryMemberName: string;
  primaryMemberNameKana: string;
  memberCount: number;
  policyCount: number;
  updatedAt: string | null;
}

export function listCases(): CaseSummary[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT
      c.id,
      c.title,
      c.updated_at,
      (SELECT fm.name FROM family_members fm WHERE fm.case_id = c.id AND fm.relationship = '本人' ORDER BY fm.sort_order LIMIT 1) AS primary_name,
      (SELECT fm.name_kana FROM family_members fm WHERE fm.case_id = c.id AND fm.relationship = '本人' ORDER BY fm.sort_order LIMIT 1) AS primary_name_kana,
      (SELECT COUNT(*) FROM family_members fm WHERE fm.case_id = c.id) AS member_count,
      (SELECT COUNT(*) FROM policies p WHERE p.case_id = c.id) AS policy_count
    FROM cases c
    ORDER BY c.updated_at DESC
  `).all() as { id: string; title: string; updated_at: string; primary_name: string | null; primary_name_kana: string | null; member_count: number; policy_count: number }[];

  return rows.map(r => ({
    id: r.id,
    title: r.title,
    primaryMemberName: r.primary_name ?? '',
    primaryMemberNameKana: r.primary_name_kana ?? '',
    memberCount: r.member_count,
    policyCount: r.policy_count,
    updatedAt: r.updated_at,
  }));
}

export function createCase(): CaseSummary {
  const db = getDb();
  const caseId = uuidv4();
  const ts = new Date().toISOString();
  const memberId = uuidv4();

  db.transaction(() => {
    db.prepare('INSERT INTO cases (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)').run(caseId, '新規お客様', ts, ts);

    db.prepare('INSERT INTO family_members (id, case_id, name, name_kana, relationship, birth_date, gender, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
      memberId, caseId, '', '', '本人', new Date().toISOString().split('T')[0], 'male', 0, ts, ts,
    );

    db.prepare('INSERT INTO agencies (id, case_id, name, representative, phone, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
      uuidv4(), caseId, '', '', '', ts, ts,
    );

    db.prepare('INSERT INTO app_state_meta (case_id, schema_version, updated_at) VALUES (?, 1, ?)').run(caseId, ts);
  })();

  return {
    id: caseId,
    title: '新規お客様',
    primaryMemberName: '',
    primaryMemberNameKana: '',
    memberCount: 1,
    policyCount: 0,
    updatedAt: ts,
  };
}

export function deleteCase(caseId: string): boolean {
  const db = getDb();
  return db.transaction(() => {
    const existing = db.prepare('SELECT id FROM cases WHERE id = ?').get(caseId);
    if (!existing) return false;

    db.prepare('DELETE FROM policies WHERE case_id = ?').run(caseId);
    db.prepare('DELETE FROM portfolio_insights WHERE case_id = ?').run(caseId);
    db.prepare('DELETE FROM agencies WHERE case_id = ?').run(caseId);
    db.prepare('DELETE FROM app_state_meta WHERE case_id = ?').run(caseId);
    db.prepare('DELETE FROM family_members WHERE case_id = ?').run(caseId);
    db.prepare('DELETE FROM cases WHERE id = ?').run(caseId);

    return true;
  })();
}
