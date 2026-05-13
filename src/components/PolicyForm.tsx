import React, { useState, useEffect } from 'react';
import type { Policy, PolicyType, FamilyMember } from '../types';

interface PolicyFormProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (policy: Policy) => void;
  familyMembers: FamilyMember[];
  editingPolicy: Policy | null;
  onCancel: () => void;
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

const PolicyForm: React.FC<PolicyFormProps> = ({ isOpen, onClose, onAdd, familyMembers, editingPolicy, onCancel }) => {
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
    }
  }, [editingPolicy]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const annualMult = formData.paymentFrequency === 'monthly' ? 12 : formData.paymentFrequency === 'annual' ? 1 : 0;
    const policyData: Policy = {
      ...formData,
      id: editingPolicy ? editingPolicy.id : Math.random().toString(36).substr(2, 9),
      annualPremium: (formData.premiumAmount || 0) * annualMult,
    } as Policy;
    onAdd(policyData);
    onClose();
    if (editingPolicy) onCancel();
  };

  const handleClose = () => {
    onClose();
    onCancel();
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

  if (!isOpen) return null;

  return (
    <div className="form-overlay">
      <div className="form-container wide-form">
        <h3>{editingPolicy ? '保険証券の編集' : '保険証券の詳細登録'}</h3>
        <form onSubmit={handleSubmit} className="grid-form">
          <section>
            <h4>基本情報</h4>
            <div className="form-group"><label>保険会社</label><input type="text" required value={formData.companyName} onChange={e => setField('companyName', e.target.value)} /></div>
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
            <div className="form-group"><label>契約日</label><input type="date" value={formData.contractDate} onChange={e => setField('contractDate', e.target.value)} /></div>
          </section>

          <section>
            <h4>保障内容</h4>
            <CommaInput label="死亡保障（疾病）(円)" value={formData.deathBenefitDisease || 0} onChange={v => setField('deathBenefitDisease', v)} />
            <CommaInput label="死亡保障（災害）(円)" value={formData.deathBenefitAccident || 0} onChange={v => setField('deathBenefitAccident', v)} />
            <CommaInput label="入院日額（疾病）(円)" value={formData.hospDayDisease || 0} onChange={v => setField('hospDayDisease', v)} />
            <CommaInput label="入院日額（災害）(円)" value={formData.hospDayAccident || 0} onChange={v => setField('hospDayAccident', v)} />
            <CommaInput label="診断一時金 (円)" value={formData.diagnosisBenefit || 0} onChange={v => setField('diagnosisBenefit', v)} />
            <div className="form-group"><label>保険期間（歳/999=終身）</label><input type="number" value={formData.policyEndAge} onChange={e => setField('policyEndAge', Number(e.target.value))} /></div>
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
            <div className="form-group"><label>払込終了年齢（歳）</label><input type="number" value={formData.paymentEndAge} onChange={e => setField('paymentEndAge', Number(e.target.value))} /></div>
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
