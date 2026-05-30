'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import type { FamilyMember, Agency, AgencyMaster } from '@/types';
import {
  createAgencyMaster,
  fetchAgencyMasters,
  updateAgencyMaster,
} from '@/lib/api';
import { User, X, Plus, Trash2, Building2, Download, Save, RefreshCw } from 'lucide-react';
import { mergeRelationshipSuggestions } from '@/utils/relationshipOptions';

interface CustomerModalProps {
  familyMembers: FamilyMember[];
  agency: Agency;
  onSave: (updatedFamily: FamilyMember[], updatedAgency: Agency) => Promise<void> | void;
  onClose: () => void;
}

function toKatakana(str: string): string {
  return str.replace(/[ぁ-ゖ]/g, ch =>
    String.fromCharCode(ch.charCodeAt(0) + 0x60)
  );
}

function sortAgencyMasters(masters: AgencyMaster[]): AgencyMaster[] {
  return [...masters].sort((a, b) => a.name.localeCompare(b.name, 'ja'));
}

const CustomerModal: React.FC<CustomerModalProps> = ({ familyMembers, agency, onSave, onClose }) => {
  const [tempMembers, setTempMembers] = useState<FamilyMember[]>(familyMembers);
  const [tempAgency, setTempAgency] = useState<Agency>(agency);
  const [agencyMasters, setAgencyMasters] = useState<AgencyMaster[]>([]);
  const [selectedAgencyMasterId, setSelectedAgencyMasterId] = useState('');
  const [agencyMasterNotice, setAgencyMasterNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isAgencyMasterSaving, setIsAgencyMasterSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const composingRef = useRef(false);
  const relationshipSuggestions = useMemo(
    () => mergeRelationshipSuggestions(tempMembers.map(member => member.relationship)),
    [tempMembers],
  );
  const selectedAgencyMaster = agencyMasters.find(master => master.id === selectedAgencyMasterId);
  const hasAgencyFields = Boolean(tempAgency.name.trim() && tempAgency.representative.trim() && tempAgency.phone.trim());

  useEffect(() => {
    let ignore = false;
    fetchAgencyMasters()
      .then(masters => {
        if (!ignore) setAgencyMasters(sortAgencyMasters(masters));
      })
      .catch(() => {
        if (!ignore) setAgencyMasterNotice({ type: 'error', text: '代理店マスターの読み込みに失敗しました' });
      });
    return () => {
      ignore = true;
    };
  }, []);

  const handleAddMember = () => {
    const newMember: FamilyMember = {
      id: Math.random().toString(36).substr(2, 9),
      name: '',
      nameKana: '',
      relationship: '',
      birthDate: '',
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
      setSelectedAgencyMasterId(masterId);
      setTempAgency({ name: master.name, representative: master.representative, phone: master.phone });
      setAgencyMasterNotice({ type: 'success', text: '代理店マスターを呼び出しました' });
    }
  };

  const setAgencyField = (field: keyof Agency, value: string) => {
    setTempAgency(current => ({ ...current, [field]: value }));
    setAgencyMasterNotice(null);
    setSubmitError(null);
  };

  const getAgencyPayload = (): Omit<AgencyMaster, 'id'> | null => {
    const payload = {
      name: tempAgency.name.trim(),
      representative: tempAgency.representative.trim(),
      phone: tempAgency.phone.trim(),
    };
    if (!payload.name || !payload.representative || !payload.phone) return null;
    return payload;
  };

  const handleCreateAgencyMaster = async () => {
    const payload = getAgencyPayload();
    if (!payload) {
      setAgencyMasterNotice({ type: 'error', text: '代理店情報をすべて入力してください' });
      return;
    }

    setIsAgencyMasterSaving(true);
    try {
      const created = await createAgencyMaster(payload);
      setAgencyMasters(current => sortAgencyMasters([...current, created]));
      setSelectedAgencyMasterId(created.id);
      setAgencyMasterNotice({ type: 'success', text: '代理店マスターに保存しました' });
    } catch {
      setAgencyMasterNotice({ type: 'error', text: '代理店マスターの保存に失敗しました' });
    } finally {
      setIsAgencyMasterSaving(false);
    }
  };

  const handleUpdateAgencyMaster = async () => {
    const payload = getAgencyPayload();
    if (!payload) {
      setAgencyMasterNotice({ type: 'error', text: '代理店情報をすべて入力してください' });
      return;
    }
    if (!selectedAgencyMasterId) {
      setAgencyMasterNotice({ type: 'error', text: '更新する代理店マスターを選択してください' });
      return;
    }

    setIsAgencyMasterSaving(true);
    try {
      const updated = await updateAgencyMaster(selectedAgencyMasterId, payload);
      setAgencyMasters(current => sortAgencyMasters(current.map(master => master.id === selectedAgencyMasterId ? updated : master)));
      setAgencyMasterNotice({ type: 'success', text: '代理店マスターを更新しました' });
    } catch {
      setAgencyMasterNotice({ type: 'error', text: '代理店マスターの更新に失敗しました' });
    } finally {
      setIsAgencyMasterSaving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setIsSubmitting(true);
    try {
      await onSave(tempMembers, {
        name: tempAgency.name.trim(),
        representative: tempAgency.representative.trim(),
        phone: tempAgency.phone.trim(),
      });
      onClose();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : '保存に失敗しました');
    } finally {
      setIsSubmitting(false);
    }
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
          <datalist id="customer-relationship-suggestions">
            {relationshipSuggestions.map(value => <option key={value} value={value} />)}
          </datalist>
          <div className="family-list">
            {tempMembers.map((member, index) => (
              <div key={member.id} className="family-member-row">
                <div className="form-group small"><label className="label-with-hint">続柄 <span>候補選択・直接入力</span></label>
                  <input type="text" list="customer-relationship-suggestions" value={member.relationship} placeholder={index === 0 ? "例: 本人" : "例: 長男、妻など"}
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
                <div className="form-group"><label>生年月日（任意）</label>
                  <input type="date" value={member.birthDate} onChange={e => updateMember(member.id, 'birthDate', e.target.value)} />
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
          <div className="agency-master-tools">
            <div className="form-group">
              <label><Download size={14} style={{marginRight: '4px', verticalAlign: '-2px'}} />代理店マスター</label>
              <select value={selectedAgencyMasterId} onChange={e => { setSelectedAgencyMasterId(e.target.value); if (e.target.value) handleLoadAgencyMaster(e.target.value); }}>
                <option value="">選択してください</option>
                {agencyMasters.map(m => (
                  <option key={m.id} value={m.id}>{m.name} ({m.representative})</option>
                ))}
              </select>
            </div>
            <div className="agency-master-actions">
              <button
                type="button"
                className="agency-master-action-btn"
                onClick={handleCreateAgencyMaster}
                disabled={!hasAgencyFields || isAgencyMasterSaving}
              >
                <Save size={15} /> 新規保存
              </button>
              <button
                type="button"
                className="agency-master-action-btn"
                onClick={handleUpdateAgencyMaster}
                disabled={!selectedAgencyMaster || !hasAgencyFields || isAgencyMasterSaving}
              >
                <RefreshCw size={15} /> 選択中を更新
              </button>
            </div>
            {agencyMasterNotice && (
              <div className={`agency-master-notice is-${agencyMasterNotice.type}`}>
                {agencyMasterNotice.text}
              </div>
            )}
          </div>
          <div className="grid-form">
            <div className="form-group"><label>代理店名</label>
              <input type="text" value={tempAgency.name} onChange={e => setAgencyField('name', e.target.value)} required />
            </div>
            <div className="form-group"><label>取扱者名</label>
              <input type="text" value={tempAgency.representative} onChange={e => setAgencyField('representative', e.target.value)} required />
            </div>
            <div className="form-group"><label>連絡先電話番号</label>
              <input type="text" value={tempAgency.phone} onChange={e => setAgencyField('phone', e.target.value)} required />
            </div>
          </div>

          {submitError && <div className="agency-master-notice is-error">{submitError}</div>}

          <div className="form-actions" style={{ marginTop: '2rem' }}>
            <button type="submit" className="save-btn" style={{ flex: 1 }} disabled={isSubmitting}>
              {isSubmitting ? '保存中...' : '設定を保存'}
            </button>
            <button type="button" className="cancel-btn" onClick={onClose} style={{ flex: 1 }}>キャンセル</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CustomerModal;
