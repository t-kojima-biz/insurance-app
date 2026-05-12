import React, { useState } from 'react';
import { FamilyMember, Agency } from '../types';
import { User, X, Plus, Trash2, Building2 } from 'lucide-react';

interface CustomerModalProps {
  familyMembers: FamilyMember[];
  agency: Agency;
  onSave: (updatedFamily: FamilyMember[], updatedAgency: Agency) => void;
  onClose: () => void;
}

const CustomerModal: React.FC<CustomerModalProps> = ({ familyMembers, agency, onSave, onClose }) => {
  const [tempMembers, setTempMembers] = useState<FamilyMember[]>(familyMembers);
  const [tempAgency, setTempAgency] = useState<Agency>(agency);

  const handleAddMember = () => {
    const newMember: FamilyMember = {
      id: Math.random().toString(36).substr(2, 9),
      name: '',
      relationship: '',
      birthDate: new Date().toISOString().split('T')[0],
      gender: 'male'
    };
    setTempMembers([...tempMembers, newMember]);
  };

  const handleRemoveMember = (id: string) => {
    if (tempMembers.length <= 1) return;
    setTempMembers(tempMembers.filter(m => m.id !== id));
  };

  const updateMember = (id: string, field: keyof FamilyMember, value: any) => {
    setTempMembers(tempMembers.map(m => m.id === id ? { ...m, [field]: value } : m));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(tempMembers, tempAgency);
    onClose();
  };

  return (
    <div className="form-overlay">
      <div className="form-container wide-form">
        <div className="modal-header">
          <div className="title-with-icon">
            <User className="icon" />
            <h3>世帯・代理店情報の設定</h3>
          </div>
          <button className="close-btn" onClick={onClose}><X size={20} /></button>
        </div>
        
        <form onSubmit={handleSubmit}>
          <h4>世帯・家族情報</h4>
          <div className="family-list">
            {tempMembers.map((member, index) => (
              <div key={member.id} className="family-member-row">
                <div className="form-group small"><label>続柄</label>
                  <input type="text" value={member.relationship} placeholder={index === 0 ? "本人" : "妻など"}
                    onChange={e => updateMember(member.id, 'relationship', e.target.value)} required />
                </div>
                <div className="form-group"><label>氏名</label>
                  <input type="text" value={member.name} onChange={e => updateMember(member.id, 'name', e.target.value)} required />
                </div>
                <div className="form-group"><label>生年月日</label>
                  <input type="date" value={member.birthDate} onChange={e => updateMember(member.id, 'birthDate', e.target.value)} required />
                </div>
                <div className="form-group small"><label>性別</label>
                  <select value={member.gender} onChange={e => updateMember(member.id, 'gender', e.target.value)}>
                    <option value="male">男</option><option value="female">女</option>
                  </select>
                </div>
                <button type="button" className="remove-btn" onClick={() => handleRemoveMember(member.id)}><Trash2 size={16} /></button>
              </div>
            ))}
          </div>
          <button type="button" className="add-member-btn" onClick={handleAddMember}><Plus size={16} /> 家族を追加</button>

          <h4 style={{marginTop: '2rem'}}><div className="title-with-icon"><Building2 size={20} className="icon" /> 代理店情報</div></h4>
          <div className="grid-form">
            <div className="form-group"><label>代理店名</label>
              <input type="text" value={tempAgency.name} onChange={e => setTempAgency({...tempAgency, name: e.target.value})} required />
            </div>
            <div className="form-group"><label>取扱者名</label>
              <input type="text" value={tempAgency.representative} onChange={e => setTempAgency({...tempAgency, representative: e.target.value})} required />
            </div>
            <div className="form-group"><label>連絡先電話番号</label>
              <input type="text" value={tempAgency.phone} onChange={e => setTempAgency({...tempAgency, phone: e.target.value})} required />
            </div>
          </div>

          <div className="form-actions" style={{ marginTop: '2rem' }}>
            <button type="submit" className="save-btn" style={{ flex: 1 }}>設定を保存</button>
            <button type="button" className="cancel-btn" onClick={onClose} style={{ flex: 1 }}>キャンセル</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CustomerModal;
