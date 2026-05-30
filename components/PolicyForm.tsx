'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { Policy, PolicyType, FamilyMember } from '@/types';
import { AlertTriangle, Clipboard, FileUp, RotateCcw, Save, Upload, X } from 'lucide-react';
import { mergeRelationshipSuggestions } from '@/utils/relationshipOptions';
import { fetchPolicyPrompt, savePolicyPrompt } from '@/lib/api';
import { DEFAULT_POLICY_PROMPT, LEGACY_DEFAULT_POLICY_PROMPTS, normalizePromptText } from '@/lib/policyPrompt';

interface PolicyFormProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (policy: Policy) => void;
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

interface ImportDraft {
  id: string;
  data: Partial<Policy>;
  insuredId: string;
  beneficiaryId: string;
  linkBeneficiaryToInsured: boolean;
  insuredName: string;
  beneficiaryName: string;
  warnings: string[];
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

const LEGACY_PROMPT_STORAGE_KEY = 'insurance-policy-import-prompt';

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
  onAddFamilyMember,
  familyMembers,
  existingPolicies = [],
  editingPolicy,
  onCancel,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pasteTextareaRef = useRef<HTMLTextAreaElement>(null);
  const previousOpenRef = useRef(false);
  const previousEditingPolicyIdRef = useRef<string | null>(null);
  const [showPasteArea, setShowPasteArea] = useState(false);
  const [showPromptEditor, setShowPromptEditor] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [importDrafts, setImportDrafts] = useState<ImportDraft[]>([]);
  const [pendingImportMembers, setPendingImportMembers] = useState<FamilyMember[]>([]);
  const [formImportWarnings, setFormImportWarnings] = useState<string[]>([]);
  const [policyPrompt, setPolicyPrompt] = useState(DEFAULT_POLICY_PROMPT);
  const [promptDraft, setPromptDraft] = useState(DEFAULT_POLICY_PROMPT);
  const [promptCopied, setPromptCopied] = useState(false);
  const [promptSaved, setPromptSaved] = useState(false);
  const [promptSaving, setPromptSaving] = useState(false);
  
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

  useEffect(() => {
    let cancelled = false;

    const readLegacyPrompt = () => {
      try {
        return window.localStorage.getItem(LEGACY_PROMPT_STORAGE_KEY)?.trim() || '';
      } catch {
        return '';
      }
    };

    const removeLegacyPrompt = () => {
      try {
        window.localStorage.removeItem(LEGACY_PROMPT_STORAGE_KEY);
      } catch {
        // ignore unavailable storage
      }
    };

    const isDefaultPrompt = (prompt: string) =>
      normalizePromptText(prompt) === normalizePromptText(DEFAULT_POLICY_PROMPT) ||
      LEGACY_DEFAULT_POLICY_PROMPTS.some(legacy => normalizePromptText(legacy) === normalizePromptText(prompt));

    const loadPrompt = async () => {
      const legacyPrompt = readLegacyPrompt();
      try {
        const saved = await fetchPolicyPrompt();
        let nextPrompt = saved.prompt?.trim() || DEFAULT_POLICY_PROMPT;
        const hasLegacyCustomPrompt = legacyPrompt && !isDefaultPrompt(legacyPrompt);
        const databasePromptIsDefault = isDefaultPrompt(nextPrompt);

        if (hasLegacyCustomPrompt && (saved.source === 'default' || databasePromptIsDefault)) {
          nextPrompt = (await savePolicyPrompt(legacyPrompt)).prompt;
        }

        removeLegacyPrompt();
        if (!cancelled) {
          setPolicyPrompt(nextPrompt);
          setPromptDraft(nextPrompt);
        }
      } catch (err) {
        console.error('Policy prompt load error:', err);
        if (!cancelled && legacyPrompt && !isDefaultPrompt(legacyPrompt)) {
          setPolicyPrompt(legacyPrompt);
          setPromptDraft(legacyPrompt);
        }
      }
    };

    loadPrompt();
    return () => {
      cancelled = true;
    };
  }, []);

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
    setShowPromptEditor(false);
    setPasteText('');
    setImportDrafts([]);
    setPendingImportMembers([]);
    setFormImportWarnings([]);
    setUnresolvedNames([]);
    setLinkBeneficiaryToInsured(false);
    setPromptCopied(false);
    setPromptSaved(false);
  }, [editingPolicy, familyMembers, isOpen]);

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

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
      '被保険者生年月日': 'insuredBirthDate',
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
    birthDate = '',
  ) => {
    const name = String(originalName || '').trim();
    const key = normalizePersonName(name) || `${field}:${name}`;
    const ref = { draftId, field };
    const existing = map.get(key);
    if (existing) {
      existing.refs = [...(existing.refs || []), ref];
      if (!existing.birthDate && birthDate) existing.birthDate = birthDate;
      if (!existing.label.includes(label)) existing.label = '被保険者/受取人';
      return;
    }

    const initialPlaceholder = familyMembers.some(hasSearchableName)
      ? undefined
      : familyMembers.find(isEmptyFamilyPlaceholder);
    const item = createUnresolvedName(field, label, name, [ref]);
    if (field === 'insured') item.relationship = initialPlaceholder?.relationship || '本人';
    if (birthDate) item.birthDate = birthDate;
    map.set(key, item);
  };

  const buildImportDraft = (
    rawJson: any,
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
    const insuredBirthDate = parseImportDate(json.insuredBirthDate);
    const beneficiaryName = String(json.beneficiaryName || '').trim();
    let insuredId = typeof json.insuredId === 'string' && existingMemberIds.has(json.insuredId)
      ? json.insuredId
      : findMemberIdByName(familyMembers, insuredName);

    if (!insuredId && insuredName) {
      addPreviewUnresolved(unresolvedMap, draftId, 'insured', '被保険者', insuredName, insuredBirthDate);
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
      data,
      insuredId,
      beneficiaryId,
      linkBeneficiaryToInsured,
      insuredName,
      beneficiaryName,
      warnings,
    };
  };

  const prepareJsonImport = (parsed: any) => {
    const records = extractImportRecords(parsed);
    if (records.length === 0) throw new Error('JSONに証券データがありません');
    if (records.length > 1) throw new Error('複数件のJSONはフォーム反映できません。1件ずつ取り込んでください。');

    const unresolvedMap = new Map<string, UnresolvedName>();
    const draft = buildImportDraft(records[0], unresolvedMap);
    setPendingImportMembers([]);
    setImportDrafts([]);
    setFormImportWarnings([]);
    setLinkBeneficiaryToInsured(false);
    setFormErrors({});

    const unresolved = [...unresolvedMap.values()];
    if (unresolved.length > 0) {
      setImportDrafts([draft]);
      setUnresolvedNames(unresolved);
      setShowPasteArea(false);
      return;
    }

    reflectImportDraftToForm(draft);
    setUnresolvedNames([]);
  };

  const parseImportJsonText = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) throw new Error('JSONが空です');

    const candidates = [trimmed];
    const fencedMatches = trimmed.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi);
    for (const match of fencedMatches) {
      if (match[1]?.trim()) candidates.push(match[1].trim());
    }

    const objectStart = trimmed.indexOf('{');
    const arrayStart = trimmed.indexOf('[');
    const starts = [objectStart, arrayStart].filter(index => index >= 0);
    if (starts.length > 0) {
      const start = Math.min(...starts);
      const close = trimmed[start] === '[' ? ']' : '}';
      const end = trimmed.lastIndexOf(close);
      if (end > start) candidates.push(trimmed.slice(start, end + 1));
    }

    const uniqueCandidates = [...new Set(candidates)];
    for (const candidate of uniqueCandidates) {
      try {
        return JSON.parse(candidate);
      } catch {
        // Try the next likely JSON fragment.
      }
    }

    throw new Error('JSONの解析に失敗しました');
  };

  const reflectImportDraftToForm = (draft: ImportDraft, members: FamilyMember[] = []) => {
    members.forEach(member => onAddFamilyMember?.(member));
    setFormData(prev => ({
      ...prev,
      ...draft.data,
      insuredId: draft.insuredId || '',
      beneficiaryId: draft.beneficiaryId || '',
    }));
    setFormImportWarnings(draft.warnings);
    setImportDrafts([]);
    setPendingImportMembers([]);
    setPasteText('');
    setShowPasteArea(false);
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
      const nextImportMembers = [...pendingImportMembers];
      for (const member of createdImportMembers) {
        const index = nextImportMembers.findIndex(existing => existing.id === member.id);
        if (index >= 0) nextImportMembers[index] = { ...nextImportMembers[index], ...member };
        else nextImportMembers.push(member);
      }

      const nextDrafts = importDrafts.map(draft => {
        const resolved = draftResolvedIds[draft.id];
        if (!resolved) return draft;
        const insuredId = resolved.insured || draft.insuredId;
        return {
          ...draft,
          insuredId,
          beneficiaryId: resolved.beneficiary || (draft.linkBeneficiaryToInsured && resolved.insured ? resolved.insured : draft.beneficiaryId),
        };
      });

      const draft = nextDrafts[0];
      if (draft) reflectImportDraftToForm(draft, nextImportMembers);
      else {
        setPendingImportMembers(nextImportMembers);
        setImportDrafts(nextDrafts);
      }
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
    const draft = importDrafts[0];
    if (draft) {
      reflectImportDraftToForm(draft, pendingImportMembers);
    }
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
        prepareJsonImport(parseImportJsonText(content));
      } catch (err) {
        console.error('JSON Import Error:', err);
        alert(err instanceof Error ? err.message : 'JSONの解析に失敗しました。JSONのみ、または```jsonのコードブロックで出力された内容を指定してください。');
      } finally {
        e.target.value = '';
      }
    };
    reader.readAsText(file);
  };

  const handlePasteImport = () => {
    try {
      const latestPasteText = pasteTextareaRef.current?.value ?? pasteText;
      if (!latestPasteText.trim()) return;
      prepareJsonImport(parseImportJsonText(latestPasteText));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'JSONの解析に失敗しました。JSONのみ、または```jsonのコードブロックで貼り付けてください。');
    }
  };

  const setField = (field: string, value: any) => setFormData(prev => ({ ...prev, [field]: value }));

  const handlePromptEditorToggle = () => {
    if (showPromptEditor) {
      setShowPromptEditor(false);
      return;
    }
    setPromptDraft(policyPrompt);
    setPromptCopied(false);
    setPromptSaved(false);
    setShowPasteArea(false);
    setShowPromptEditor(true);
  };

  const handlePasteAreaToggle = () => {
    setShowPromptEditor(false);
    setShowPasteArea(current => !current);
  };

  const handleSavePrompt = async () => {
    const nextPrompt = promptDraft.trim();
    if (!nextPrompt) {
      alert('プロンプトを入力してください。');
      return;
    }

    setPromptSaving(true);
    try {
      const saved = await savePolicyPrompt(nextPrompt);
      setPolicyPrompt(saved.prompt);
      setPromptDraft(saved.prompt);
      setPromptSaved(true);
      window.setTimeout(() => setPromptSaved(false), 1800);
    } catch (err) {
      const message = err && typeof err === 'object' && 'error' in err
        ? String((err as { error?: unknown }).error)
        : 'プロンプトを保存できませんでした。';
      alert(message);
    } finally {
      setPromptSaving(false);
    }
  };

  const handleResetPromptDraft = () => {
    setPromptDraft(DEFAULT_POLICY_PROMPT);
    setPromptCopied(false);
    setPromptSaved(false);
  };

  const handleCopyPrompt = async (text = policyPrompt) => {
    try {
      await navigator.clipboard.writeText(text);
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
            <button type="button" className="json-import-btn-outline" onClick={handlePasteAreaToggle}>
              <Upload size={16} /> JSON貼り付け
            </button>
            <button type="button" className="json-import-btn-outline" onClick={() => fileInputRef.current?.click()}>
              <FileUp size={16} /> JSONファイル
            </button>
            <button
              type="button"
              className={`json-import-btn-outline ${showPromptEditor ? 'is-active' : ''}`}
              onClick={handlePromptEditorToggle}
            >
              <Clipboard size={16} /> プロンプト
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

        {showPromptEditor && (
          <div className="prompt-editor full-width">
            <div className="prompt-editor-header">
              <h4>画像認識プロンプト</h4>
            </div>
            <textarea
              value={promptDraft}
              onChange={(e) => {
                setPromptDraft(e.target.value);
                setPromptSaved(false);
              }}
              rows={14}
              className="prompt-editor-textarea"
            />
            <div className="prompt-editor-actions">
              <button type="button" className="json-paste-apply-btn" onClick={handleSavePrompt} disabled={promptSaving}>
                <Save size={16} /> {promptSaving ? '保存中' : promptSaved ? '保存済み' : '保存'}
              </button>
              <button type="button" className="json-paste-cancel-btn" onClick={() => handleCopyPrompt(promptDraft)}>
                <Clipboard size={16} /> {promptCopied ? 'コピー済み' : 'コピー'}
              </button>
              <button type="button" className="json-paste-cancel-btn" onClick={handleResetPromptDraft}>
                <RotateCcw size={16} /> 初期値に戻す
              </button>
              <button type="button" className="json-paste-cancel-btn" onClick={() => setShowPromptEditor(false)}>
                閉じる
              </button>
            </div>
          </div>
        )}

        {(unresolvedNames.length > 0 || formImportWarnings.length > 0) && (
          <div className="form-notice-stack full-width">
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

            {formImportWarnings.length > 0 && (
              <div className="json-import-alert full-width">
                <AlertTriangle size={16} />
                <div className="json-import-warning-list">
                  {formImportWarnings.map((warning, index) => (
                    <span key={`form-import-warning-${index}`}>{warning}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {showPasteArea && (
          <div className="json-paste-area full-width">
            <textarea
              ref={pasteTextareaRef}
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
