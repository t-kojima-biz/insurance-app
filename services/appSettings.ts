import { getDb } from '@/lib/db';

export const POLICY_PROMPT_SETTING_KEY = 'policy_import_prompt';

export interface AppSettingValue {
  value: string;
  updatedAt: string | null;
}

interface AppSettingRow {
  value: string;
  updated_at: string | null;
}

export function getSetting(key: string): AppSettingValue | null {
  const db = getDb();
  const row = db.prepare('SELECT value, updated_at FROM app_settings WHERE setting_key = ?').get(key) as AppSettingRow | undefined;
  if (!row) return null;
  return { value: row.value, updatedAt: row.updated_at };
}

export function saveSetting(key: string, value: string): AppSettingValue {
  const db = getDb();
  const ts = new Date().toISOString();
  db.prepare(
    `INSERT INTO app_settings (setting_key, value, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(setting_key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
  ).run(key, value, ts);

  return { value, updatedAt: ts };
}
