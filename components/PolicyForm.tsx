'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { Policy, PolicyType, FamilyMember } from '@/types';
import { AlertTriangle, CheckCircle, Clipboard, FileUp, ListChecks, Upload, X } from 'lucide-react';
import { mergeRelationshipSuggestions } from '@/utils/relationshipOptions';

interface PolicyFormProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (policy: Policy) => void;
  onImportPolicies?: (policies: Policy[], members: FamilyMember[], label: string) => void;
  onAddFamilyMember?: (member: FamilyMember) => void;
  familyMembers: FamilyMember[];
  existingPolicies?: Policy[];
  editingPolicy: Policy | null;
  onCancel: () => void;
}

interface UnresolvedNameRef {
  draftId: string;
  field: 'insured' | 'beneficiary';
}

interface UnresolvedName {
  field: 'insured' | 'beneficiary';
  label: string;
  originalName: string;
  mode: 'new' | 'existing' | 'skip';
  selectedMemberId: string;
  relationship: string;
  birthDate: string;
  gender: FamilyMember['gender'];
  refs?: UnresolvedNameRef[];
}

type DuplicateAction = 'overwrite' | 'new' | 'skip';

interface ImportDraft {
  id: string;
  sourceIndex: number;
  data: Partial<Policy>;
  insuredId: string;
  beneficiaryId: string;
  linkBeneficiaryToInsured: boolean;
  insuredName: string;
  beneficiaryName: string;
  warnings: string[];
  duplicatePolicyId?: string;
  duplicateAction: DuplicateAction;
}

const formatComma = (n: number) => n ? n.toLocaleString() : '';

const normalizePersonName = (name: unknown) => {
  let n = String(name || '');
  n = n.replace(/(様|殿|くん|ちゃん|様方)$/, '');
  n = n.replace(/[（\(].*?[\)）]/g, '');
  n = n.replace(/[・．.、,]/g, '');
  n = n.replace(/\s+/g, '');
  return n.trim();
};

const hasSearchableName = (member: FamilyMember) =>
  Boolean(normalizePersonName(member.name) || normalizePersonName(member.nameKana));

const isEmptyFamilyPlaceholder = (member: FamilyMember) => !hasSearchableName(member);

const formatFamilyOptionLabel = (member: FamilyMember) => {
  const relationship = member.relationship || '続柄未入力';
  const name = member.name || '氏名未入力';
  return `${relationship}: ${name}`;
};

const getDefaultFamilyMemberId = (members: FamilyMember[]) =>
  members.find(hasSearchableName)?.id || '';

const GEMINI_POLICY_PROMPT = `保険証券の画像を読み取り、以下のJSON形式だけで出力してください。
説明文やMarkdownは不要です。読めない項目は "" または 0 にしてください。
金額は円単位の整数、日付は YYYY-MM-DD 形式にしてください。
複数の証券がある場合は、同じ形式のオブジェクトを配列で出力してください。
受取人が「被保険者と同じ」「同上」「本人」などの場合は "同上" としてください。

{
  "保険会社": "",
  "保険種類": "",
  "証券番号": "",
  "契約日": "",
  "契約年齢": 0,
  "被保険者": "",
  "受取人": "",
  "死亡保障疾病": 0,
  "死亡保障災害": 0,
  "入院日額疾病": 0,
  "入院日額災害": 0,
  "診断一時金": 0,
  "保険期間": "",
  "払方": "",
  "保険料": 0,
  "払込終了年齢": 0,
  "満期保険金": 0,
  "コンサルタントメモ": ""
}`;

const createUnresolvedName = (
  field: UnresolvedName['field'],
  label: string,
  originalName: unknown,
  refs?: UnresolvedNameRef[],
): UnresolvedName => ({
  field,
  label,
  originalName: String(originalName || '').trim(),
  mode: 'new',
  selectedMemberId: '',
  relationship: '',
  birthDate: '',
  gender: field === 'insured' ? 'male' : 'female',
  refs,
});

const getUnresolvedNameError = (item: UnresolvedName): string => {
  if (item.mode === 'new') {
    if (!item.originalName.replace(/様$/, '').trim()) return '名前を確認してください。';
    if (!item.relationship.trim()) return '続柄を入力してください。';
  }
  if (item.mode === 'existing' && !item.selectedMemberId) {
    return '既存の家族を選択してください。';
  }
  return '';
};

const CommaInput: React.FC<{
  value: number;
  onChange: (n: number) => void;
  label: string;
}> = ({ value, onChange, label }) => {
  const [display, setDisplay] = useState(formatComma(value));

  useEffect(() => {
    setDisplay(formatComma(value));
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^\d]/g, '');
    if (raw === '') {
      setDisplay('');
      onChange(0);
    } else {
      const num = Number(raw);
      setDisplay(num.toLocaleString());
      onChange(num);
    }
  };

  return (
    <div className="form-group">
      <label>{label}</label>
      <input
        type="text"
        inputMode="numeric"
        value={display}
        onChange={handleChange}
        onFocus={() => setDisplay(formatComma(value))}
      />
    </div>
  );
};

const CommaInputRaw: React.FC<{
  value: number;
  onChange: (n: number) => void;
  placeholder?: string;
}> = ({ value, onChange, placeholder }) => {
  const [display, setDisplay] = useState(formatComma(value));

  useEffect(() => {
    setDisplay(formatComma(value));
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^\d]/g, '');
    if (raw === '') {
      setDisplay('');
      onChange(0);
    } else {
      const num = Number(raw);
      setDisplay(num.toLocaleString());
      onChange(num);
    }
  };

  return (
    <input
      type="text"
      inputMode="numeric"
      value={display}
      onChange={handleChange}
      onFocus={() => setDisplay(formatComma(value))}
      placeholder={placeholder}
    />
  );
};

const PolicyForm: React.FC<PolicyFormProps> = ({
  isOpen,
  onClose,
  onAdd,
  onImportPolicies,
  onAddFamilyMember,
  familyMembers,
  existingPolicies = [],
  editingPolicy,
  onCancel,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previousOpenRef = useRef(false);
  const previousEditingPolicyIdRef = useRef<string | null>(null);
  const [showPasteArea, setShowPasteArea] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [importDrafts, setImportDrafts] = useState<ImportDraft[]>([]);
  const [pendingImportMembers, setPendingImportMembers] = useState<FamilyMember[]>([]);
  const [promptCopied, setPromptCopied] = useState(false);
  
  // マッチング未解決の名前管理
  const [unresolvedNames, setUnresolvedNames] = useState<UnresolvedName[]>([]);
  const [linkBeneficiaryToInsured, setLinkBeneficiaryToInsured] = useState(false);
  const allVisibleMembers = useMemo(
    () => [...pendingImportMembers, ...familyMembers],
    [familyMembers, pendingImportMembers],
  );
  const relationshipSuggestions = useMemo(
    () => mergeRelationshipSuggestions(allVisibleMembers.map(member => member.relationship)),
    [allVisibleMembers],
  );
  const namedFamilyMembers = useMemo(
    () => allVisibleMembers.filter(hasSearchableName),
    [allVisibleMembers],
  );
  const unresolvedNameErrors = useMemo(
    () => unresolvedNames.map(getUnresolvedNameError),
    [unresolvedNames],
  );
  const hasUnresolvedNameErrors = unresolvedNameErrors.some(Boolean);

  const [formData, setFormData] = useState<Partial<Policy>>({
    companyName: '',
    policyType: '終身保険',
    policyNumber: '',
    contractDate: new Date().toISOString().split('T')[0],
    contractAge: 30,
    insuredId: getDefaultFamilyMemberId(familyMembers),
    beneficiaryId: getDefaultFamilyMemberId(familyMembers),
    deathBenefitDisease: 0,
    deathBenefitAccident: 0,
    hospDayDisease: 0,
    hospDayAccident: 0,
    diagnosisBenefit: 0,
    policyEndAge: 999,
    paymentFrequency: 'monthly',
    premiumAmount: 0,
    paymentEndAge: 60,
    maturityBenefit: 0,
  });

  useEffect(() => {
    const wasOpen = previousOpenRef.current;
    const previousEditingPolicyId = previousEditingPolicyIdRef.current;
    const currentEditingPolicyId = editingPolicy?.id ?? null;
    const shouldInitialize = isOpen && (!wasOpen || previousEditingPolicyId !== currentEditingPolicyId);

    previousOpenRef.current = isOpen;
    previousEditingPolicyIdRef.current = currentEditingPolicyId;

    if (!shouldInitialize) return;

    if (editingPolicy) {
      setFormData(editingPolicy);
    } else {
      setFormData({
        companyName: '',
        policyType: '終身保険',
        policyNumber: '',
        contractDate: new Date().toISOString().split('T')[0],
        contractAge: 30,
        insuredId: getDefaultFamilyMemberId(familyMembers),
        beneficiaryId: getDefaultFamilyMemberId(familyMembers),
        deathBenefitDisease: 0,
        deathBenefitAccident: 0,
        hospDayDisease: 0,
        hospDayAccident: 0,
        diagnosisBenefit: 0,
        policyEndAge: 999,
        paymentFrequency: 'monthly',
        premiumAmount: 0,
        paymentEndAge: 60,
        maturityBenefit: 0,
      });
    }
    setShowPasteArea(false);
    setPasteText('');
    setImportDrafts([]);
    setPendingImportMembers([]);
    setUnresolvedNames([]);
    setLinkBeneficiaryToInsured(false);
    setPromptCopied(false);
  }, [editingPolicy, familyMembers, isOpen]);

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const processJsonData = (rawJson: any) => {
    const keyMap: Record<string, string> = {
      '保険会社': 'companyName',
      '保険会社名': 'companyName',
      '保険種類': 'policyType',
      '証券番号': 'policyNumber',
      '契約日': 'contractDate',
      '契約年齢': 'contractAge',
      '被保険者': 'insuredName',
      '被保険者名': 'insuredName',
      '保険対象者': 'insuredName',
      '受取人': 'beneficiaryName',
      '受取人名': 'beneficiaryName',
      '保険金受取人': 'beneficiaryName',
      '死亡保障疾病': 'deathBenefitDisease',
      '死亡保障（疾病）': 'deathBenefitDisease',
      '死亡保障災害': 'deathBenefitAccident',
      '死亡保障（災害）': 'deathBenefitAccident',
      '入院日額疾病': 'hospDayDisease',
      '入院日額（疾病）': 'hospDayDisease',
      '入院日額災害': 'hospDayAccident',
      '入院日額（災害）': 'hospDayAccident',
      '診断一時金': 'diagnosisBenefit',
      '保険期間': 'policyEndAge',
      '払方': 'paymentFrequency',
      '払込方法': 'paymentFrequency',
      '保険料': 'premiumAmount',
      '払込終了年齢': 'paymentEndAge',
      '満期保険金': 'maturityBenefit',
      'コンサルタントメモ': 'consultantNote',
    };

    const json: any = {};
    for (const [k, v] of Object.entries(rawJson)) {
      const trimmedKey = k.trim();
      const mappedKey = keyMap[trimmedKey] || trimmedKey;
      json[mappedKey] = v;
    }

    const cleanData: Partial<Policy> = {};

    if (json.companyName) cleanData.companyName = String(json.companyName).replace(/様$/, '').trim();
    if (json.policyNumber) cleanData.policyNumber = String(json.policyNumber).trim();
    
    if (json.policyType) {
      const type = String(json.policyType);
      if (type.includes('終身')) cleanData.policyType = '終身保険';
      else if (type.includes('医療')) cleanData.policyType = '医療保険';
      else if (type.includes('年金')) cleanData.policyType = '個人年金保険';
      else if (type.includes('収入保障')) cleanData.policyType = '収入保障保険';
      else if (type.includes('変額')) cleanData.policyType = '変額終身保険';
      else if (type.includes('養老')) cleanData.policyType = '養老保険';
    }

    if (json.contractDate) {
      const d = String(json.contractDate);
      const stdMatch = d.match(/(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
      if (stdMatch) {
        cleanData.contractDate = `${stdMatch[1]}-${stdMatch[2].padStart(2, '0')}-${stdMatch[3].padStart(2, '0')}`;
      } else {
        const japaneseDateMatch = d.match(/(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})/);
        if (japaneseDateMatch) {
          cleanData.contractDate = `${japaneseDateMatch[1]}-${japaneseDateMatch[2].padStart(2, '0')}-${japaneseDateMatch[3].padStart(2, '0')}`;
        } else {
          const yearMatch = d.match(/(\d{4})/);
          const mdMatch = d.match(/(\d{1,2})\s*月\s*(\d{1,2})/);
          if (yearMatch && mdMatch) {
            cleanData.contractDate = `${yearMatch[1]}-${mdMatch[1].padStart(2, '0')}-${mdMatch[2].padStart(2, '0')}`;
          }
        }
      }
    }

    const parseNum = (v: any) => {
      if (typeof v === 'number') return v;
      if (!v) return 0;
      const cleaned = String(v).replace(/,/g, '').match(/\d+/);
      return cleaned ? parseInt(cleaned[0], 10) : 0;
    };

    if (json.contractAge) cleanData.contractAge = parseNum(json.contractAge);
    if (json.deathBenefitDisease) cleanData.deathBenefitDisease = parseNum(json.deathBenefitDisease);
    if (json.deathBenefitAccident) cleanData.deathBenefitAccident = parseNum(json.deathBenefitAccident);
    if (json.hospDayDisease) cleanData.hospDayDisease = parseNum(json.hospDayDisease);
    if (json.hospDayAccident) cleanData.hospDayAccident = parseNum(json.hospDayAccident);
    if (json.diagnosisBenefit) cleanData.diagnosisBenefit = parseNum(json.diagnosisBenefit);
    if (json.premiumAmount) cleanData.premiumAmount = parseNum(json.premiumAmount);
    if (json.paymentEndAge) cleanData.paymentEndAge = parseNum(json.paymentEndAge);
    if (json.maturityBenefit) cleanData.maturityBenefit = parseNum(json.maturityBenefit);

    if (json.policyEndAge) {
      if (String(json.policyEndAge).includes('終身')) {
        cleanData.policyEndAge = 999;
      } else {
        cleanData.policyEndAge = parseNum(json.policyEndAge);
      }
    }

    if (json.paymentFrequency) {
      const f = String(json.paymentFrequency);
      if (f.includes('一時')) cleanData.paymentFrequency = 'single';
      else if (f.includes('年')) cleanData.paymentFrequency = 'annual';
      else if (f.includes('月')) cleanData.paymentFrequency = 'monthly';
    }

    // 空の初期家族行は名前一致に使わない。
    const memberCandidates = familyMembers
      .map(member => ({
        id: member.id,
        name: normalizePersonName(member.name),
        kana: normalizePersonName(member.nameKana),
      }))
      .filter(member => member.name || member.kana);

    const findExistingMemberId = (memberId: unknown) => {
      if (typeof memberId !== 'string' || !memberId) return null;
      return familyMembers.some(member => member.id === memberId) ? memberId : null;
    };

    const findMemberId = (nameStr: unknown) => {
      if (!nameStr) return null;
      const target = normalizePersonName(nameStr);
      if (!target) return null;

      const exactMatch = memberCandidates.find(member => member.name === target);
      if (exactMatch) return exactMatch.id;

      const kanaMatch = memberCandidates.find(member => member.kana === target);
      if (kanaMatch) return kanaMatch.id;

      const partialMatch = memberCandidates.find(member => {
        return (
          (member.name && (member.name.includes(target) || target.includes(member.name))) ||
          (member.kana && (member.kana.includes(target) || target.includes(member.kana)))
        );
      });

      return partialMatch ? partialMatch.id : null;
    };

    // 解析と未解決名の抽出
    const hasInsuredInput = Boolean(json.insuredId || json.insuredName);
    const hasBeneficiaryInput = Boolean(json.beneficiaryId || json.beneficiaryName);
    let insuredId = findExistingMemberId(json.insuredId) || findMemberId(json.insuredName);
    const unresolved: UnresolvedName[] = [];
    const initialPlaceholder = memberCandidates.length === 0
      ? familyMembers.find(isEmptyFamilyPlaceholder)
      : undefined;
    
    if (!insuredId && json.insuredName) {
      const item = createUnresolvedName('insured', '被保険者', json.insuredName);
      item.relationship = initialPlaceholder?.relationship || '本人';
      unresolved.push(item);
    }

    let beneficiaryId = findExistingMemberId(json.beneficiaryId);
    const bName = String(json.beneficiaryName || '').trim();
    const beneficiaryIsSameAsInsured = Boolean(bName && normalizePersonName(bName) === normalizePersonName(json.insuredName || ''));
    const shouldLinkBeneficiaryToInsured = Boolean(
      bName.match(/^(本人|被保険者|同上|被保険者と同じ|左記に同じ)$/) || beneficiaryIsSameAsInsured
    );

    if (shouldLinkBeneficiaryToInsured) {
      beneficiaryId = insuredId;
    } else {
      beneficiaryId = beneficiaryId || findMemberId(bName);
      if (!beneficiaryId && bName) {
        unresolved.push(createUnresolvedName('beneficiary', '受取人', bName));
      }
    }

    setFormData(prev => ({
      ...prev,
      ...cleanData,
      insuredId: hasInsuredInput ? (insuredId || '') : prev.insuredId,
      beneficiaryId: hasBeneficiaryInput ? (beneficiaryId || '') : prev.beneficiaryId,
    }));
    setLinkBeneficiaryToInsured(shouldLinkBeneficiaryToInsured);

    if (unresolved.length > 0) {
      setUnresolvedNames(unresolved);
    } else {
      setUnresolvedNames([]);
    }
  };

  const normalizeRawPolicyJson = (rawJson: any) => {
    const keyMap: Record<string, string> = {
      '保険会社': 'companyName',
      '保険会社名': 'companyName',
      '保険種類': 'policyType',
      '証券番号': 'policyNumber',
      '契約日': 'contractDate',
      '契約年齢': 'contractAge',
      '被保険者': 'insuredName',
      '被保険者名': 'insuredName',
      '保険対象者': 'insuredName',
      '受取人': 'beneficiaryName',
      '受取人名': 'beneficiaryName',
      '保険金受取人': 'beneficiaryName',
      '死亡保障疾病': 'deathBenefitDisease',
      '死亡保障（疾病）': 'deathBenefitDisease',
      '死亡保障災害': 'deathBenefitAccident',
      '死亡保障（災害）': 'deathBenefitAccident',
      '入院日額疾病': 'hospDayDisease',
      '入院日額（疾病）': 'hospDayDisease',
      '入院日額災害': 'hospDayAccident',
      '入院日額（災害）': 'hospDayAccident',
      '診断一時金': 'diagnosisBenefit',
      '保険期間': 'policyEndAge',
      '払方': 'paymentFrequency',
      '払込方法': 'paymentFrequency',
      '保険料': 'premiumAmount',
      '払込終了年齢': 'paymentEndAge',
      '満期保険金': 'maturityBenefit',
      'コンサルタントメモ': 'consultantNote',
    };

    const json: Record<string, any> = {};
    for (const [k, v] of Object.entries(rawJson || {})) {
      const trimmedKey = k.trim();
      const mappedKey = keyMap[trimmedKey] || trimmedKey;
      json[mappedKey] = v;
    }
    return json;
  };

  const parseImportNum = (v: any) => {
    if (typeof v === 'number') return v;
    if (!v) return 0;
    const text = String(v).replace(/,/g, '');
    const manMatch = text.match(/([\d.]+)\s*万/);
    if (manMatch) return Math.round(Number(manMatch[1]) * 10000);
    const cleaned = text.match(/\d+/);
    return cleaned ? parseInt(cleaned[0], 10) : 0;
  };

  const parseImportDate = (v: any) => {
    if (!v) return '';
    const d = String(v);
    const stdMatch = d.match(/(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
    if (stdMatch) return `${stdMatch[1]}-${stdMatch[2].padStart(2, '0')}-${stdMatch[3].padStart(2, '0')}`;
    const japaneseDateMatch = d.match(/(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})/);
    if (japaneseDateMatch) return `${japaneseDateMatch[1]}-${japaneseDateMatch[2].padStart(2, '0')}-${japaneseDateMatch[3].padStart(2, '0')}`;
    return '';
  };

  const parseImportPolicyType = (v: any): PolicyType => {
    const type = String(v || '');
    if (type.includes('医療')) return '医療保険';
    if (type.includes('年金')) return '個人年金保険';
    if (type.includes('収入保障')) return '収入保障保険';
    if (type.includes('変額')) return '変額終身保険';
    if (type.includes('養老')) return '養老保険';
    return '終身保険';
  };

  const parseImportFrequency = (v: any): Policy['paymentFrequency'] => {
    const f = String(v || '');
    if (f.includes('一時')) return 'single';
    if (f.includes('年')) return 'annual';
    return 'monthly';
  };

  const extractImportRecords = (parsed: any): any[] => {
    if (Array.isArray(parsed)) return parsed;
    if (Array.isArray(parsed?.policies)) return parsed.policies;
    if (Array.isArray(parsed?.['保険証券'])) return parsed['保険証券'];
    if (Array.isArray(parsed?.['証券'])) return parsed['証券'];
    if (Array.isArray(parsed?.items)) return parsed.items;
    if (Array.isArray(parsed?.data)) return parsed.data;
    return parsed && typeof parsed === 'object' ? [parsed] : [];
  };

  const findMemberIdByName = (members: FamilyMember[], nameStr: unknown) => {
    const target = normalizePersonName(nameStr);
    if (!target) return '';

    const candidates = members
      .map(member => ({
        id: member.id,
        name: normalizePersonName(member.name),
        kana: normalizePersonName(member.nameKana),
      }))
      .filter(member => member.name || member.kana);

    const exactMatch = candidates.find(member => member.name === target || member.kana === target);
    if (exactMatch) return exactMatch.id;

    const partialMatch = candidates.find(member => (
      (member.name && (member.name.includes(target) || target.includes(member.name))) ||
      (member.kana && (member.kana.includes(target) || target.includes(member.kana)))
    ));
    return partialMatch?.id || '';
  };

  const addPreviewUnresolved = (
    map: Map<string, UnresolvedName>,
    draftId: string,
    field: UnresolvedName['field'],
    label: string,
    originalName: unknown,
  ) => {
    const name = String(originalName || '').trim();
    const key = normalizePersonName(name) || `${field}:${name}`;
    const ref = { draftId, field };
    const existing = map.get(key);
    if (existing) {
      existing.refs = [...(existing.refs || []), ref];
      if (!existing.label.includes(label)) existing.label = '被保険者/受取人';
      return;
    }

    const initialPlaceholder = familyMembers.some(hasSearchableName)
      ? undefined
      : familyMembers.find(isEmptyFamilyPlaceholder);
    const item = createUnresolvedName(field, label, name, [ref]);
    if (field === 'insured') item.relationship = initialPlaceholder?.relationship || '本人';
    map.set(key, item);
  };

  const buildImportDraft = (
    rawJson: any,
    sourceIndex: number,
    unresolvedMap: Map<string, UnresolvedName>,
  ): ImportDraft => {
    const json = normalizeRawPolicyJson(rawJson);
    const draftId = uuidv4();
    const data: Partial<Policy> = {
      companyName: json.companyName ? String(json.companyName).replace(/様$/, '').trim() : '',
      policyType: parseImportPolicyType(json.policyType),
      policyNumber: json.policyNumber ? String(json.policyNumber).trim() : '',
      contractDate: parseImportDate(json.contractDate),
      contractAge: parseImportNum(json.contractAge),
      deathBenefitDisease: parseImportNum(json.deathBenefitDisease),
      deathBenefitAccident: parseImportNum(json.deathBenefitAccident),
      hospDayDisease: parseImportNum(json.hospDayDisease),
      hospDayAccident: parseImportNum(json.hospDayAccident),
      diagnosisBenefit: parseImportNum(json.diagnosisBenefit),
      policyEndAge: String(json.policyEndAge || '').includes('終身') ? 999 : parseImportNum(json.policyEndAge),
      paymentFrequency: parseImportFrequency(json.paymentFrequency),
      premiumAmount: parseImportNum(json.premiumAmount),
      paymentEndAge: parseImportNum(json.paymentEndAge),
      maturityBenefit: parseImportNum(json.maturityBenefit),
      consultantNote: json.consultantNote ? String(json.consultantNote).trim() : undefined,
    };

    const existingMemberIds = new Set(familyMembers.map(member => member.id));
    const insuredName = String(json.insuredName || '').trim();
    const beneficiaryName = String(json.beneficiaryName || '').trim();
    let insuredId = typeof json.insuredId === 'string' && existingMemberIds.has(json.insuredId)
      ? json.insuredId
      : findMemberIdByName(familyMembers, insuredName);

    if (!insuredId && insuredName) {
      addPreviewUnresolved(unresolvedMap, draftId, 'insured', '被保険者', insuredName);
    }

    const beneficiaryIsSameAsInsured = Boolean(
      beneficiaryName && normalizePersonName(beneficiaryName) === normalizePersonName(insuredName),
    );
    const linkBeneficiaryToInsured = Boolean(
      beneficiaryName.match(/^(本人|被保険者|同上|被保険者と同じ|左記に同じ)$/) || beneficiaryIsSameAsInsured,
    );

    let beneficiaryId = typeof json.beneficiaryId === 'string' && existingMemberIds.has(json.beneficiaryId)
      ? json.beneficiaryId
      : '';
    if (linkBeneficiaryToInsured) {
      beneficiaryId = insuredId;
    } else {
      beneficiaryId = beneficiaryId || findMemberIdByName(familyMembers, beneficiaryName);
      if (!beneficiaryId && beneficiaryName) {
        addPreviewUnresolved(unresolvedMap, draftId, 'beneficiary', '受取人', beneficiaryName);
      }
    }

    const duplicate = data.policyNumber
      ? existingPolicies.find(policy => policy.policyNumber && policy.policyNumber === data.policyNumber)
      : undefined;
    const warnings: string[] = [];
    if (!data.companyName) warnings.push('保険会社が未入力です');
    if (!data.contractDate) warnings.push('契約日が未入力または判別できません');
    if (!insuredName && !insuredId) warnings.push('被保険者が未入力です');
    if (!data.premiumAmount) warnings.push('保険料が0円です');
    if (!data.policyEndAge) warnings.push('保険期間が未入力です');
    if (data.paymentEndAge && data.contractAge && data.paymentEndAge < data.contractAge) {
      warnings.push('払込終了年齢が契約年齢より若くなっています');
    }
    if (duplicate) warnings.push(`証券番号「${data.policyNumber}」は既存証券と重複しています`);

    return {
      id: draftId,
      sourceIndex,
      data,
      insuredId,
      beneficiaryId,
      linkBeneficiaryToInsured,
      insuredName,
      beneficiaryName,
      warnings,
      duplicatePolicyId: duplicate?.id,
      duplicateAction: duplicate ? 'overwrite' : 'new',
    };
  };

  const prepareJsonImport = (parsed: any) => {
    const records = extractImportRecords(parsed);
    if (records.length === 0) throw new Error('JSONに証券データがありません');

    const unresolvedMap = new Map<string, UnresolvedName>();
    const drafts = records.map((record, index) => buildImportDraft(record, index, unresolvedMap));
    setPendingImportMembers([]);
    setImportDrafts(drafts);
    setUnresolvedNames([...unresolvedMap.values()]);
    setLinkBeneficiaryToInsured(false);
    setFormErrors({});
  };

  const updateUnresolvedName = (index: number, changes: Partial<UnresolvedName>) => {
    setUnresolvedNames(prev => prev.map((item, i) => i === index ? { ...item, ...changes } : item));
  };

  const handleUnresolvedModeChange = (index: number, value: string) => {
    if (value.startsWith('existing:')) {
      updateUnresolvedName(index, {
        mode: 'existing',
        selectedMemberId: value.replace('existing:', ''),
      });
      return;
    }

    updateUnresolvedName(index, {
      mode: value as UnresolvedName['mode'],
      selectedMemberId: '',
    });
  };

  const applyUnresolvedNames = () => {
    if (hasUnresolvedNameErrors) return;

    const resolvedIds: Partial<Record<UnresolvedName['field'], string>> = {};
    const draftResolvedIds: Record<string, Partial<Record<UnresolvedName['field'], string>>> = {};
    const createdImportMembers: FamilyMember[] = [];
    const hasPreviewRefs = unresolvedNames.some(item => item.refs && item.refs.length > 0);
    const reusableInitialMemberId = familyMembers.some(hasSearchableName)
      ? null
      : familyMembers.find(isEmptyFamilyPlaceholder)?.id ?? null;
    let usedReusableInitialMember = false;

    for (const item of unresolvedNames) {
      let finalId = '';

      if (item.mode === 'existing') {
        finalId = item.selectedMemberId;
      } else if (item.mode === 'new') {
        const name = item.originalName.replace(/様$/, '').trim();
        const relationship = item.relationship.trim();

        if (!name || !relationship) {
          return;
        }

        const shouldReuseInitialMember =
          item.field === 'insured' && Boolean(reusableInitialMemberId) && !usedReusableInitialMember;
        const newMember: FamilyMember = {
          id: shouldReuseInitialMember ? reusableInitialMemberId! : uuidv4(),
          name,
          nameKana: '',
          relationship,
          birthDate: item.birthDate,
          gender: item.gender,
        };
        if (hasPreviewRefs) {
          createdImportMembers.push(newMember);
        } else {
          onAddFamilyMember?.(newMember);
        }
        if (shouldReuseInitialMember) usedReusableInitialMember = true;
        finalId = newMember.id;
      }

      if (finalId) {
        if (item.refs?.length) {
          for (const ref of item.refs) {
            draftResolvedIds[ref.draftId] = {
              ...(draftResolvedIds[ref.draftId] || {}),
              [ref.field]: finalId,
            };
          }
        } else {
          resolvedIds[item.field] = finalId;
          if (item.field === 'insured' && linkBeneficiaryToInsured) {
            resolvedIds.beneficiary = finalId;
          }
        }
      }
    }

    if (hasPreviewRefs) {
      if (createdImportMembers.length > 0) {
        setPendingImportMembers(prev => {
          const next = [...prev];
          for (const member of createdImportMembers) {
            const index = next.findIndex(existing => existing.id === member.id);
            if (index >= 0) next[index] = { ...next[index], ...member };
            else next.push(member);
          }
          return next;
        });
      }

      setImportDrafts(prev => prev.map(draft => {
        const resolved = draftResolvedIds[draft.id];
        if (!resolved) return draft;
        const insuredId = resolved.insured || draft.insuredId;
        return {
          ...draft,
          insuredId,
          beneficiaryId: resolved.beneficiary || (draft.linkBeneficiaryToInsured && resolved.insured ? resolved.insured : draft.beneficiaryId),
        };
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        insuredId: resolvedIds.insured || prev.insuredId,
        beneficiaryId: resolvedIds.beneficiary || prev.beneficiaryId,
      }));
    }
    setUnresolvedNames([]);
    setLinkBeneficiaryToInsured(false);
  };

  const skipUnresolvedNames = () => {
    setUnresolvedNames([]);
    setLinkBeneficiaryToInsured(false);
  };

  const handleJsonImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        prepareJsonImport(JSON.parse(content));
        e.target.value = '';
      } catch (err) {
        console.error('JSON Import Error:', err);
        alert('JSONの解析に失敗しました。形式を確認してください。');
      }
    };
    reader.readAsText(file);
  };

  const handlePasteImport = () => {
    try {
      if (!pasteText.trim()) return;
      prepareJsonImport(JSON.parse(pasteText));
    } catch (err) {
      alert('JSONの解析に失敗しました。正しいJSON形式で貼り付けてください。');
    }
  };

  const setField = (field: string, value: any) => setFormData(prev => ({ ...prev, [field]: value }));

  const setDraftDuplicateAction = (draftId: string, duplicateAction: DuplicateAction) => {
    setImportDrafts(prev => prev.map(draft => draft.id === draftId ? { ...draft, duplicateAction } : draft));
  };

  const getDraftBlockingIssues = (draft: ImportDraft): string[] => {
    const issues: string[] = [];
    if (!draft.data.companyName) issues.push('保険会社');
    if (!draft.data.contractDate) issues.push('契約日');
    if (!draft.insuredId) issues.push('被保険者');
    if (!draft.data.policyEndAge) issues.push('保険期間');
    if (!draft.data.paymentEndAge && draft.data.paymentFrequency !== 'single') issues.push('払込終了年齢');
    return issues;
  };

  const activeImportDrafts = importDrafts.filter(draft => draft.duplicateAction !== 'skip');
  const importBlockingDrafts = activeImportDrafts.filter(draft => getDraftBlockingIssues(draft).length > 0);
  const canImportDrafts = activeImportDrafts.length > 0 && importBlockingDrafts.length === 0;

  const buildPolicyFromDraft = (draft: ImportDraft): Policy => {
    const paymentFrequency = draft.data.paymentFrequency || 'monthly';
    const premiumAmount = draft.data.premiumAmount || 0;
    return {
      id: draft.duplicateAction === 'overwrite' && draft.duplicatePolicyId ? draft.duplicatePolicyId : uuidv4(),
      companyName: draft.data.companyName || '',
      policyType: draft.data.policyType || '終身保険',
      policyNumber: draft.data.policyNumber || '',
      contractDate: draft.data.contractDate || '',
      contractAge: draft.data.contractAge || 0,
      insuredId: draft.insuredId,
      beneficiaryId: draft.beneficiaryId || '',
      deathBenefitDisease: draft.data.deathBenefitDisease || 0,
      deathBenefitAccident: draft.data.deathBenefitAccident || 0,
      hospDayDisease: draft.data.hospDayDisease || 0,
      hospDayAccident: draft.data.hospDayAccident || 0,
      diagnosisBenefit: draft.data.diagnosisBenefit || 0,
      policyEndAge: draft.data.policyEndAge || 0,
      paymentFrequency,
      premiumAmount,
      paymentEndAge: draft.data.paymentEndAge || 0,
      annualPremium: paymentFrequency === 'monthly' ? premiumAmount * 12 : premiumAmount,
      maturityBenefit: draft.data.maturityBenefit || 0,
      consultantNote: draft.data.consultantNote,
    };
  };

  const clearImportPreview = () => {
    setImportDrafts([]);
    setPendingImportMembers([]);
    setUnresolvedNames([]);
    setPasteText('');
  };

  const applyFirstDraftToForm = () => {
    const draft = importDrafts[0];
    if (!draft) return;
    for (const member of pendingImportMembers) {
      onAddFamilyMember?.(member);
    }
    setFormData(prev => ({
      ...prev,
      ...draft.data,
      insuredId: draft.insuredId || '',
      beneficiaryId: draft.beneficiaryId || '',
    }));
    clearImportPreview();
    setShowPasteArea(false);
  };

  const importDraftsToList = () => {
    if (!canImportDrafts) return;
    const policiesToImport = activeImportDrafts.map(buildPolicyFromDraft);
    if (onImportPolicies) {
      onImportPolicies(policiesToImport, pendingImportMembers, `JSON取込 ${policiesToImport.length}件`);
    } else {
      policiesToImport.forEach(policy => onAdd(policy));
      pendingImportMembers.forEach(member => onAddFamilyMember?.(member));
    }
    clearImportPreview();
    handleClose();
  };

  const handleCopyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(GEMINI_POLICY_PROMPT);
      setPromptCopied(true);
      window.setTimeout(() => setPromptCopied(false), 1800);
    } catch {
      alert('プロンプトをコピーできませんでした。');
    }
  };

  const isPension = formData.policyType === '個人年金保険';

  const [calcTotal, setCalcTotal] = useState<number | null>(null);

  const handleCalcTotal = () => {
    const freqMult = formData.paymentFrequency === 'monthly' ? 12 : formData.paymentFrequency === 'annual' ? 1 : 0;
    const paymentYears = Math.max(0, (formData.paymentEndAge || 0) - (formData.contractAge || 0));
    const total = formData.paymentFrequency === 'single'
      ? (formData.premiumAmount || 0)
      : (formData.premiumAmount || 0) * freqMult * paymentYears;
    setCalcTotal(total);
  };

  const handleClose = () => {
    setFormErrors({});
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};
    const memberIds = new Set(familyMembers.map(member => member.id));
    if (!formData.companyName) errors.companyName = '保険会社は必須です';
    if (!formData.contractDate) errors.contractDate = '契約日は必須です';
    if (!formData.insuredId) errors.insuredId = '被保険者を選択してください';
    else if (!memberIds.has(formData.insuredId)) errors.insuredId = '被保険者が家族情報に存在しません';
    if (formData.beneficiaryId && !memberIds.has(formData.beneficiaryId)) errors.beneficiaryId = '受取人が家族情報に存在しません';
    if (formData.policyEndAge === undefined || isNaN(formData.policyEndAge)) errors.policyEndAge = '保険期間は数値が必要です';
    if (formData.paymentEndAge === undefined || isNaN(formData.paymentEndAge)) errors.paymentEndAge = '払込終了年齢は数値が必要です';

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    const finalPolicy: Policy = {
      ...(formData as Policy),
      id: formData.id || uuidv4(),
      annualPremium: (formData.paymentFrequency === 'monthly' ? (formData.premiumAmount || 0) * 12 : (formData.premiumAmount || 0)),
    };
    onAdd(finalPolicy);
    handleClose();
  };

  if (!isOpen) return null;

  return (
    <div className="form-overlay">
      <div className="form-container wide-form">
        <div className="modal-header">
          <div className="title-with-icon">
            <h3>{editingPolicy ? '保険証券の編集' : '保険証券の詳細登録'}</h3>
          </div>
          <div className="header-actions">
            <button type="button" className="json-import-btn-outline" onClick={handleCopyPrompt}>
              <Clipboard size={16} /> {promptCopied ? 'コピー済み' : 'Geminiプロンプト'}
            </button>
            <button type="button" className="json-import-btn-outline" onClick={() => setShowPasteArea(!showPasteArea)}>
              <Upload size={16} /> 貼り付け取込
            </button>
            <button type="button" className="json-import-btn-outline" onClick={() => fileInputRef.current?.click()}>
              <FileUp size={16} /> JSON取込
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              style={{ display: 'none' }}
              onChange={handleJsonImport}
            />
            <button type="button" className="close-btn" onClick={handleClose}><X size={20} /></button>
          </div>
        </div>

        {unresolvedNames.length > 0 && (
          <div className="resolve-wizard full-width">
            <div className="resolve-wizard-header">
              <Upload size={20} className="resolve-icon" />
              <h4>家族情報の確認が必要です</h4>
            </div>
            <p className="resolve-instruction">
              JSON内の名前が家族情報にありません。既存家族へ紐付けるか、続柄などを確認して新しい家族として追加してください。
            </p>
            <datalist id="policy-relationship-suggestions">
              {relationshipSuggestions.map(value => <option key={value} value={value} />)}
            </datalist>
            <div className="resolve-table-wrap">
              <table className="resolve-table">
                <thead>
                  <tr>
                    <th>JSON項目</th>
                    <th>名前</th>
                    <th>登録方法</th>
                    <th>続柄 <span className="resolve-th-hint">候補選択・直接入力</span></th>
                    <th>生年月日（任意）</th>
                    <th>性別</th>
                  </tr>
                </thead>
                <tbody>
                  {unresolvedNames.map((item, index) => {
                    const modeValue = item.mode === 'existing' ? `existing:${item.selectedMemberId}` : item.mode;
                    const isNew = item.mode === 'new';
                    const rowError = unresolvedNameErrors[index];
                    const errorId = `unresolved-name-error-${index}`;

                    return (
                      <tr key={`${item.field}-${item.originalName}-${index}`}>
                        <td>{item.label}</td>
                        <td><strong>{item.originalName}</strong></td>
                        <td>
                          <select
                            value={modeValue}
                            onChange={e => handleUnresolvedModeChange(index, e.target.value)}
                            className="resolve-select"
                            aria-invalid={Boolean(rowError && item.mode === 'existing')}
                            aria-describedby={rowError && item.mode === 'existing' ? errorId : undefined}
                          >
                            <option value="new">新しい家族として追加</option>
                            <option value="skip">手動で選ぶ</option>
                            {namedFamilyMembers.length > 0 && (
                              <optgroup label="既存の家族に紐付け">
                                {namedFamilyMembers.map(m => (
                                  <option key={m.id} value={`existing:${m.id}`}>{formatFamilyOptionLabel(m)}</option>
                                ))}
                              </optgroup>
                            )}
                          </select>
                          {rowError && item.mode === 'existing' && <span id={errorId} className="resolve-row-error">{rowError}</span>}
                        </td>
                        <td>
                          <input
                            type="text"
                            list="policy-relationship-suggestions"
                            value={item.relationship}
                            placeholder="例: 本人、長男など"
                            disabled={!isNew}
                            onChange={e => updateUnresolvedName(index, { relationship: e.target.value })}
                            className="resolve-input"
                            aria-invalid={Boolean(rowError && isNew)}
                            aria-describedby={rowError && isNew ? errorId : undefined}
                          />
                          {rowError && isNew && <span id={errorId} className="resolve-row-error">{rowError}</span>}
                        </td>
                        <td>
                          <input
                            type="date"
                            value={item.birthDate}
                            disabled={!isNew}
                            onChange={e => updateUnresolvedName(index, { birthDate: e.target.value })}
                            className="resolve-input"
                            aria-label={`${item.originalName}の生年月日`}
                          />
                        </td>
                        <td>
                          <select
                            value={item.gender}
                            disabled={!isNew}
                            onChange={e => updateUnresolvedName(index, { gender: e.target.value as FamilyMember['gender'] })}
                            className="resolve-select"
                          >
                            <option value="male">男</option>
                            <option value="female">女</option>
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="resolve-note">続柄は候補にない表記も直接入力できます。生年月日が不明な場合は空欄のまま追加し、あとで世帯・家族情報から入力できます。</p>
            </div>
            <div className="resolve-btn-group">
              <button type="button" className="resolve-btn-new" onClick={applyUnresolvedNames} disabled={hasUnresolvedNameErrors}>
                確認内容で追加して反映
              </button>
              <button type="button" className="resolve-btn-skip" onClick={skipUnresolvedNames}>
                すべて手動で選ぶ
              </button>
            </div>
          </div>
        )}

        {importDrafts.length > 0 && (
          <div className="json-import-preview full-width">
            <div className="json-import-preview-header">
              <div>
                <h4><ListChecks size={18} /> JSON取込プレビュー</h4>
                <p>{importDrafts.length}件の証券を読み取りました。内容を確認してから反映してください。</p>
              </div>
              <button type="button" className="json-paste-cancel-btn" onClick={clearImportPreview}>クリア</button>
            </div>

            {importBlockingDrafts.length > 0 && (
              <div className="json-import-alert">
                <AlertTriangle size={16} />
                <span>必須項目が不足している証券があります。被保険者の紐付けと項目を確認してください。</span>
              </div>
            )}

            <div className="json-import-preview-table-wrap">
              <table className="json-import-preview-table">
                <thead>
                  <tr>
                    <th>No.</th>
                    <th>保険会社</th>
                    <th>保険種類</th>
                    <th>証券番号</th>
                    <th>被保険者</th>
                    <th>受取人</th>
                    <th>保険料</th>
                    <th>確認</th>
                    <th>重複時</th>
                  </tr>
                </thead>
                <tbody>
                  {importDrafts.map((draft, index) => {
                    const insured = allVisibleMembers.find(member => member.id === draft.insuredId);
                    const beneficiary = allVisibleMembers.find(member => member.id === draft.beneficiaryId);
                    const blocking = getDraftBlockingIssues(draft);
                    const warningCount = draft.warnings.length + blocking.length;

                    return (
                      <tr key={draft.id} className={blocking.length > 0 ? 'json-import-row-blocked' : undefined}>
                        <td>{index + 1}</td>
                        <td>{draft.data.companyName || '-'}</td>
                        <td>{draft.data.policyType || '-'}</td>
                        <td>{draft.data.policyNumber || '-'}</td>
                        <td>{insured ? formatFamilyOptionLabel(insured) : (draft.insuredName || '未設定')}</td>
                        <td>{beneficiary ? formatFamilyOptionLabel(beneficiary) : (draft.beneficiaryName || '指定なし')}</td>
                        <td>{(draft.data.premiumAmount || 0).toLocaleString()}円</td>
                        <td>
                          {warningCount === 0 ? (
                            <span className="json-import-ok"><CheckCircle size={14} /> OK</span>
                          ) : (
                            <div className="json-import-warning-list">
                              {[...blocking.map(item => `${item}が必要です`), ...draft.warnings].map((warning, warningIndex) => (
                                <span key={`${draft.id}-warning-${warningIndex}`}>{warning}</span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td>
                          {draft.duplicatePolicyId ? (
                            <select
                              value={draft.duplicateAction}
                              onChange={e => setDraftDuplicateAction(draft.id, e.target.value as DuplicateAction)}
                              className="resolve-select"
                            >
                              <option value="overwrite">上書き</option>
                              <option value="new">別証券で追加</option>
                              <option value="skip">取込しない</option>
                            </select>
                          ) : (
                            <span className="json-import-muted">新規</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="json-import-preview-actions">
              <button type="button" className="json-paste-apply-btn" onClick={importDraftsToList} disabled={!canImportDrafts}>
                一覧に取り込む
              </button>
              {importDrafts.length === 1 && (
                <button type="button" className="json-paste-cancel-btn" onClick={applyFirstDraftToForm}>
                  フォームに反映
                </button>
              )}
            </div>
          </div>
        )}

        {showPasteArea && (
          <div className="json-paste-area full-width">
            <textarea
              placeholder="GeminiのJSON出力をここに貼り付けてください..."
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              rows={5}
              className="json-paste-textarea"
            />
            <div className="json-paste-actions">
              <button type="button" className="json-paste-apply-btn" onClick={handlePasteImport}>適用する</button>
              <button type="button" className="json-paste-cancel-btn" onClick={() => setShowPasteArea(false)}>閉じる</button>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="grid-form">
          <section>
            <h4>基本情報</h4>
            <div className={`form-group ${formErrors.companyName ? 'has-error' : ''}`}><label>保険会社 <span className="required-mark">*</span></label><input type="text" required value={formData.companyName} onChange={e => setField('companyName', e.target.value)} />{formErrors.companyName && <span className="field-error">{formErrors.companyName}</span>}</div>
            <div className="form-group"><label>証券番号</label><input type="text" value={formData.policyNumber} onChange={e => setField('policyNumber', e.target.value)} placeholder="例: 2709300566" /></div>
            <div className="form-group">
              <label>保険種類</label>
              <select value={formData.policyType} onChange={e => setField('policyType', e.target.value as PolicyType)}>
                <option value="終身保険">終身保険</option>
                <option value="収入保障保険">収入保障保険</option>
                <option value="医療保険">医療保険</option>
                <option value="個人年金保険">個人年金保険</option>
                <option value="変額終身保険">変額終身保険</option>
                <option value="養老保険">養老保険</option>
              </select>
            </div>
            <div className={`form-group ${formErrors.insuredId ? 'has-error' : ''}`}>
              <label>被保険者 <span className="required-mark">*</span></label>
              <select value={formData.insuredId || ''} onChange={e => setField('insuredId', e.target.value)}>
                <option value="">選択してください</option>
                {familyMembers.map(m => <option key={m.id} value={m.id}>{formatFamilyOptionLabel(m)}</option>)}
              </select>
              {formErrors.insuredId && <span className="field-error">{formErrors.insuredId}</span>}
            </div>
            <div className={`form-group ${formErrors.beneficiaryId ? 'has-error' : ''}`}>
              <label>保険金受取人</label>
              <select value={formData.beneficiaryId || ''} onChange={e => setField('beneficiaryId', e.target.value)}>
                <option value="">指定なし</option>
                {familyMembers.map(m => <option key={m.id} value={m.id}>{formatFamilyOptionLabel(m)}</option>)}
              </select>
              {formErrors.beneficiaryId && <span className="field-error">{formErrors.beneficiaryId}</span>}
            </div>
            <div className={`form-group ${formErrors.contractDate ? 'has-error' : ''}`}><label>契約日 <span className="required-mark">*</span></label><input type="date" value={formData.contractDate} onChange={e => setField('contractDate', e.target.value)} />{formErrors.contractDate && <span className="field-error">{formErrors.contractDate}</span>}</div>
          </section>

          <section>
            <h4>保障内容</h4>
            <CommaInput label="死亡保障（疾病）(円)" value={formData.deathBenefitDisease || 0} onChange={v => setField('deathBenefitDisease', v)} />
            <CommaInput label="死亡保障（災害）(円)" value={formData.deathBenefitAccident || 0} onChange={v => setField('deathBenefitAccident', v)} />
            <CommaInput label="入院日額（疾病）(円)" value={formData.hospDayDisease || 0} onChange={v => setField('hospDayDisease', v)} />
            <CommaInput label="入院日額（災害）(円)" value={formData.hospDayAccident || 0} onChange={v => setField('hospDayAccident', v)} />
            <CommaInput label="診断一時金 (円)" value={formData.diagnosisBenefit || 0} onChange={v => setField('diagnosisBenefit', v)} />
            <div className={`form-group ${formErrors.policyEndAge ? 'has-error' : ''}`}><label>保険期間（歳/999=終身）<span className="required-mark">*</span></label><input type="number" value={formData.policyEndAge} onChange={e => setField('policyEndAge', Number(e.target.value))} />{formErrors.policyEndAge && <span className="field-error">{formErrors.policyEndAge}</span>}</div>
          </section>

          <section>
            <h4>コスト・貯蓄性</h4>
            <div className="form-group">
              <label>払方</label>
              <select value={formData.paymentFrequency} onChange={e => setField('paymentFrequency', e.target.value as any)}>
                <option value="monthly">月払</option>
                <option value="annual">年払</option>
                <option value="single">一時払</option>
              </select>
            </div>
            <CommaInput label="保険料（1回あたり）(円)" value={formData.premiumAmount || 0} onChange={v => setField('premiumAmount', v)} />
            <div className={`form-group ${formErrors.paymentEndAge ? 'has-error' : ''}`}><label>払込終了年齢（歳）<span className="required-mark">*</span></label><input type="number" value={formData.paymentEndAge} onChange={e => setField('paymentEndAge', Number(e.target.value))} />{formErrors.paymentEndAge && <span className="field-error">{formErrors.paymentEndAge}</span>}</div>
            <CommaInput label="満期保険金 (円)" value={formData.maturityBenefit || 0} onChange={v => setField('maturityBenefit', v)} />
            {isPension && (
              <>
                <div className="form-group">
                  <label className="label-with-btn">払込総額 (円) <button type="button" className="calc-btn" onClick={handleCalcTotal}>計算</button></label>
                  <CommaInputRaw value={calcTotal ?? 0} onChange={setCalcTotal} placeholder="直接入力 or 計算ボタン" />
                </div>
                <CommaInput label="年金原資（受取総額）(円)" value={formData.maturityBenefit || 0} onChange={v => setField('maturityBenefit', v)} />
              </>
            )}
          </section>

          <div className="form-actions full-width">
            <button type="submit" className="save-btn">{editingPolicy ? '変更を保存' : '保存して一覧に追加'}</button>
            <button type="button" onClick={handleClose} className="cancel-btn">キャンセル</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PolicyForm;
