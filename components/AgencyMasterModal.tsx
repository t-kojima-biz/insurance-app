'use client';

import React, { useState, useEffect } from 'react';
import type { AgencyMaster } from '@/types';
import {
  fetchAgencyMasters,
  createAgencyMaster as apiCreate,
  updateAgencyMaster as apiUpdate,
  deleteAgencyMaster as apiDelete,
} from '@/lib/api';
import { X, Plus, Trash2, Pencil, Check, Building2 } from 'lucide-react';

interface AgencyMasterModalProps {
  onClose: () => void;
}

const AgencyMasterModal: React.FC<AgencyMasterModalProps> = ({ onClose }) => {
  const [masters, setMasters] = useState<AgencyMaster[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: '', representative: '', phone: '' });
  const [newForm, setNewForm] = useState({ name: '', representative: '', phone: '' });
  const [showNewForm, setShowNewForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAgencyMasters()
      .then(setMasters)
      .catch(() => setError('読み込みに失敗しました'))
      .finally(() => setIsLoading(false));
  }, []);

  const handleCreate = async () => {
    if (!newForm.name || !newForm.representative || !newForm.phone) {
      setError('全項目を入力してください');
      return;
    }
    try {
      const created = await apiCreate(newForm);
      setMasters([...masters, created]);
      setNewForm({ name: '', representative: '', phone: '' });
      setShowNewForm(false);
      setError(null);
    } catch {
      setError('追加に失敗しました');
    }
  };

  const handleStartEdit = (master: AgencyMaster) => {
    setEditingId(master.id);
    setEditForm({ name: master.name, representative: master.representative, phone: master.phone });
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    if (!editForm.name || !editForm.representative || !editForm.phone) {
      setError('全項目を入力してください');
      return;
    }
    try {
      const updated = await apiUpdate(editingId, editForm);
      setMasters(masters.map(m => m.id === editingId ? updated : m));
      setEditingId(null);
      setError(null);
    } catch {
      setError('更新に失敗しました');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('この代理店マスターを削除しますか？')) return;
    try {
      await apiDelete(id);
      setMasters(masters.filter(m => m.id !== id));
      setError(null);
    } catch {
      setError('削除に失敗しました');
    }
  };

  return (
    <div className="form-overlay">
      <div className="form-container wide-form">
        <div className="modal-header">
          <div className="title-with-icon">
            <Building2 className="icon" />
            <h3>代理店マスター管理</h3>
          </div>
          <button className="close-btn" onClick={onClose}><X size={20} /></button>
        </div>

        {error && (
          <div className="error-banner" style={{ margin: '0 0 1rem' }}>
            <span>{error}</span>
            <button onClick={() => setError(null)} className="error-close-btn">&times;</button>
          </div>
        )}

        {isLoading ? (
          <p style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>読み込み中...</p>
        ) : (
          <>
            {masters.length === 0 && !showNewForm ? (
              <p style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>代理店マスターがありません</p>
            ) : (
              <table className="agency-master-table">
                <thead>
                  <tr>
                    <th>代理店名</th>
                    <th>取扱者</th>
                    <th>電話番号</th>
                    <th style={{ width: '80px' }}>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {masters.map(master => (
                    <tr key={master.id}>
                      {editingId === master.id ? (
                        <>
                          <td><input type="text" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} /></td>
                          <td><input type="text" value={editForm.representative} onChange={e => setEditForm({ ...editForm, representative: e.target.value })} /></td>
                          <td><input type="text" value={editForm.phone} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} /></td>
                          <td className="action-cell">
                            <button type="button" className="icon-btn save" onClick={handleSaveEdit} title="保存"><Check size={16} /></button>
                            <button type="button" className="icon-btn" onClick={() => setEditingId(null)} title="キャンセル"><X size={16} /></button>
                          </td>
                        </>
                      ) : (
                        <>
                          <td>{master.name}</td>
                          <td>{master.representative}</td>
                          <td>{master.phone}</td>
                          <td className="action-cell">
                            <button type="button" className="icon-btn" onClick={() => handleStartEdit(master)} title="編集"><Pencil size={16} /></button>
                            <button type="button" className="icon-btn danger" onClick={() => handleDelete(master.id)} title="削除"><Trash2 size={16} /></button>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {showNewForm ? (
              <div className="agency-new-form">
                <div className="grid-form">
                  <div className="form-group"><label>代理店名</label>
                    <input type="text" value={newForm.name} onChange={e => setNewForm({ ...newForm, name: e.target.value })} />
                  </div>
                  <div className="form-group"><label>取扱者</label>
                    <input type="text" value={newForm.representative} onChange={e => setNewForm({ ...newForm, representative: e.target.value })} />
                  </div>
                  <div className="form-group"><label>電話番号</label>
                    <input type="text" value={newForm.phone} onChange={e => setNewForm({ ...newForm, phone: e.target.value })} />
                  </div>
                </div>
                <div className="form-actions" style={{ marginTop: '0.5rem' }}>
                  <button type="button" className="save-btn" onClick={handleCreate}>追加</button>
                  <button type="button" className="cancel-btn" onClick={() => { setShowNewForm(false); setNewForm({ name: '', representative: '', phone: '' }); }}>キャンセル</button>
                </div>
              </div>
            ) : (
              <button type="button" className="add-member-btn" style={{ marginTop: '1rem' }} onClick={() => setShowNewForm(true)}>
                <Plus size={16} /> 代理店を追加
              </button>
            )}
          </>
        )}

        <div className="form-actions" style={{ marginTop: '2rem' }}>
          <button type="button" className="cancel-btn" onClick={onClose} style={{ flex: 1 }}>閉じる</button>
        </div>
      </div>
    </div>
  );
};

export default AgencyMasterModal;
