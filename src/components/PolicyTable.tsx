import React from 'react';
import type { Policy, FamilyMember } from '../types';
import { Edit2, Trash } from 'lucide-react';

interface PolicyTableProps {
  policies: Policy[];
  familyMembers: FamilyMember[];
  onDelete: (id: string) => void;
  onEdit: (policy: Policy) => void;
  onAddNew: () => void;
}

const PolicyTable: React.FC<PolicyTableProps> = ({ policies, familyMembers, onDelete, onEdit, onAddNew }) => {
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

  return (
    <div className="table-container">
      <div className="table-header-row">
        <h3>証券一覧</h3>
        <button onClick={onAddNew} className="add-button no-print">+ 新しい保険証券を登録</button>
      </div>
      <table className="policy-table">
        <thead>
          <tr>
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
          {policies.map((policy) => (
            <tr key={policy.id}>
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
              <td colSpan={6} style={{ textAlign: 'right', fontWeight: 700 }}>月払計</td>
              <td style={{ fontWeight: 700 }}>{monthlyTotal.toLocaleString()}円/月</td>
              <td></td>
            </tr>
          )}
          {annualTotal > 0 && (
            <tr className="total-row">
              <td colSpan={6} style={{ textAlign: 'right', fontWeight: 700 }}>年払計</td>
              <td style={{ fontWeight: 700 }}>{annualTotal.toLocaleString()}円/年</td>
              <td></td>
            </tr>
          )}
          <tr className="total-row grand-total-row">
            <td colSpan={6} style={{ textAlign: 'right', fontWeight: 700 }}>年間合計</td>
            <td style={{ fontWeight: 700 }}>{totalAnnual.toLocaleString()}円</td>
            <td></td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
};

export default PolicyTable;
