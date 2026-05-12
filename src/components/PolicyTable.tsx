import React from 'react';
import { Policy, FamilyMember } from '../types';
import { Edit2, Trash } from 'lucide-react';

interface PolicyTableProps {
  policies: Policy[];
  familyMembers: FamilyMember[];
  onDelete: (id: string) => void;
  onEdit: (policy: Policy) => void;
}

const PolicyTable: React.FC<PolicyTableProps> = ({ policies, familyMembers, onDelete, onEdit }) => {
  const getMemberName = (id: string) => {
    const member = familyMembers.find(m => m.id === id);
    return member ? `${member.relationship} (${member.name})` : '未設定';
  };

  return (
    <div className="table-container">
      <h3>証券一覧</h3>
      <table className="policy-table">
        <thead>
          <tr>
            <th>被保険者</th>
            <th>受取人</th>
            <th>保険会社</th>
            <th>保険種類</th>
            <th>死亡保障</th>
            <th>入院日額</th>
            <th>保険期間</th>
            <th>保険料</th>
            <th className="actions-col">操作</th>
          </tr>
        </thead>
        <tbody>
          {policies.map((policy) => (
            <tr key={policy.id}>
              <td>{getMemberName(policy.insuredId)}</td>
              <td>{getMemberName(policy.beneficiaryId)}</td>
              <td>{policy.companyName}</td>
              <td>{policy.policyType}</td>
              <td>{policy.deathBenefitDisease > 0 ? `${(policy.deathBenefitDisease / 10000).toLocaleString()}万円` : '-'}</td>
              <td>{policy.hospDayDisease > 0 ? `${policy.hospDayDisease.toLocaleString()}円` : '-'}</td>
              <td>{policy.policyEndAge === 999 ? '終身' : `${policy.policyEndAge}歳迄`}</td>
              <td>{policy.premiumAmount.toLocaleString()}円 ({policy.paymentFrequency === 'monthly' ? '月払' : policy.paymentFrequency === 'annual' ? '年払' : '一時払'})</td>
              <td className="actions-cell">
                <button onClick={() => onEdit(policy)} className="edit-icon-btn" title="編集"><Edit2 size={16} /></button>
                <button onClick={() => onDelete(policy.id)} className="delete-icon-btn" title="削除"><Trash size={16} /></button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default PolicyTable;
