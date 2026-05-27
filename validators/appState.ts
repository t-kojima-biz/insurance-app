import type { PolicyType } from '@/types';

const VALID_POLICY_TYPES: PolicyType[] = [
  '個人年金保険', '収入保障保険', '変額終身保険', '医療保険', '終身保険', '養老保険',
];
const VALID_GENDERS = ['male', 'female'] as const;
const VALID_FREQUENCIES = ['monthly', 'annual', 'single'] as const;

interface ValidationError {
  field: string;
  message: string;
}

interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export function validateAppState(body: unknown): ValidationResult {
  const errors: ValidationError[] = [];

  if (!body || typeof body !== 'object') {
    return { valid: false, errors: [{ field: 'body', message: 'リクエストボディが不正です' }] };
  }

  const data = body as Record<string, unknown>;

  if (!Array.isArray(data.familyMembers) || data.familyMembers.length === 0) {
    errors.push({ field: 'familyMembers', message: 'familyMembers は 1 件以上の配列が必要です' });
  } else {
    for (let i = 0; i < data.familyMembers.length; i++) {
      const m = data.familyMembers[i] as Record<string, unknown>;
      if (!m || typeof m !== 'object') {
        errors.push({ field: `familyMembers[${i}]`, message: '家族情報が不正です' });
        continue;
      }
      if (typeof m.id !== 'string' || !m.id) errors.push({ field: `familyMembers[${i}].id`, message: 'id は必須です' });
      if (typeof m.name !== 'string') errors.push({ field: `familyMembers[${i}].name`, message: 'name は文字列が必要です' });
      if (m.nameKana !== undefined && typeof m.nameKana !== 'string') errors.push({ field: `familyMembers[${i}].nameKana`, message: 'nameKana は文字列が必要です' });
      if (typeof m.relationship !== 'string') errors.push({ field: `familyMembers[${i}].relationship`, message: 'relationship は文字列が必要です' });
      if (m.birthDate !== undefined && typeof m.birthDate !== 'string') errors.push({ field: `familyMembers[${i}].birthDate`, message: 'birthDate は文字列が必要です' });
      if (!VALID_GENDERS.includes(m.gender as typeof VALID_GENDERS[number])) {
        errors.push({ field: `familyMembers[${i}].gender`, message: 'gender は male または female が必要です' });
      }
    }
  }

  if (!data.agency || typeof data.agency !== 'object') {
    errors.push({ field: 'agency', message: 'agency はオブジェクトが必要です' });
  } else {
    const a = data.agency as Record<string, unknown>;
    if (typeof a.name !== 'string') errors.push({ field: 'agency.name', message: 'name は文字列が必要です' });
    if (typeof a.representative !== 'string') errors.push({ field: 'agency.representative', message: 'representative は文字列が必要です' });
    if (typeof a.phone !== 'string') errors.push({ field: 'agency.phone', message: 'phone は文字列が必要です' });
  }

  if (!Array.isArray(data.policies)) {
    errors.push({ field: 'policies', message: 'policies は配列が必要です' });
  } else {
    for (let i = 0; i < data.policies.length; i++) {
      const p = data.policies[i] as Record<string, unknown>;
      if (!p || typeof p !== 'object') {
        errors.push({ field: `policies[${i}]`, message: '保険証券が不正です' });
        continue;
      }
      if (typeof p.id !== 'string' || !p.id) errors.push({ field: `policies[${i}].id`, message: 'id は必須です' });
      if (typeof p.companyName !== 'string' || !p.companyName) errors.push({ field: `policies[${i}].companyName`, message: '保険会社は必須です' });
      if (!VALID_POLICY_TYPES.includes(p.policyType as PolicyType)) {
        errors.push({ field: `policies[${i}].policyType`, message: '保険種類が不正です' });
      }
      if (typeof p.contractDate !== 'string' || !p.contractDate) errors.push({ field: `policies[${i}].contractDate`, message: '契約日は必須です' });
      if (typeof p.contractAge !== 'number') errors.push({ field: `policies[${i}].contractAge`, message: '契約年齢は数値が必要です' });
      if (typeof p.insuredId !== 'string' || !p.insuredId) errors.push({ field: `policies[${i}].insuredId`, message: '被保険者は必須です' });
      if (typeof p.policyEndAge !== 'number') errors.push({ field: `policies[${i}].policyEndAge`, message: '保険期間は数値が必要です' });
      if (!VALID_FREQUENCIES.includes(p.paymentFrequency as typeof VALID_FREQUENCIES[number])) {
        errors.push({ field: `policies[${i}].paymentFrequency`, message: '払方は monthly, annual, single のいずれかが必要です' });
      }
      if (typeof p.premiumAmount !== 'number') errors.push({ field: `policies[${i}].premiumAmount`, message: '保険料は数値が必要です' });
      if (typeof p.paymentEndAge !== 'number') errors.push({ field: `policies[${i}].paymentEndAge`, message: '払込終了年齢は数値が必要です' });
    }
  }

  return { valid: errors.length === 0, errors };
}
