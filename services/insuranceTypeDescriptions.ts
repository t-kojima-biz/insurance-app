import { getDb } from '@/lib/db';
import { INSURANCE_TYPE_INFO } from '@/utils/analysisUtils';
import type { PolicyType } from '@/types';

export interface InsuranceTypeDescription {
  policyType: PolicyType;
  longDescription: string;
  purpose: string;
}

export function listDescriptions(): InsuranceTypeDescription[] {
  const db = getDb();
  const rows = db.prepare('SELECT policy_type, long_description, purpose FROM insurance_type_descriptions').all() as {
    policy_type: string; long_description: string; purpose: string;
  }[];

  const saved = new Map(rows.map(r => [r.policy_type, { longDescription: r.long_description, purpose: r.purpose }]));

  return (Object.keys(INSURANCE_TYPE_INFO) as PolicyType[]).map(type => ({
    policyType: type,
    longDescription: saved.get(type)?.longDescription ?? INSURANCE_TYPE_INFO[type].longDescription,
    purpose: saved.get(type)?.purpose ?? INSURANCE_TYPE_INFO[type].purpose,
  }));
}

export function updateDescription(policyType: PolicyType, longDescription: string, purpose: string): InsuranceTypeDescription {
  const db = getDb();
  const ts = new Date().toISOString();
  db.prepare(
    `INSERT INTO insurance_type_descriptions (policy_type, long_description, purpose, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(policy_type) DO UPDATE SET long_description = excluded.long_description, purpose = excluded.purpose, updated_at = excluded.updated_at`
  ).run(policyType, longDescription, purpose, ts);

  return { policyType, longDescription, purpose };
}
