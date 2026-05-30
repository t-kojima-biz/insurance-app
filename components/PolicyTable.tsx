'use client';

import React, { useState, useMemo } from 'react';
import type { Policy, FamilyMember } from '@/types';
import { Edit2, GripVertical, Trash, Search, X } from 'lucide-react';
import { getActiveMonthlyPremium, getMonthlyPremium, isExpired, isPaidUp } from '@/utils/analysisUtils';

type DropPosition = 'before' | 'after';

interface PolicyTableProps {
  policies: Policy[];
  familyMembers: FamilyMember[];
  currentAge: number | null;
  onDelete: (id: string) => void;
  onEdit: (policy: Policy) => void;
  onAddNew: () => void;
  onReorder: (draggedId: string, targetId: string, position: DropPosition) => void;
}

const PolicyTable: React.FC<PolicyTableProps> = ({ policies, familyMembers, currentAge, onDelete, onEdit, onAddNew, onReorder }) => {
  const [draggedPolicyId, setDraggedPolicyId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ id: string; position: DropPosition } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const getMemberName = (id: string) => {
    const member = familyMembers.find(m => m.id === id);
    return member ? `${member.relationship} (${member.name})` : '未設定';
  };

  const currentMonthlyBurden = policies.reduce((sum, p) => sum + getActiveMonthlyPremium(p, currentAge), 0);
  const totalDeathBenefit = policies.reduce((sum, p) => sum + p.deathBenefitDisease, 0);
  const totalHospDay = policies.reduce((sum, p) => sum + p.hospDayDisease, 0);
  const monthlyBurdenTotalNote = currentAge === null
    ? '一時払を除外。払込終了判定には生年月日が必要'
    : '対象: 月払・年払（払込中）';

  const freqLabel = (f: string) => f === 'monthly' ? '月払' : f === 'annual' ? '年払' : '一時払';

  const getPaymentEndLabel = (policy: Policy) =>
    policy.paymentEndAge === 999 ? '終身払い' : `${policy.paymentEndAge}歳まで`;

  const getPremiumMeta = (policy: Policy) => {
    if (policy.paymentFrequency === 'single') return '一時払・月額負担対象外';
    if (policy.paymentFrequency === 'annual') {
      return `年払・月換算${Math.round(getMonthlyPremium(policy)).toLocaleString()}円`;
    }
    return `月払・${getPaymentEndLabel(policy)}`;
  };

  const getStatusBadges = (policy: Policy) => {
    const badges: Array<{ label: string; className: string }> = [
      { label: freqLabel(policy.paymentFrequency), className: `is-${policy.paymentFrequency}` },
    ];
    if (currentAge !== null && policy.paymentFrequency !== 'single' && isPaidUp(policy, currentAge)) {
      badges.push({ label: '払込済', className: 'is-paid-up' });
    }
    if (currentAge !== null && isExpired(policy, currentAge)) {
      badges.push({ label: '保障終了', className: 'is-expired' });
    }
    return badges;
  };

  const filteredPolicies = useMemo(() => {
    if (!searchQuery.trim()) return policies;
    const q = searchQuery.trim().toLowerCase();
    return policies.filter(p =>
      p.companyName.toLowerCase().includes(q) ||
      p.policyType.toLowerCase().includes(q) ||
      (p.policyNumber && p.policyNumber.toLowerCase().includes(q)) ||
      getMemberName(p.insuredId).toLowerCase().includes(q) ||
      getMemberName(p.beneficiaryId).toLowerCase().includes(q)
    );
  }, [policies, searchQuery, familyMembers]);

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
        <div className="table-header-actions no-print">
          {policies.length > 3 && (
            <div className="policy-search">
              <Search size={14} />
              <input
                type="text"
                placeholder="会社名・種類・番号で検索..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button className="policy-search-clear" onClick={() => setSearchQuery('')}>
                  <X size={14} />
                </button>
              )}
            </div>
          )}
          <button onClick={onAddNew} className="add-button">+ 新しい保険証券を登録</button>
        </div>
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
          {filteredPolicies.map((policy) => {
            const originalIndex = policies.indexOf(policy);
            return (
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
              <td className="order-cell">{originalIndex + 1}</td>
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
              <td>
                <div className="premium-cell">
                  <div className="premium-main">{policy.premiumAmount.toLocaleString()}円</div>
                  <div className="premium-meta">{getPremiumMeta(policy)}</div>
                  <div className="policy-status-badges">
                    {getStatusBadges(policy).map(badge => (
                      <span
                        key={`${policy.id}-${badge.className}`}
                        className={`policy-status-badge ${badge.className}`}
                      >
                        {badge.label}
                      </span>
                    ))}
                  </div>
                </div>
              </td>
              <td className="actions-cell">
                <button onClick={() => onEdit(policy)} className="edit-icon-btn" title="編集"><Edit2 size={16} /></button>
                <button onClick={() => onDelete(policy.id)} className="delete-icon-btn" title="削除"><Trash size={16} /></button>
              </td>
            </tr>
          );
          })}
        </tbody>
        <tfoot>
          <tr className="total-row">
            <td className="order-cell"></td>
            <td className="drag-cell"></td>
            <td></td>
            <td></td>
            <td></td>
            <td style={{ fontWeight: 700 }}>{totalDeathBenefit > 0 ? `${(totalDeathBenefit / 10000).toLocaleString()}万円` : '-'}</td>
            <td style={{ fontWeight: 700 }}>{totalHospDay > 0 ? `${totalHospDay.toLocaleString()}円` : '-'}</td>
            <td style={{ textAlign: 'right', fontWeight: 700 }}>
              <div className="total-label">
                <strong>現在月額負担計</strong>
                <span>{monthlyBurdenTotalNote}</span>
              </div>
            </td>
            <td style={{ fontWeight: 700 }}>{currentMonthlyBurden > 0 ? `${Math.round(currentMonthlyBurden).toLocaleString()}円/月` : '-'}</td>
            <td className="actions-cell"></td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
};

export default PolicyTable;
