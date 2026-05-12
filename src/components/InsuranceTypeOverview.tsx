import React from 'react';
import type { Policy, PolicyType } from '../types';
import {
  Landmark,
  TrendingDown,
  LineChart,
  HeartPulse,
  ShieldCheck,
  PiggyBank,
  BookOpen,
  AlertTriangle,
  Lightbulb,
  Layers,
} from 'lucide-react';
import {
  INSURANCE_TYPE_INFO,
  analyzePortfolio,
  getMonthlyPremium,
  getCurrentDeathBenefit,
  type PortfolioInsight,
} from '../utils/analysisUtils';

interface InsuranceTypeOverviewProps {
  policies: Policy[];
  currentAge: number;
}

const iconMap: Record<string, React.FC<{ size?: number }>> = {
  Landmark, TrendingDown, LineChart, HeartPulse, ShieldCheck, PiggyBank,
};

const insightIconMap: Record<PortfolioInsight['type'], React.FC<{ size?: number }>> = {
  gap: AlertTriangle,
  recommendation: Lightbulb,
  redundancy: Layers,
};

const insightColorMap: Record<PortfolioInsight['type'], { bg: string; border: string; color: string }> = {
  gap: { bg: '#fee2e2', border: '#fca5a5', color: '#991b1b' },
  recommendation: { bg: '#dbeafe', border: '#93c5fd', color: '#1e40af' },
  redundancy: { bg: '#fef3c7', border: '#fcd34d', color: '#92400e' },
};

const InsuranceTypeOverview: React.FC<InsuranceTypeOverviewProps> = ({ policies, currentAge }) => {
  const grouped = policies.reduce<Record<PolicyType, Policy[]>>((acc, p) => {
    if (!acc[p.policyType]) acc[p.policyType] = [];
    acc[p.policyType].push(p);
    return acc;
  }, {} as Record<PolicyType, Policy[]>);

  const insights = analyzePortfolio(policies, currentAge);

  return (
    <div className="type-overview-section">
      <h3 className="analysis-section-title">
        <BookOpen size={20} />
        保険種類の総合説明
      </h3>

      <div className="type-overview-grid">
        {(Object.entries(grouped) as [PolicyType, Policy[]][]).map(([type, typePolicies]) => {
          const info = INSURANCE_TYPE_INFO[type];
          const Icon = iconMap[info.iconName];
          const totalMonthly = typePolicies.reduce((sum, p) => sum + getMonthlyPremium(p), 0);
          const totalDeathBenefit = typePolicies.reduce((sum, p) => sum + getCurrentDeathBenefit(p, currentAge), 0);
          const totalHosp = typePolicies.reduce((sum, p) => sum + p.hospDayDisease, 0);

          return (
            <div key={type} className="type-overview-card" style={{ borderTopColor: info.borderColor }}>
              <div className="toc-header">
                <div className="toc-title">
                  {Icon && <Icon size={20} />}
                  <span>{type}</span>
                </div>
                <span className="toc-count" style={{ background: info.bgColor, color: info.color }}>
                  {typePolicies.length}件
                </span>
              </div>

              <p className="toc-description">{info.longDescription}</p>

              <div className="toc-purpose">
                <span className="toc-purpose-label">目的</span>
                <span>{info.purpose}</span>
              </div>

              <div className="toc-stats">
                {totalDeathBenefit > 0 && (
                  <div className="toc-stat">
                    <span className="toc-stat-label">合計保障額</span>
                    <span className="toc-stat-value">{(totalDeathBenefit / 10000).toLocaleString()}万円</span>
                  </div>
                )}
                {totalHosp > 0 && (
                  <div className="toc-stat">
                    <span className="toc-stat-label">入院日額合計</span>
                    <span className="toc-stat-value">{totalHosp.toLocaleString()}円</span>
                  </div>
                )}
                <div className="toc-stat">
                  <span className="toc-stat-label">月額保険料</span>
                  <span className="toc-stat-value">{Math.round(totalMonthly).toLocaleString()}円</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {insights.length > 0 && (
        <div className="portfolio-insights">
          <h4>ポートフォリオ診断</h4>
          <div className="insights-list">
            {insights.map((insight, i) => {
              const InsightIcon = insightIconMap[insight.type];
              const colors = insightColorMap[insight.type];
              return (
                <div key={i} className="insight-item" style={{ background: colors.bg, borderColor: colors.border, color: colors.color }}>
                  <InsightIcon size={16} />
                  <span>{insight.text}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default InsuranceTypeOverview;
