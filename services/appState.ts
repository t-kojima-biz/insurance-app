import { v4 as uuidv4 } from 'uuid';
import { getDb } from '@/lib/db';
import { getSampleFamilyMembers, getSampleAgency, getSamplePolicies } from '@/data/sampleData';
import type { AppState, FamilyMember, Policy, Agency } from '@/types';

interface FamilyMemberRow {
  id: string;
  case_id: string;
  name: string;
  name_kana: string;
  relationship: string;
  birth_date: string;
  gender: string;
  sort_order: number;
}

interface PolicyRow {
  id: string;
  case_id: string;
  company_name: string;
  policy_type: string;
  policy_number: string | null;
  contract_date: string;
  contract_age: number;
  insured_member_id: string;
  beneficiary_member_id: string | null;
  death_benefit_disease: number;
  death_benefit_accident: number;
  hosp_day_disease: number;
  hosp_day_accident: number;
  diagnosis_benefit: number;
  policy_end_age: number;
  payment_frequency: string;
  premium_amount: number;
  payment_end_date: string | null;
  payment_end_age: number;
  annual_premium: number;
  maturity_benefit: number;
  consultant_note: string | null;
  sort_order: number;
}

interface AgencyRow {
  id: string;
  case_id: string;
  name: string;
  representative: string;
  phone: string;
}

interface MetaRow {
  updated_at: string;
  schema_version: number;
}

function rowToFamilyMember(row: FamilyMemberRow): FamilyMember {
  return {
    id: row.id,
    name: row.name,
    nameKana: row.name_kana,
    relationship: row.relationship,
    birthDate: row.birth_date,
    gender: row.gender as 'male' | 'female',
  };
}

function rowToPolicy(row: PolicyRow): Policy {
  return {
    id: row.id,
    companyName: row.company_name,
    policyType: row.policy_type as Policy['policyType'],
    policyNumber: row.policy_number ?? '',
    contractDate: row.contract_date,
    contractAge: row.contract_age,
    insuredId: row.insured_member_id,
    beneficiaryId: row.beneficiary_member_id ?? '',
    deathBenefitDisease: row.death_benefit_disease,
    deathBenefitAccident: row.death_benefit_accident,
    hospDayDisease: row.hosp_day_disease,
    hospDayAccident: row.hosp_day_accident,
    diagnosisBenefit: row.diagnosis_benefit,
    policyEndAge: row.policy_end_age,
    paymentFrequency: row.payment_frequency as Policy['paymentFrequency'],
    premiumAmount: row.premium_amount,
    paymentEndAge: row.payment_end_age,
    annualPremium: row.annual_premium,
    maturityBenefit: row.maturity_benefit,
    consultantNote: row.consultant_note ?? undefined,
  };
}

function rowToAgency(row: AgencyRow): Agency {
  return { name: row.name, representative: row.representative, phone: row.phone };
}

function now(): string {
  return new Date().toISOString();
}

function insertSampleData(caseId: string): void {
  const db = getDb();
  const ts = now();

  db.prepare('INSERT OR REPLACE INTO cases (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)').run(caseId, 'default', ts, ts);

  const agency = getSampleAgency();
  const agencyId = uuidv4();
  db.prepare('INSERT INTO agencies (id, case_id, name, representative, phone, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(agencyId, caseId, agency.name, agency.representative, agency.phone, ts, ts);

  const members = getSampleFamilyMembers();
  const memberIdMap = new Map(members.map(member => [member.id, uuidv4()]));
  const insertMember = db.prepare('INSERT INTO family_members (id, case_id, name, name_kana, relationship, birth_date, gender, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  for (let i = 0; i < members.length; i++) {
    const m = members[i];
    insertMember.run(memberIdMap.get(m.id), caseId, m.name, m.nameKana, m.relationship, m.birthDate, m.gender, i, ts, ts);
  }

  const policies = getSamplePolicies();
  const insertPolicy = db.prepare(`INSERT INTO policies (id, case_id, company_name, policy_type, policy_number, contract_date, contract_age, insured_member_id, beneficiary_member_id, death_benefit_disease, death_benefit_accident, hosp_day_disease, hosp_day_accident, diagnosis_benefit, policy_end_age, payment_frequency, premium_amount, payment_end_date, payment_end_age, annual_premium, maturity_benefit, consultant_note, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  for (let i = 0; i < policies.length; i++) {
    const p = policies[i];
    insertPolicy.run(
      uuidv4(),
      caseId,
      p.companyName,
      p.policyType,
      p.policyNumber || null,
      p.contractDate,
      p.contractAge,
      memberIdMap.get(p.insuredId) || p.insuredId,
      p.beneficiaryId ? memberIdMap.get(p.beneficiaryId) || p.beneficiaryId : null,
      p.deathBenefitDisease,
      p.deathBenefitAccident,
      p.hospDayDisease,
      p.hospDayAccident,
      p.diagnosisBenefit,
      p.policyEndAge,
      p.paymentFrequency,
      p.premiumAmount,
      null,
      p.paymentEndAge,
      p.annualPremium,
      p.maturityBenefit,
      p.consultantNote ?? null,
      i,
      ts,
      ts,
    );
  }

  db.prepare('INSERT OR REPLACE INTO app_state_meta (case_id, schema_version, updated_at) VALUES (?, 1, ?)').run(caseId, ts);
}

export function getAppState(caseId: string): AppState | null {
  const db = getDb();

  const caseRow = db.prepare('SELECT id FROM cases WHERE id = ?').get(caseId) as { id: string } | undefined;
  if (!caseRow) return null;

  const memberRows = db.prepare('SELECT * FROM family_members WHERE case_id = ? ORDER BY sort_order').all(caseId) as FamilyMemberRow[];
  const policyRows = db.prepare('SELECT * FROM policies WHERE case_id = ? ORDER BY sort_order').all(caseId) as PolicyRow[];
  const agencyRow = db.prepare('SELECT * FROM agencies WHERE case_id = ?').get(caseId) as AgencyRow | undefined;
  const metaRow = db.prepare('SELECT updated_at FROM app_state_meta WHERE case_id = ?').get(caseId) as MetaRow | undefined;

  return {
    familyMembers: memberRows.map(rowToFamilyMember),
    policies: policyRows.map(rowToPolicy),
    agency: agencyRow ? rowToAgency(agencyRow) : { name: '', representative: '', phone: '' },
    updatedAt: metaRow?.updated_at ?? undefined,
  };
}

export function initFromSample(caseId: string): AppState {
  const db = getDb();
  db.transaction(() => insertSampleData(caseId))();
  return getAppState(caseId)!;
}

export function saveAppState(caseId: string, state: AppState): AppState {
  const db = getDb();
  const ts = now();

  db.transaction(() => {
    db.prepare('INSERT OR IGNORE INTO cases (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)').run(caseId, 'default', ts, ts);
    db.prepare('UPDATE cases SET updated_at = ? WHERE id = ?').run(ts, caseId);

    db.prepare('DELETE FROM policies WHERE case_id = ?').run(caseId);
    db.prepare('DELETE FROM family_members WHERE case_id = ?').run(caseId);

    const insertMember = db.prepare('INSERT INTO family_members (id, case_id, name, name_kana, relationship, birth_date, gender, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    for (let i = 0; i < state.familyMembers.length; i++) {
      const m = state.familyMembers[i];
      insertMember.run(m.id, caseId, m.name, m.nameKana ?? '', m.relationship, m.birthDate, m.gender, i, ts, ts);
    }

    const existingAgency = db.prepare('SELECT id FROM agencies WHERE case_id = ?').get(caseId) as { id: string } | undefined;
    if (existingAgency) {
      db.prepare('UPDATE agencies SET name = ?, representative = ?, phone = ?, updated_at = ? WHERE case_id = ?').run(state.agency.name, state.agency.representative, state.agency.phone, ts, caseId);
    } else {
      db.prepare('INSERT INTO agencies (id, case_id, name, representative, phone, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(uuidv4(), caseId, state.agency.name, state.agency.representative, state.agency.phone, ts, ts);
    }

    const insertPolicy = db.prepare(`INSERT INTO policies (id, case_id, company_name, policy_type, policy_number, contract_date, contract_age, insured_member_id, beneficiary_member_id, death_benefit_disease, death_benefit_accident, hosp_day_disease, hosp_day_accident, diagnosis_benefit, policy_end_age, payment_frequency, premium_amount, payment_end_date, payment_end_age, annual_premium, maturity_benefit, consultant_note, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    for (let i = 0; i < state.policies.length; i++) {
      const p = state.policies[i];
      insertPolicy.run(p.id, caseId, p.companyName, p.policyType, p.policyNumber || null, p.contractDate, p.contractAge, p.insuredId, p.beneficiaryId || null, p.deathBenefitDisease, p.deathBenefitAccident, p.hospDayDisease, p.hospDayAccident, p.diagnosisBenefit, p.policyEndAge, p.paymentFrequency, p.premiumAmount, null, p.paymentEndAge, p.annualPremium, p.maturityBenefit, p.consultantNote ?? null, i, ts, ts);
    }

    db.prepare('INSERT OR REPLACE INTO app_state_meta (case_id, schema_version, updated_at) VALUES (?, 1, ?)').run(caseId, ts);
  })();

  return getAppState(caseId)!;
}

export function resetToSample(caseId: string): AppState {
  const db = getDb();
  db.transaction(() => {
    db.prepare('DELETE FROM policies WHERE case_id = ?').run(caseId);
    db.prepare('DELETE FROM family_members WHERE case_id = ?').run(caseId);
    db.prepare('DELETE FROM agencies WHERE case_id = ?').run(caseId);
    db.prepare('DELETE FROM app_state_meta WHERE case_id = ?').run(caseId);
    db.prepare('DELETE FROM cases WHERE id = ?').run(caseId);
    insertSampleData(caseId);
  })();
  return getAppState(caseId)!;
}

export function clearData(caseId: string): AppState {
  const db = getDb();
  const ts = now();

  db.transaction(() => {
    db.prepare('INSERT OR IGNORE INTO cases (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)').run(caseId, 'default', ts, ts);

    db.prepare('DELETE FROM policies WHERE case_id = ?').run(caseId);
    db.prepare('DELETE FROM family_members WHERE case_id = ?').run(caseId);

    const defaultMemberId = uuidv4();
    db.prepare('INSERT INTO family_members (id, case_id, name, name_kana, relationship, birth_date, gender, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(defaultMemberId, caseId, '', '', '本人', new Date().toISOString().split('T')[0], 'male', 0, ts, ts);

    const existingAgency = db.prepare('SELECT id FROM agencies WHERE case_id = ?').get(caseId) as { id: string } | undefined;
    if (!existingAgency) {
      const agency = getSampleAgency();
      db.prepare('INSERT INTO agencies (id, case_id, name, representative, phone, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(uuidv4(), caseId, agency.name, agency.representative, agency.phone, ts, ts);
    }

    db.prepare('INSERT OR REPLACE INTO app_state_meta (case_id, schema_version, updated_at) VALUES (?, 1, ?)').run(caseId, ts);
  })();

  return getAppState(caseId)!;
}

export function updateExportTimestamp(caseId: string): void {
  const db = getDb();
  db.prepare('UPDATE app_state_meta SET last_exported_at = ? WHERE case_id = ?').run(now(), caseId);
}
