import React, { useState, useEffect } from 'react';
import type { Policy, PolicyType, FamilyMember } from '../types';

interface PolicyFormProps {
  onAdd: (policy: Policy) => void;
  familyMembers: FamilyMember[];
  editingPolicy: Policy | null;
  onCancel: () => void;
}

const PolicyForm: React.FC<PolicyFormProps> = ({ onAdd, familyMembers, editingPolicy, onCancel }) => {
  const [isOpen, setIsOpen] = useState(false);
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
      setIsOpen(true);
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
    setIsOpen(false);
    if (editingPolicy) onCancel();
  };

  const handleClose = () => {
    setIsOpen(false);
    onCancel();
  };

  if (!isOpen) return <button onClick={() => setIsOpen(true)} className="add-button">+ 新しい保険証券を登録</button>;

  return (
    <div className="form-overlay">
      <div className="form-container wide-form">
        <h3>{editingPolicy ? '保険証券の編集' : '保険証券の詳細登録'}</h3>
        <form onSubmit={handleSubmit} className="grid-form">
          <section>
            <h4>基本情報</h4>
            <div className="form-group"><label>保険会社</label><input type="text" required value={formData.companyName} onChange={e => setFormData({...formData, companyName: e.target.value})} /></div>
            <div className="form-group">
              <label>保険種類</label>
              <select value={formData.policyType} onChange={e => setFormData({...formData, policyType: e.target.value as PolicyType})}>
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
              <select value={formData.insuredId} onChange={e => setFormData({...formData, insuredId: e.target.value})}>
                {familyMembers.map(m => <option key={m.id} value={m.id}>{m.relationship}: {m.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>保険金受取人</label>
              <select value={formData.beneficiaryId} onChange={e => setFormData({...formData, beneficiaryId: e.target.value})}>
                {familyMembers.map(m => <option key={m.id} value={m.id}>{m.relationship}: {m.name}</option>)}
              </select>
            </div>
            <div className="form-group"><label>契約日</label><input type="date" value={formData.contractDate} onChange={e => setFormData({...formData, contractDate: e.target.value})} /></div>
          </section>

          <section>
            <h4>保障内容</h4>
            <div className="form-group"><label>死亡保障（疾病）(円)</label><input type="number" value={formData.deathBenefitDisease} onChange={e => setFormData({...formData, deathBenefitDisease: Number(e.target.value)})} /></div>
            <div className="form-group"><label>死亡保障（災害）(円)</label><input type="number" value={formData.deathBenefitAccident} onChange={e => setFormData({...formData, deathBenefitAccident: Number(e.target.value)})} /></div>
            <div className="form-group"><label>入院日額（疾病）(円)</label><input type="number" value={formData.hospDayDisease} onChange={e => setFormData({...formData, hospDayDisease: Number(e.target.value)})} /></div>
            <div className="form-group"><label>入院日額（災害）(円)</label><input type="number" value={formData.hospDayAccident} onChange={e => setFormData({...formData, hospDayAccident: Number(e.target.value)})} /></div>
            <div className="form-group"><label>診断一時金 (円)</label><input type="number" value={formData.diagnosisBenefit} onChange={e => setFormData({...formData, diagnosisBenefit: Number(e.target.value)})} /></div>
            <div className="form-group"><label>保険期間（歳/999=終身）</label><input type="number" value={formData.policyEndAge} onChange={e => setFormData({...formData, policyEndAge: Number(e.target.value)})} /></div>
          </section>

          <section>
            <h4>コスト・貯蓄性</h4>
            <div className="form-group">
              <label>払方</label>
              <select value={formData.paymentFrequency} onChange={e => setFormData({...formData, paymentFrequency: e.target.value as any})}>
                <option value="monthly">月払</option>
                <option value="annual">年払</option>
                <option value="single">一時払</option>
              </select>
            </div>
            <div className="form-group"><label>保険料（1回あたり）(円)</label><input type="number" value={formData.premiumAmount} onChange={e => setFormData({...formData, premiumAmount: Number(e.target.value)})} /></div>
            <div className="form-group"><label>払込終了年齢（歳）</label><input type="number" value={formData.paymentEndAge} onChange={e => setFormData({...formData, paymentEndAge: Number(e.target.value)})} /></div>
            <div className="form-group"><label>満期保険金 (円)</label><input type="number" value={formData.maturityBenefit} onChange={e => setFormData({...formData, maturityBenefit: Number(e.target.value)})} /></div>
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
