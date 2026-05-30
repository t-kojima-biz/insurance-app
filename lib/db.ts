import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const isServerless = process.env.VERCEL || process.env.LAMBDA_TASK_ROOT || process.env.AWS_LAMBDA_FUNCTION_NAME;

const DEFAULT_DB_PATH = isServerless 
  ? resolve('/tmp', 'insurance.sqlite')
  : resolve(process.cwd(), 'data', 'insurance.sqlite');

const DATABASE_PATH = process.env.DATABASE_PATH 
  ? resolve(process.env.DATABASE_PATH)
  : DEFAULT_DB_PATH;

let db: Database.Database | null = null;

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}

export function getDb(): Database.Database {
  if (db) return db;

  const dbDir = dirname(DATABASE_PATH);
  try {
    mkdirSync(dbDir, { recursive: true });
  } catch (err) {
    console.error(`Failed to create database directory: ${dbDir}`, err);
    throw err;
  }

  try {
    db = new Database(DATABASE_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');

    runMigrations(db);
    return db;
  } catch (err) {
    console.error(`Failed to open database at ${DATABASE_PATH}`, err);
    throw err;
  }
}

function runMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS cases (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS agencies (
      id TEXT PRIMARY KEY,
      case_id TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      representative TEXT NOT NULL,
      phone TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS family_members (
      id TEXT PRIMARY KEY,
      case_id TEXT NOT NULL,
      name TEXT NOT NULL,
      name_kana TEXT NOT NULL DEFAULT '',
      relationship TEXT NOT NULL,
      birth_date TEXT NOT NULL DEFAULT '',
      gender TEXT NOT NULL CHECK (gender IN ('male', 'female')),
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS policies (
      id TEXT PRIMARY KEY,
      case_id TEXT NOT NULL,
      company_name TEXT NOT NULL,
      policy_type TEXT NOT NULL,
      policy_number TEXT,
      contract_date TEXT NOT NULL,
      contract_age INTEGER NOT NULL,
      insured_member_id TEXT NOT NULL,
      beneficiary_member_id TEXT,
      death_benefit_disease INTEGER NOT NULL DEFAULT 0,
      death_benefit_accident INTEGER NOT NULL DEFAULT 0,
      hosp_day_disease INTEGER NOT NULL DEFAULT 0,
      hosp_day_accident INTEGER NOT NULL DEFAULT 0,
      diagnosis_benefit INTEGER NOT NULL DEFAULT 0,
      policy_end_age INTEGER NOT NULL,
      payment_frequency TEXT NOT NULL CHECK (payment_frequency IN ('monthly', 'annual', 'single')),
      premium_amount INTEGER NOT NULL DEFAULT 0,
      payment_end_date TEXT,
      payment_end_age INTEGER NOT NULL,
      annual_premium INTEGER NOT NULL DEFAULT 0,
      maturity_benefit INTEGER NOT NULL DEFAULT 0,
      consultant_note TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE,
      FOREIGN KEY (insured_member_id) REFERENCES family_members(id) ON DELETE RESTRICT,
      FOREIGN KEY (beneficiary_member_id) REFERENCES family_members(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS app_state_meta (
      case_id TEXT PRIMARY KEY,
      schema_version INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_exported_at TEXT,
      FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS agency_masters (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      representative TEXT NOT NULL,
      phone TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS insurance_type_descriptions (
      policy_type TEXT PRIMARY KEY,
      long_description TEXT NOT NULL,
      purpose TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS portfolio_insights (
      id TEXT PRIMARY KEY,
      case_id TEXT NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('gap', 'redundancy', 'recommendation')),
      text TEXT NOT NULL,
      is_custom INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      setting_key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_portfolio_insights_case_id
      ON portfolio_insights(case_id, sort_order);

    CREATE INDEX IF NOT EXISTS idx_family_members_case_id_sort_order
      ON family_members(case_id, sort_order);

    CREATE INDEX IF NOT EXISTS idx_policies_case_id_sort_order
      ON policies(case_id, sort_order);

    CREATE INDEX IF NOT EXISTS idx_policies_case_id_policy_number
      ON policies(case_id, policy_number);

    CREATE INDEX IF NOT EXISTS idx_policies_insured_member_id
      ON policies(insured_member_id);

    CREATE INDEX IF NOT EXISTS idx_policies_beneficiary_member_id
      ON policies(beneficiary_member_id);
  `);

  try {
    db.exec(`ALTER TABLE family_members ADD COLUMN name_kana TEXT NOT NULL DEFAULT ''`);
  } catch {
    // column already exists
  }
}
