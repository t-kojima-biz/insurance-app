import { parse } from 'csv-parse/sync';
import iconv from 'iconv-lite';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '@/lib/db';
import { getAppState } from '@/services/appState';
import type { Policy, PolicyType, FamilyMember, AppState } from '@/types';

const VALID_POLICY_TYPES: PolicyType[] = [
  '個人年金保険', '収入保障保険', '変額終身保険', '医療保険', '終身保険', '養老保険',
];
const VALID_FREQUENCIES = ['monthly', 'annual', 'single'] as const;

const HEADER_MAP: Record<string, string> = {
  '保険会社': 'companyName',
  '保険種類': 'policyType',
  '証券番号': 'policyNumber',
  '契約日': 'contractDate',
  '契約年齢': 'contractAge',
  '被保険者': 'insuredName',
  '被保険者名': 'insuredName',
  '受取人': 'beneficiaryName',
  '受取人名': 'beneficiaryName',
  '死亡保障疾病': 'deathBenefitDisease',
  '死亡保障災害': 'deathBenefitAccident',
  '入院日額疾病': 'hospDayDisease',
  '入院日額災害': 'hospDayAccident',
  '診断一時金': 'diagnosisBenefit',
  '保険期間': 'policyEndAge',
  '払方': 'paymentFrequency',
  '保険料': 'premiumAmount',
  '払込終了年月日': 'paymentEndDate',
  '払込終了年齢': 'paymentEndAge',
  '満期保険金': 'maturityBenefit',
  'コンサルタントメモ': 'consultantNote',
  'フリガナ': 'nameKana',
  'カナ': 'nameKana',
  '氏名カナ': 'nameKana',
};

interface CsvRow {
  companyName?: string;
  policyType?: string;
  policyNumber?: string;
  contractDate?: string;
  contractAge?: string;
  insuredName?: string;
  beneficiaryName?: string;
  deathBenefitDisease?: string;
  deathBenefitAccident?: string;
  hospDayDisease?: string;
  hospDayAccident?: string;
  diagnosisBenefit?: string;
  policyEndAge?: string;
  paymentFrequency?: string;
  premiumAmount?: string;
  paymentEndDate?: string;
  paymentEndAge?: string;
  maturityBenefit?: string;
  consultantNote?: string;
}

interface RowError {
  row: number;
  message: string;
}

interface DuplicateInfo {
  row: number;
  policyNumber: string;
  existingPolicyId: string;
}

interface ParsedPolicy {
  policy: Omit<Policy, 'id'> & { id: string };
  paymentEndDate: string | null;
}

function detectEncoding(buffer: Buffer): string {
  if (buffer.length >= 3 && buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
    return 'utf-8';
  }

  let isValidUtf8 = true;
  for (let i = 0; i < buffer.length; i++) {
    const b = buffer[i];
    if (b < 0x80) continue;
    let remaining: number;
    if ((b & 0xE0) === 0xC0) remaining = 1;
    else if ((b & 0xF0) === 0xE0) remaining = 2;
    else if ((b & 0xF8) === 0xF0) remaining = 3;
    else { isValidUtf8 = false; break; }
    for (let j = 0; j < remaining; j++) {
      i++;
      if (i >= buffer.length || (buffer[i] & 0xC0) !== 0x80) {
        isValidUtf8 = false; break;
      }
    }
    if (!isValidUtf8) break;
  }

  return isValidUtf8 ? 'utf-8' : 'cp932';
}

function normalizeHeaders(records: Record<string, string>[]): Record<string, string>[] {
  if (records.length === 0) return records;
  const firstRow = records[0];
  const keys = Object.keys(firstRow);

  const needsMapping = keys.some(k => HEADER_MAP[k] !== undefined);
  if (!needsMapping) return records;

  return records.map(row => {
    const mapped: Record<string, string> = {};
    for (const [key, value] of Object.entries(row)) {
      const mappedKey = HEADER_MAP[key] ?? key;
      mapped[mappedKey] = value;
    }
    return mapped;
  });
}

function calcAge(birthDate: string, targetDate: string): number {
  const birth = new Date(birthDate);
  const target = new Date(targetDate);
  let age = target.getFullYear() - birth.getFullYear();
  const monthDiff = target.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && target.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

function parseIntOrDefault(value: string | undefined, defaultValue: number): number {
  if (!value || value.trim() === '') return defaultValue;
  const cleaned = value.replace(/,/g, '');
  const n = parseInt(cleaned, 10);
  return isNaN(n) ? defaultValue : n;
}

function calcAnnualPremium(premiumAmount: number, frequency: string): number {
  if (frequency === 'monthly') return premiumAmount * 12;
  if (frequency === 'annual') return premiumAmount;
  if (frequency === 'single') return 0;
  return 0;
}

export interface ImportResult {
  importedCount: number;
  failedCount: number;
  errors: RowError[];
  state?: AppState;
  code?: string;
  message?: string;
  duplicates?: DuplicateInfo[];
}

export function importCsv(
  caseId: string,
  fileBuffer: Buffer,
  overwriteDuplicates: boolean,
): ImportResult {
  const encoding = detectEncoding(fileBuffer);
  const csvText = encoding === 'utf-8'
    ? fileBuffer.toString('utf-8').replace(/^﻿/, '')
    : iconv.decode(fileBuffer, encoding);

  let records: Record<string, string>[];
  try {
    records = parse(csvText, {
      columns: true,
      skip_empty_lines: true,
      bom: true,
      trim: true,
    });
  } catch {
    return { importedCount: 0, failedCount: 0, errors: [{ row: 0, message: 'CSV の解析に失敗しました' }] };
  }

  if (records.length === 0) {
    return { importedCount: 0, failedCount: 0, errors: [{ row: 0, message: 'CSV にデータ行がありません' }] };
  }

  records = normalizeHeaders(records);

  const db = getDb();
  const memberRows = db.prepare('SELECT id, name FROM family_members WHERE case_id = ?').all(caseId) as { id: string; name: string }[];
  const memberByName = new Map<string, FamilyMember['id']>();
  for (const m of memberRows) {
    memberByName.set(m.name, m.id);
  }

  const existingPolicies = db.prepare('SELECT id, policy_number FROM policies WHERE case_id = ?').all(caseId) as { id: string; policy_number: string | null }[];
  const existingByNumber = new Map<string, string>();
  for (const p of existingPolicies) {
    if (p.policy_number && p.policy_number.trim() !== '') {
      existingByNumber.set(p.policy_number, p.id);
    }
  }

  const errors: RowError[] = [];
  const parsed: ParsedPolicy[] = [];
  const duplicates: DuplicateInfo[] = [];

  for (let i = 0; i < records.length; i++) {
    const row = records[i] as CsvRow;
    const rowNum = i + 2;

    if (row.companyName?.startsWith('※') || row.policyType?.startsWith('※')) {
      continue;
    }

    if (!row.companyName?.trim()) {
      errors.push({ row: rowNum, message: '保険会社は必須です' });
      continue;
    }
    if (!row.policyType?.trim() || !VALID_POLICY_TYPES.includes(row.policyType.trim() as PolicyType)) {
      errors.push({ row: rowNum, message: '保険種類が不正です' });
      continue;
    }
    if (!row.contractDate?.trim()) {
      errors.push({ row: rowNum, message: '契約日は必須です' });
      continue;
    }
    if (!row.insuredName?.trim()) {
      errors.push({ row: rowNum, message: '被保険者名は必須です' });
      continue;
    }

    const insuredId = memberByName.get(row.insuredName.trim());
    if (!insuredId) {
      errors.push({ row: rowNum, message: `被保険者「${row.insuredName.trim()}」が家族情報に存在しません` });
      continue;
    }

    let beneficiaryId = '';
    if (row.beneficiaryName?.trim()) {
      const bid = memberByName.get(row.beneficiaryName.trim());
      if (!bid) {
        errors.push({ row: rowNum, message: `受取人「${row.beneficiaryName.trim()}」が家族情報に存在しません` });
        continue;
      }
      beneficiaryId = bid;
    }

    if (!row.policyEndAge?.trim()) {
      errors.push({ row: rowNum, message: '保険期間は必須です' });
      continue;
    }
    if (!row.paymentFrequency?.trim() || !VALID_FREQUENCIES.includes(row.paymentFrequency.trim() as typeof VALID_FREQUENCIES[number])) {
      errors.push({ row: rowNum, message: '払方は monthly, annual, single のいずれかが必要です' });
      continue;
    }
    if (!row.premiumAmount?.trim()) {
      errors.push({ row: rowNum, message: '保険料は必須です' });
      continue;
    }
    if (!row.paymentEndDate?.trim() && !row.paymentEndAge?.trim()) {
      errors.push({ row: rowNum, message: '払込終了年月日または払込終了年齢は必須です' });
      continue;
    }

    const insuredBirthRow = db.prepare('SELECT birth_date FROM family_members WHERE id = ?').get(insuredId) as { birth_date: string } | undefined;
    const insuredBirthDate = insuredBirthRow?.birth_date ?? '';

    const hasBirthDate = Boolean(insuredBirthDate && !isNaN(new Date(insuredBirthDate).getTime()));

    let contractAge = parseIntOrDefault(row.contractAge, -1);
    if (contractAge < 0 && hasBirthDate && row.contractDate?.trim()) {
      contractAge = calcAge(insuredBirthDate, row.contractDate.trim());
    }
    if (contractAge < 0) contractAge = 0;

    let paymentEndAge = parseIntOrDefault(row.paymentEndAge, -1);
    if (paymentEndAge < 0 && hasBirthDate && row.paymentEndDate?.trim()) {
      paymentEndAge = calcAge(insuredBirthDate, row.paymentEndDate.trim());
    }
    if (paymentEndAge < 0) paymentEndAge = 0;

    const premiumAmount = parseIntOrDefault(row.premiumAmount, 0);
    const freq = row.paymentFrequency!.trim() as Policy['paymentFrequency'];

    const policyNumber = row.policyNumber?.trim() ?? '';
    if (policyNumber && existingByNumber.has(policyNumber)) {
      duplicates.push({
        row: rowNum,
        policyNumber,
        existingPolicyId: existingByNumber.get(policyNumber)!,
      });
    }

    parsed.push({
      policy: {
        id: uuidv4(),
        companyName: row.companyName!.trim(),
        policyType: row.policyType!.trim() as PolicyType,
        policyNumber,
        contractDate: row.contractDate!.trim(),
        contractAge,
        insuredId,
        beneficiaryId,
        deathBenefitDisease: parseIntOrDefault(row.deathBenefitDisease, 0),
        deathBenefitAccident: parseIntOrDefault(row.deathBenefitAccident, 0),
        hospDayDisease: parseIntOrDefault(row.hospDayDisease, 0),
        hospDayAccident: parseIntOrDefault(row.hospDayAccident, 0),
        diagnosisBenefit: parseIntOrDefault(row.diagnosisBenefit, 0),
        policyEndAge: parseIntOrDefault(row.policyEndAge, 0),
        paymentFrequency: freq,
        premiumAmount,
        paymentEndAge,
        annualPremium: calcAnnualPremium(premiumAmount, freq),
        maturityBenefit: parseIntOrDefault(row.maturityBenefit, 0),
        consultantNote: row.consultantNote?.trim() || undefined,
      },
      paymentEndDate: row.paymentEndDate?.trim() || null,
    });
  }

  if (errors.length > 0) {
    return {
      importedCount: 0,
      failedCount: errors.length,
      errors,
    };
  }

  if (duplicates.length > 0 && !overwriteDuplicates) {
    return {
      importedCount: 0,
      failedCount: 0,
      errors: [],
      code: 'DUPLICATE_POLICY_NUMBER',
      message: '同じ証券番号の保険証券があります。上書きしますか？',
      duplicates,
    };
  }

  const ts = new Date().toISOString();
  const maxSortRow = db.prepare('SELECT COALESCE(MAX(sort_order), -1) AS max_sort FROM policies WHERE case_id = ?').get(caseId) as { max_sort: number };
  let nextSort = maxSortRow.max_sort + 1;

  const duplicateIds = new Set(duplicates.map(d => d.existingPolicyId));

  db.transaction(() => {
    if (overwriteDuplicates && duplicateIds.size > 0) {
      const deleteStmt = db.prepare('DELETE FROM policies WHERE id = ?');
      for (const id of duplicateIds) {
        deleteStmt.run(id);
      }
    }

    const insertPolicy = db.prepare(`INSERT INTO policies (id, case_id, company_name, policy_type, policy_number, contract_date, contract_age, insured_member_id, beneficiary_member_id, death_benefit_disease, death_benefit_accident, hosp_day_disease, hosp_day_accident, diagnosis_benefit, policy_end_age, payment_frequency, premium_amount, payment_end_date, payment_end_age, annual_premium, maturity_benefit, consultant_note, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

    for (const { policy, paymentEndDate } of parsed) {
      insertPolicy.run(
        policy.id, caseId, policy.companyName, policy.policyType,
        policy.policyNumber || null, policy.contractDate, policy.contractAge,
        policy.insuredId, policy.beneficiaryId || null,
        policy.deathBenefitDisease, policy.deathBenefitAccident,
        policy.hospDayDisease, policy.hospDayAccident,
        policy.diagnosisBenefit, policy.policyEndAge,
        policy.paymentFrequency, policy.premiumAmount,
        paymentEndDate, policy.paymentEndAge,
        policy.annualPremium, policy.maturityBenefit,
        policy.consultantNote ?? null, nextSort, ts, ts,
      );
      nextSort++;
    }

    db.prepare('INSERT OR REPLACE INTO app_state_meta (case_id, schema_version, updated_at) VALUES (?, 1, ?)').run(caseId, ts);
  })();

  return {
    importedCount: parsed.length,
    failedCount: 0,
    errors: [],
    state: getAppState(caseId)!,
  };
}
