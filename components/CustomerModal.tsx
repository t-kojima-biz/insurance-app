'use client';

import React, { useState, useEffect, useRef } from 'react';
import type { FamilyMember, Agency, AgencyMaster } from '@/types';
import { fetchAgencyMasters } from '@/lib/api';
import { User, X, Plus, Trash2, Building2, Download } from 'lucide-react';

interface CustomerModalProps {
  familyMembers: FamilyMember[];
  agency: Agency;
  onSave: (updatedFamily: FamilyMember[], updatedAgency: Agency) => void;
  onClose: () => void;
}

function toKatakana(str: string): string {
  return str.replace(/[ぁ-ゖ]/g, ch =>
    String.fromCharCode(ch.charCodeAt(0) + 0x60)
  );
}

const CustomerModal: React.FC<CustomerModalProps> = ({ familyMembers, agency, onSave, onClose }) => {
  const [tempMembers, setTempMembers] = useState<FamilyMember[]>(familyMembers);
  const [tempAgency, setTempAgency] = useState<Agency>(agency);
  const [agencyMasters, setAgencyMasters] = useState<AgencyMaster[]>([]);
  const composingRef = useRef(false);

  useEffect(() => {
    fetchAgencyMasters().then(setAgencyMasters).catch(() => {});
  }, []);

  const handleAddMember = () => {
    const newMember: FamilyMember = {
      id: Math.random().toString(36).substr(2, 9),
      name: '',
      nameKana: '',
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

  const updateMember = (id: string, field: keyof FamilyMember, value: string) => {
    const finalValue = (field === 'nameKana' && !composingRef.current) ? toKatakana(value) : value;
    setTempMembers(tempMembers.map(m => m.id === id ? { ...m, [field]: finalValue } : m));
  };

  const handleLoadAgencyMaster = (masterId: string) => {
    const master = agencyMasters.find(m => m.id === masterId);
    if (master) {
      setTempAgency({ name: master.name, representative: master.representative, phone: master.phone });
    }
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
                <div className="form-group"><label>フリガナ</label>
                  <input type="text" value={member.nameKana} placeholder="カタカナ"
                    onCompositionStart={() => { composingRef.current = true; }}
                    onCompositionEnd={e => { composingRef.current = false; updateMember(member.id, 'nameKana', e.currentTarget.value); }}
                    onChange={e => updateMember(member.id, 'nameKana', e.target.value)} />
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
          {agencyMasters.length > 0 && (
            <div className="form-group" style={{marginBottom: '1rem'}}>
              <label><Download size={14} style={{marginRight: '4px', verticalAlign: '-2px'}} />マスターから読込</label>
              <select defaultValue="" onChange={e => { if (e.target.value) handleLoadAgencyMaster(e.target.value); }}>
                <option value="">選択してください</option>
                {agencyMasters.map(m => (
                  <option key={m.id} value={m.id}>{m.name} ({m.representative})</option>
                ))}
              </select>
            </div>
          )}
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
