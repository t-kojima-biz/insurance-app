import { v4 as uuidv4 } from 'uuid';
import { getDb } from '@/lib/db';
import type { AgencyMaster } from '@/types';

interface AgencyMasterRow {
  id: string;
  name: string;
  representative: string;
  phone: string;
}

function rowToAgencyMaster(row: AgencyMasterRow): AgencyMaster {
  return { id: row.id, name: row.name, representative: row.representative, phone: row.phone };
}

export function listAgencyMasters(): AgencyMaster[] {
  const db = getDb();
  const rows = db.prepare('SELECT id, name, representative, phone FROM agency_masters ORDER BY name').all() as AgencyMasterRow[];
  return rows.map(rowToAgencyMaster);
}

export function createAgencyMaster(data: Omit<AgencyMaster, 'id'>): AgencyMaster {
  const db = getDb();
  const id = uuidv4();
  const ts = new Date().toISOString();
  db.prepare('INSERT INTO agency_masters (id, name, representative, phone, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)').run(
    id, data.name, data.representative, data.phone, ts, ts,
  );
  return { id, ...data };
}

export function updateAgencyMaster(id: string, data: Omit<AgencyMaster, 'id'>): AgencyMaster | null {
  const db = getDb();
  const ts = new Date().toISOString();
  const result = db.prepare('UPDATE agency_masters SET name = ?, representative = ?, phone = ?, updated_at = ? WHERE id = ?').run(
    data.name, data.representative, data.phone, ts, id,
  );
  if (result.changes === 0) return null;
  return { id, ...data };
}

export function deleteAgencyMaster(id: string): boolean {
  const db = getDb();
  const result = db.prepare('DELETE FROM agency_masters WHERE id = ?').run(id);
  return result.changes > 0;
}
