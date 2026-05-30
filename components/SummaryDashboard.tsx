import React from 'react';
import type { Policy } from '@/types';
import { Activity, CreditCard, Info, Shield } from 'lucide-react';
import { getActiveMonthlyPremium } from '@/utils/analysisUtils';

interface SummaryDashboardProps {
  policies: Policy[];
  currentAge: number | null;
}

const SummaryDashboard: React.FC<SummaryDashboardProps> = ({ policies, currentAge }) => {
  const totalMonthlyPremium = policies.reduce((sum, p) => {
    return sum + getActiveMonthlyPremium(p, currentAge);
  }, 0);
  const activeMonthlyPremiumCount = policies.filter(p => getActiveMonthlyPremium(p, currentAge) > 0).length;
  const monthlyPremiumNote = currentAge === null
    ? '一時払を除外。払込終了判定には生年月日が必要'
    : '一時払・払込終了済みは除外';

  const totalDeathBenefit = currentAge === null ? null : policies.reduce((sum, p) => {
    if (currentAge < p.policyEndAge || p.policyEndAge === 999) {
        let amount = p.deathBenefitDisease;
        if (p.policyType === '収入保障保険') {
            const totalYears = p.policyEndAge - p.contractAge;
            const remainingYears = p.policyEndAge - currentAge;
            amount = (p.deathBenefitDisease * remainingYears) / totalYears;
        }
        return sum + amount;
    }
    return sum;
  }, 0);

  const totalHospBenefit = currentAge === null ? null : policies.reduce((sum, p) => {
    if (currentAge < p.policyEndAge || p.policyEndAge === 999) {
        return sum + p.hospDayDisease;
    }
    return sum;
  }, 0);

  return (
    <div className="dashboard-grid">
      <div className="summary-card">
        <div className="card-header">
          <CreditCard className="icon" />
          <span>現在の月額保険料負担</span>
          <Info size={14} className="card-info-icon" aria-label={monthlyPremiumNote} />
        </div>
        <div className="card-value">{Math.round(totalMonthlyPremium).toLocaleString()}円</div>
        <div className="card-subtext">
          対象{activeMonthlyPremiumCount}件 / {monthlyPremiumNote}
        </div>
      </div>

      <div className="summary-card">
        <div className="card-header">
          <Shield className="icon" />
          <span>現在の死亡保障額</span>
        </div>
        <div className={`card-value ${totalDeathBenefit === null ? 'card-value-muted' : ''}`}>
          {totalDeathBenefit === null ? '年齢未入力' : `${(totalDeathBenefit / 10000).toLocaleString()}万円`}
        </div>
      </div>

      <div className="summary-card">
        <div className="card-header">
          <Activity className="icon" />
          <span>現在の入院日額</span>
        </div>
        <div className={`card-value ${totalHospBenefit === null ? 'card-value-muted' : ''}`}>
          {totalHospBenefit === null ? '年齢未入力' : `${totalHospBenefit.toLocaleString()}円`}
        </div>
      </div>
    </div>
  );
};

export default SummaryDashboard;
