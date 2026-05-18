import React from 'react';
import type { Policy } from '@/types';
import { CreditCard, Shield, Activity } from 'lucide-react';

interface SummaryDashboardProps {
  policies: Policy[];
  currentAge: number;
}

const SummaryDashboard: React.FC<SummaryDashboardProps> = ({ policies, currentAge }) => {
  const totalMonthlyPremium = policies.reduce((sum, p) => {
    return sum + (p.paymentFrequency === 'monthly' ? p.premiumAmount : p.premiumAmount / 12);
  }, 0);

  const totalDeathBenefit = policies.reduce((sum, p) => {
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

  const totalHospBenefit = policies.reduce((sum, p) => {
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
          <span>合計月額保険料</span>
        </div>
        <div className="card-value">{Math.round(totalMonthlyPremium).toLocaleString()}円</div>
      </div>

      <div className="summary-card">
        <div className="card-header">
          <Shield className="icon" />
          <span>現在の死亡保障額</span>
        </div>
        <div className="card-value">{(totalDeathBenefit / 10000).toLocaleString()}万円</div>
      </div>

      <div className="summary-card">
        <div className="card-header">
          <Activity className="icon" />
          <span>現在の入院日額</span>
        </div>
        <div className="card-value">{totalHospBenefit.toLocaleString()}円</div>
      </div>
    </div>
  );
};

export default SummaryDashboard;
