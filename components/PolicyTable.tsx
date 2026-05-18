'use client';

import React, { useState } from 'react';
import type { Policy, FamilyMember } from '@/types';
import { Edit2, GripVertical, Trash } from 'lucide-react';

type DropPosition = 'before' | 'after';

interface PolicyTableProps {
  policies: Policy[];
  familyMembers: FamilyMember[];
  onDelete: (id: string) => void;
  onEdit: (policy: Policy) => void;
  onAddNew: () => void;
  onReorder: (draggedId: string, targetId: string, position: DropPosition) => void;
}

const PolicyTable: React.FC<PolicyTableProps> = ({ policies, familyMembers, onDelete, onEdit, onAddNew, onReorder }) => {
  const [draggedPolicyId, setDraggedPolicyId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ id: string; position: DropPosition } | null>(null);

  const getMemberName = (id: string) => {
    const member = familyMembers.find(m => m.id === id);
    return member ? `${member.relationship} (${member.name})` : '未設定';
  };

  const getAnnualPremium = (policy: Policy) => {
    if (policy.paymentFrequency === 'monthly') return policy.premiumAmount * 12;
    if (policy.paymentFrequency === 'annual') return policy.premiumAmount;
    return policy.premiumAmount;
  };

  const totalAnnual = policies.reduce((sum, p) => sum + getAnnualPremium(p), 0);
  const monthlyTotal = policies.filter(p => p.paymentFrequency === 'monthly').reduce((sum, p) => sum + p.premiumAmount, 0);
  const annualTotal = policies.filter(p => p.paymentFrequency === 'annual').reduce((sum, p) => sum + p.premiumAmount, 0);

  const freqLabel = (f: string) => f === 'monthly' ? '月払' : f === 'annual' ? '年払' : '一時払';

  const handleDragStart = (event: React.DragEvent<HTMLButtonElement>, policyId: string) => {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', policyId);
    setDraggedPolicyId(policyId);
  };

  const handleDragOver = (event: React.DragEvent<HTMLTableRowElement>, policyId: string) => {
    if (!draggedPolicyId || draggedPolicyId === policyId) {
      setDropTarget(null);
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';

    const { top, height } = event.currentTarget.getBoundingClientRect();
    const position: DropPosition = event.clientY < top + height / 2 ? 'before' : 'after';
    setDropTarget(current => (
      current?.id === policyId && current.position === position
        ? current
        : { id: policyId, position }
    ));
  };

  const handleDrop = (event: React.DragEvent<HTMLTableRowElement>, targetId: string) => {
    event.preventDefault();
    const draggedId = event.dataTransfer.getData('text/plain') || draggedPolicyId;

    if (draggedId && draggedId !== targetId && dropTarget?.id === targetId) {
      onReorder(draggedId, targetId, dropTarget.position);
    }

    setDraggedPolicyId(null);
    setDropTarget(null);
  };

  const handleDragEnd = () => {
    setDraggedPolicyId(null);
    setDropTarget(null);
  };

  return (
    <div className="table-container">
      <div className="table-header-row">
        <h3>証券一覧</h3>
        <button onClick={onAddNew} className="add-button no-print">+ 新しい保険証券を登録</button>
      </div>
      <table className="policy-table">
        <thead>
          <tr>
            <th className="order-col">No.</th>
            <th className="drag-col"><span className="sr-only">並び替え</span></th>
            <th>保険種類</th>
            <th>保険会社</th>
            <th>証券番号</th>
            <th>死亡保障</th>
            <th>入院日額</th>
            <th>受取人</th>
            <th>保険料</th>
            <th className="actions-col">操作</th>
          </tr>
        </thead>
        <tbody>
          {policies.map((policy, index) => (
            <tr
              key={policy.id}
              className={[
                'policy-row',
                draggedPolicyId === policy.id ? 'is-dragging' : '',
                dropTarget?.id === policy.id ? `is-drag-over-${dropTarget.position}` : '',
              ].filter(Boolean).join(' ')}
              onDragOver={(event) => handleDragOver(event, policy.id)}
              onDragLeave={() => {
                setDropTarget(current => current?.id === policy.id ? null : current);
              }}
              onDrop={(event) => handleDrop(event, policy.id)}
            >
              <td className="order-cell">{index + 1}</td>
              <td className="drag-cell no-print">
                <button
                  type="button"
                  className="drag-handle"
                  draggable
                  aria-label={`${policy.companyName} ${policy.policyType}を並び替え`}
                  title="ドラッグして並び替え"
                  onDragStart={(event) => handleDragStart(event, policy.id)}
                  onDragEnd={handleDragEnd}
                >
                  <GripVertical size={16} aria-hidden="true" />
                </button>
              </td>
              <td>{policy.policyType}</td>
              <td>{policy.companyName}</td>
              <td>{policy.policyNumber || '-'}</td>
              <td>{policy.deathBenefitDisease > 0 ? `${(policy.deathBenefitDisease / 10000).toLocaleString()}万円` : '-'}</td>
              <td>{policy.hospDayDisease > 0 ? `${policy.hospDayDisease.toLocaleString()}円` : '-'}</td>
              <td>{getMemberName(policy.beneficiaryId)}</td>
              <td>{policy.premiumAmount.toLocaleString()}円 ({freqLabel(policy.paymentFrequency)})</td>
              <td className="actions-cell">
                <button onClick={() => onEdit(policy)} className="edit-icon-btn" title="編集"><Edit2 size={16} /></button>
                <button onClick={() => onDelete(policy.id)} className="delete-icon-btn" title="削除"><Trash size={16} /></button>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          {monthlyTotal > 0 && (
            <tr className="total-row">
              <td colSpan={8} style={{ textAlign: 'right', fontWeight: 700 }}>月払計</td>
              <td style={{ fontWeight: 700 }}>{monthlyTotal.toLocaleString()}円/月</td>
              <td></td>
            </tr>
          )}
          {annualTotal > 0 && (
            <tr className="total-row">
              <td colSpan={8} style={{ textAlign: 'right', fontWeight: 700 }}>年払計</td>
              <td style={{ fontWeight: 700 }}>{annualTotal.toLocaleString()}円/年</td>
              <td></td>
            </tr>
          )}
          <tr className="total-row grand-total-row">
            <td colSpan={8} style={{ textAlign: 'right', fontWeight: 700 }}>年間合計</td>
            <td style={{ fontWeight: 700 }}>{totalAnnual.toLocaleString()}円</td>
            <td></td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
};

export default PolicyTable;
