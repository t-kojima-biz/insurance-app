'use client';

import React from 'react';
import type { Policy, FamilyMember } from '@/types';
import { Calculator, MessageSquare, Landmark, ClipboardList } from 'lucide-react';
import {
  analyzePolicy,
  INSURANCE_TYPE_INFO,
  getMonthlyPremium,
} from '@/utils/analysisUtils';
import EvaluationBadge from '@/components/EvaluationBadge';
import PolicyMiniChart from '@/components/PolicyMiniChart';

interface PolicyAnalysisCardProps {
  policy: Policy;
  currentAge: number;
  familyMembers: FamilyMember[];
  onUpdateNote: (policyId: string, note: string) => void;
}

const PolicyAnalysisCard: React.FC<PolicyAnalysisCardProps> = ({ policy, currentAge, familyMembers, onUpdateNote }) => {
  const analysis = analyzePolicy(policy, currentAge);
  const typeInfo = INSURANCE_TYPE_INFO[policy.policyType];

  const getMemberName = (id: string) => {
    const member = familyMembers.find(m => m.id === id);
    return member ? member.name : '未設定';
  };

  const contractDate = new Date(policy.contractDate);
  const contractLabel = `${contractDate.getFullYear()}年${contractDate.getMonth() + 1}月`;

  const formatYen = (amount: number) => {
    if (amount >= 10000) return `${(amount / 10000).toLocaleString()}万円`;
    return `${amount.toLocaleString()}円`;
  };

  const monthly = getMonthlyPremium(policy);

  return (
    <div className={`policy-analysis-card ${analysis.isExpired ? 'expired-card' : ''}`}>
      <h3 className="pac-print-section-title">
        <ClipboardList size={20} />
        個々の保険の分析
      </h3>
      <div className="pac-header">
        <div className="pac-header-left">
          <span
            className="policy-type-badge"
            style={{ background: typeInfo.bgColor, color: typeInfo.color, borderColor: typeInfo.borderColor }}
          >
            {policy.policyType}
          </span>
          <span className="pac-company">{policy.companyName}</span>
          {analysis.isExpired && <span className="expired-badge">保障終了</span>}
        </div>
        <div className="pac-header-meta">
          <span>証券番号: {policy.policyNumber}</span>
          <span>契約: {contractLabel}</span>
          <span>契約年齢: {policy.contractAge}歳</span>
          <span>被保険者: {getMemberName(policy.insuredId)}</span>
        </div>
      </div>

      <div className="pac-body">
        <div className="pac-left">
          {(policy.deathBenefitDisease > 0 || policy.deathBenefitAccident > 0 || policy.hospDayDisease > 0 || policy.diagnosisBenefit > 0) && (
            <div className="pac-section">
              <h5>保障内容</h5>
              <div className="pac-data-grid">
                {policy.deathBenefitDisease > 0 && (
                  <div className="pac-data-row">
                    <span className="pac-data-label">死亡保障（疾病）</span>
                    <span className="pac-data-value">{formatYen(policy.deathBenefitDisease)}</span>
                  </div>
                )}
                {policy.deathBenefitAccident > 0 && policy.deathBenefitAccident !== policy.deathBenefitDisease && (
                  <div className="pac-data-row">
                    <span className="pac-data-label">死亡保障（災害）</span>
                    <span className="pac-data-value">{formatYen(policy.deathBenefitAccident)}</span>
                  </div>
                )}
                {policy.policyType === '収入保障保険' && analysis.currentDeathBenefit > 0 && (
                  <div className="pac-data-row highlight-row">
                    <span className="pac-data-label">現在の受取総額</span>
                    <span className="pac-data-value">{formatYen(Math.round(analysis.currentDeathBenefit))}</span>
                  </div>
                )}
                {policy.hospDayDisease > 0 && (
                  <div className="pac-data-row">
                    <span className="pac-data-label">入院日額（疾病）</span>
                    <span className="pac-data-value">{policy.hospDayDisease.toLocaleString()}円</span>
                  </div>
                )}
                {policy.hospDayAccident > 0 && policy.hospDayAccident !== policy.hospDayDisease && (
                  <div className="pac-data-row">
                    <span className="pac-data-label">入院日額（災害）</span>
                    <span className="pac-data-value">{policy.hospDayAccident.toLocaleString()}円</span>
                  </div>
                )}
                {policy.diagnosisBenefit > 0 && (
                  <div className="pac-data-row">
                    <span className="pac-data-label">診断一時金</span>
                    <span className="pac-data-value">{formatYen(policy.diagnosisBenefit)}</span>
                  </div>
                )}
                {policy.maturityBenefit > 0 && (
                  <div className="pac-data-row">
                    <span className="pac-data-label">満期保険金</span>
                    <span className="pac-data-value">{formatYen(policy.maturityBenefit)}</span>
                  </div>
                )}
              </div>
              <div className="pac-coverage-period">
                保障期間: {policy.policyEndAge === 999 ? '終身' : `${policy.policyEndAge}歳まで`}
              </div>
            </div>
          )}

          <div className="pac-section">
            <h5><Calculator size={14} /> コスト分析</h5>
            <div className="pac-data-grid">
              <div className="pac-data-row">
                <span className="pac-data-label">月額保険料</span>
                <span className="pac-data-value">
                  {policy.paymentFrequency === 'single' ? '一時払' : `${Math.round(monthly).toLocaleString()}円`}
                </span>
              </div>
              <div className="pac-data-row">
                <span className="pac-data-label">累計支払済</span>
                <span className="pac-data-value">{formatYen(Math.round(analysis.totalPremiumsPaid))}</span>
              </div>
              {analysis.remainingPremiums > 0 && (
                <div className="pac-data-row">
                  <span className="pac-data-label">残り支払額</span>
                  <span className="pac-data-value">{formatYen(Math.round(analysis.remainingPremiums))}</span>
                </div>
              )}
              <div className="pac-data-row">
                <span className="pac-data-label">総支払見込</span>
                <span className="pac-data-value">{formatYen(Math.round(analysis.projectedTotalPremiums))}</span>
              </div>
            </div>
          </div>

          {policy.policyType === '個人年金保険' && policy.maturityBenefit > 0 && (() => {
            const annuityStartAge = policy.paymentEndAge;
            const payoutEndAge = policy.policyEndAge === 999 ? annuityStartAge + 20 : policy.policyEndAge;
            const payoutPeriod = payoutEndAge - annuityStartAge;
            const annualPayout = payoutPeriod > 0 ? policy.maturityBenefit / payoutPeriod : 0;
            const returnRate = analysis.projectedTotalPremiums > 0
              ? (policy.maturityBenefit / analysis.projectedTotalPremiums * 100).toFixed(1)
              : '---';

            return (
              <div className="pac-section">
                <h5><Landmark size={14} /> 年金受取</h5>
                <div className="pac-data-grid">
                  <div className="pac-data-row">
                    <span className="pac-data-label">年金受取開始</span>
                    <span className="pac-data-value">{annuityStartAge}歳</span>
                  </div>
                  <div className="pac-data-row">
                    <span className="pac-data-label">受取期間</span>
                    <span className="pac-data-value">{policy.policyEndAge === 999 ? '終身' : `${payoutPeriod}年間`}</span>
                  </div>
                  <div className="pac-data-row">
                    <span className="pac-data-label">年間年金額</span>
                    <span className="pac-data-value">{formatYen(Math.round(annualPayout))}</span>
                  </div>
                  <div className="pac-data-row">
                    <span className="pac-data-label">年金受取総額</span>
                    <span className="pac-data-value">{formatYen(policy.maturityBenefit)}</span>
                  </div>
                  <div className="pac-data-row highlight-row">
                    <span className="pac-data-label">返戻率</span>
                    <span className="pac-data-value">{returnRate}%</span>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>

        <div className="pac-right">
          <PolicyMiniChart policy={policy} currentAge={currentAge} />

          <div className="pac-evaluations">
            {analysis.evaluations.map((ev, i) => (
              <EvaluationBadge key={i} evaluation={ev} />
            ))}
          </div>

          <div className="pac-consultant-note">
            <h5><MessageSquare size={14} /> コンサルタントメモ</h5>
            <textarea
              className="consultant-note-input"
              value={policy.consultantNote ?? analysis.consultantNote}
              onChange={(e) => onUpdateNote(policy.id, e.target.value)}
              rows={4}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default PolicyAnalysisCard;
