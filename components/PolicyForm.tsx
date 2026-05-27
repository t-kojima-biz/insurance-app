'use client';

import React, { useState, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { Policy, PolicyType, FamilyMember } from '@/types';
import { FileUp, Upload, X } from 'lucide-react';

interface PolicyFormProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (policy: Policy) => void;
  onAddFamilyMember?: (member: FamilyMember) => void;
  familyMembers: FamilyMember[];
  editingPolicy: Policy | null;
  onCancel: () => void;
}

interface UnresolvedName {
  field: 'insured' | 'beneficiary';
  label: string;
  originalName: string;
}

const formatComma = (n: number) => n ? n.toLocaleString() : '';

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

const PolicyForm: React.FC<PolicyFormProps> = ({ isOpen, onClose, onAdd, onAddFamilyMember, familyMembers, editingPolicy, onCancel }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showPasteArea, setShowPasteArea] = useState(false);
  const [pasteText, setPasteText] = useState('');
  
  // マッチング未解決の名前管理
  const [unresolvedNames, setUnresolvedNames] = useState<UnresolvedName[]>([]);
  const [resolvingIndex, setResolvingIndex] = useState<number>(-1);

  const [formData, setFormData] = useState<Partial<Policy>>({
    companyName: '',
    policyType: '終身保険',
    policyNumber: '',
    contractDate: new Date().toISOString().split('T')[0],
    contractAge: 30,
    insuredId: familyMembers[0]?.id || '',
    beneficiaryId: familyMembers[0]?.id || '',
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
    if (editingPolicy) {
      setFormData(editingPolicy);
    } else {
      setFormData({
        companyName: '',
        policyType: '終身保険',
        policyNumber: '',
        contractDate: new Date().toISOString().split('T')[0],
        contractAge: 30,
        insuredId: familyMembers[0]?.id || '',
        beneficiaryId: familyMembers[0]?.id || '',
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
    setUnresolvedNames([]);
    setResolvingIndex(-1);
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
      const yearMatch = d.match(/(\d{4})/);
      const mdMatch = d.match(/(\d{1,2})\s*[月/-]\s*(\d{1,2})/);
      if (yearMatch && mdMatch) {
        cleanData.contractDate = `${yearMatch[1]}-${mdMatch[1].padStart(2, '0')}-${mdMatch[2].padStart(2, '0')}`;
      } else {
        const stdMatch = d.match(/(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
        if (stdMatch) {
          cleanData.contractDate = `${stdMatch[1]}-${stdMatch[2].padStart(2, '0')}-${stdMatch[3].padStart(2, '0')}`;
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

    // 名前一致判定の極限強化ロジック
    const normalizeName = (name: string) => {
      let n = String(name || '');
      n = n.replace(/(様|殿|くん|ちゃん|様方)$/, '');
      n = n.replace(/[（\(].*?[\)）]/g, '');
      n = n.replace(/[・．.、,]/g, '');
      n = n.replace(/\s+/g, '');
      return n.trim();
    };

    const findMemberId = (nameStr: string) => {
      if (!nameStr) return null;
      const target = normalizeName(nameStr);
      if (!target) return null;

      const exactMatch = familyMembers.find(m => normalizeName(m.name) === target);
      if (exactMatch) return exactMatch.id;

      const kanaMatch = familyMembers.find(m => normalizeName((m as any).nameKana || '') === target);
      if (kanaMatch) return kanaMatch.id;

      const partialMatch = familyMembers.find(m => {
        const mName = normalizeName(m.name);
        const mKana = normalizeName((m as any).nameKana || '');
        return mName.includes(target) || target.includes(mName) || (mKana && (mKana.includes(target) || target.includes(mKana)));
      });

      return partialMatch ? partialMatch.id : null;
    };

    // 解析と未解決名の抽出
    let insuredId = json.insuredId || findMemberId(json.insuredName);
    const unresolved: UnresolvedName[] = [];
    
    if (!insuredId && json.insuredName) {
      unresolved.push({ field: 'insured', label: '被保険者', originalName: json.insuredName });
    }

    let beneficiaryId = json.beneficiaryId;
    const bName = String(json.beneficiaryName || '').trim();
    if (bName.match(/^(本人|被保険者|同上|被保険者と同じ|左記に同じ)$/) || (insuredId && normalizeName(bName) === normalizeName(json.insuredName || ''))) {
      beneficiaryId = insuredId;
    } else {
      beneficiaryId = beneficiaryId || findMemberId(bName);
      if (!beneficiaryId && bName) {
        unresolved.push({ field: 'beneficiary', label: '受取人', originalName: bName });
      }
    }

    setFormData(prev => ({ ...prev, ...cleanData, insuredId: insuredId || prev.insuredId, beneficiaryId: beneficiaryId || prev.beneficiaryId }));

    if (unresolved.length > 0) {
      setUnresolvedNames(unresolved);
      setResolvingIndex(0);
    }
  };

  const resolveMatch = (id: string | 'new') => {
    const current = unresolvedNames[resolvingIndex];
    let finalId = id;

    if (id === 'new') {
      const newId = Math.random().toString(36).substr(2, 9);
      const newMember: FamilyMember = {
        id: newId,
        name: current.originalName.replace(/様$/, '').trim(),
        nameKana: '',
        relationship: current.field === 'insured' ? '本人' : '配偶者',
        birthDate: '1980-01-01',
        gender: 'male'
      };
      onAddFamilyMember?.(newMember);
      finalId = newId;
    }

    if (current.field === 'insured') {
      setFormData(prev => ({ ...prev, insuredId: finalId }));
      // 受取人が「本人」系だった場合の連動
      const bName = unresolvedNames.find(u => u.field === 'beneficiary')?.originalName || '';
      if (bName.match(/^(本人|被保険者|同上|被保険者と同じ|左記に同じ)$/)) {
        setFormData(prev => ({ ...prev, beneficiaryId: finalId }));
      }
    } else {
      setFormData(prev => ({ ...prev, beneficiaryId: finalId }));
    }

    if (resolvingIndex < unresolvedNames.length - 1) {
      setResolvingIndex(resolvingIndex + 1);
    } else {
      setUnresolvedNames([]);
      setResolvingIndex(-1);
    }
  };

  const handleJsonImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        processJsonData(JSON.parse(content));
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
      processJsonData(JSON.parse(pasteText));
      setShowPasteArea(false);
      setPasteText('');
    } catch (err) {
      alert('JSONの解析に失敗しました。正しいJSON形式で貼り付けてください。');
    }
  };

  const setField = (field: string, value: any) => setFormData(prev => ({ ...prev, [field]: value }));

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
    if (!formData.companyName) errors.companyName = '保険会社は必須です';
    if (!formData.contractDate) errors.contractDate = '契約日は必須です';
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

  const SelectExistingResolve: React.FC<{ onSelect: (id: string) => void }> = ({ onSelect }) => (
    <select onChange={(e) => onSelect(e.target.value)} defaultValue="" className="resolve-select">
      <option value="" disabled>既存の家族から選択...</option>
      {familyMembers.map(m => <option key={m.id} value={m.id}>{m.relationship}: {m.name}</option>)}
    </select>
  );

  if (!isOpen) return null;

  const resolvingName = unresolvedNames[resolvingIndex];

  return (
    <div className="form-overlay">
      <div className="form-container wide-form">
        <div className="modal-header">
          <div className="title-with-icon">
            <h3>{editingPolicy ? '保険証券の編集' : '保険証券の詳細登録'}</h3>
          </div>
          <div className="header-actions">
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

        {resolvingName && (
          <div className="resolve-wizard full-width">
            <div className="resolve-wizard-header">
              <Upload size={20} className="resolve-icon" />
              <h4>名前の確認が必要です ({resolvingIndex + 1} / {unresolvedNames.length})</h4>
            </div>
            <p className="resolve-instruction">
              JSON内の名前「<strong>{resolvingName.originalName}</strong>」様をアプリの<strong>{resolvingName.label}</strong>として登録します。誰のことですか？
            </p>
            <div className="resolve-options">
              <div className="resolve-option-group">
                <span className="resolve-option-label">既存の家族から選ぶ:</span>
                <SelectExistingResolve onSelect={resolveMatch} />
              </div>
              <div className="resolve-divider">または</div>
              <div className="resolve-btn-group">
                <button type="button" className="resolve-btn-new" onClick={() => resolveMatch('new')}>
                  新しい家族として追加登録
                </button>
                <button type="button" className="resolve-btn-skip" onClick={() => resolveMatch('')}>
                  スキップして手動で選ぶ
                </button>
              </div>
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
            <div className="form-group">
              <label>被保険者</label>
              <select value={formData.insuredId} onChange={e => setField('insuredId', e.target.value)}>
                {familyMembers.map(m => <option key={m.id} value={m.id}>{m.relationship}: {m.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>保険金受取人</label>
              <select value={formData.beneficiaryId} onChange={e => setField('beneficiaryId', e.target.value)}>
                {familyMembers.map(m => <option key={m.id} value={m.id}>{m.relationship}: {m.name}</option>)}
              </select>
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
