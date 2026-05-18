'use client';

import React from 'react';
import {
  ComposedChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import type { Policy } from '@/types';
import { INSURANCE_TYPE_INFO } from '@/utils/analysisUtils';

interface PolicyMiniChartProps {
  policy: Policy;
  currentAge: number;
}

const PolicyMiniChart: React.FC<PolicyMiniChartProps> = ({ policy, currentAge }) => {
  const isPension = policy.policyType === '個人年金保険';
  const hasCoverage = policy.deathBenefitDisease > 0 || policy.hospDayDisease > 0;
  if (!isPension && !hasCoverage && policy.maturityBenefit <= 0) return null;

  const typeInfo = INSURANCE_TYPE_INFO[policy.policyType];

  if (isPension) {
    return <PensionMiniChart policy={policy} currentAge={currentAge} typeInfo={typeInfo} />;
  }

  const startAge = policy.contractAge;
  const endAge = policy.policyEndAge === 999 ? Math.max(90, currentAge + 20) : Math.max(policy.policyEndAge + 5, currentAge + 5);

  const data = [];
  for (let age = startAge; age <= endAge; age++) {
    const inCoverage = policy.policyEndAge === 999 || age < policy.policyEndAge;
    let value = 0;

    if (inCoverage) {
      if (policy.deathBenefitDisease > 0) {
        if (policy.policyType === '収入保障保険') {
          const totalYears = policy.policyEndAge - policy.contractAge;
          const remaining = policy.policyEndAge - age;
          value = totalYears > 0 ? (policy.deathBenefitDisease * remaining) / totalYears / 10000 : 0;
        } else {
          value = policy.deathBenefitDisease / 10000;
        }
      } else if (policy.hospDayDisease > 0) {
        value = policy.hospDayDisease;
      }
    }

    data.push({ age, value });
  }

  const isHosp = policy.deathBenefitDisease <= 0 && policy.hospDayDisease > 0;
  const unit = isHosp ? '円/日' : '万円';

  return (
    <div className="mini-chart-container">
      <ResponsiveContainer width="100%" height={200}>
        <ComposedChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis
            dataKey="age"
            tick={{ fontSize: 11 }}
            label={{ value: '年齢', position: 'insideBottomRight', offset: -5, fontSize: 11 }}
          />
          <YAxis
            tick={{ fontSize: 11 }}
            tickFormatter={(v) => Number(v).toLocaleString()}
            width={55}
            label={{ value: unit, angle: -90, position: 'insideLeft', offset: 5, fontSize: 11 }}
          />
         <Tooltip
  formatter={(value) => [
    `${Number(value ?? 0).toLocaleString()}${unit}`,
    '保障額',
  ]}
  labelFormatter={(label) => `${label}歳`}
/>
          <Area
            type="stepAfter"
            dataKey="value"
            stroke={typeInfo.borderColor}
            fill={typeInfo.bgColor}
            strokeWidth={2}
          />
          <ReferenceLine
            x={currentAge}
            stroke="#e53e3e"
            strokeWidth={2}
            strokeDasharray="4 4"
          />
          {policy.paymentEndAge !== 999 && (
            <ReferenceLine
              x={policy.paymentEndAge}
              stroke="#38a169"
              strokeWidth={1}
              strokeDasharray="4 4"
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
      <div className="mini-chart-legend">
        <span className="mini-chart-legend-item">
          <span className="mini-chart-legend-line" style={{ borderColor: '#e53e3e' }} />
          現在（{currentAge}歳）
        </span>
        {policy.paymentEndAge !== 999 && (
          <span className="mini-chart-legend-item">
            <span className="mini-chart-legend-line" style={{ borderColor: '#38a169' }} />
            払込完了（{policy.paymentEndAge}歳）
          </span>
        )}
      </div>
    </div>
  );
};

const PensionMiniChart: React.FC<{
  policy: Policy;
  currentAge: number;
  typeInfo: (typeof INSURANCE_TYPE_INFO)[keyof typeof INSURANCE_TYPE_INFO];
}> = ({ policy, currentAge }) => {
  const startAge = policy.contractAge;
  const annuityStartAge = policy.paymentEndAge;
  const endAge = policy.policyEndAge === 999 ? annuityStartAge + 20 : policy.policyEndAge;
  const payoutPeriod = endAge - annuityStartAge;
  const annualPayout = payoutPeriod > 0 ? policy.maturityBenefit / payoutPeriod : 0;

  const data = [];
  for (let age = startAge; age <= endAge; age++) {
    let accumulation = 0;
    let payout = 0;

    if (age < annuityStartAge) {
      if (policy.paymentFrequency === 'single') {
        accumulation = policy.premiumAmount / 10000;
      } else {
        const years = age - startAge;
        accumulation = (policy.annualPremium * years) / 10000;
      }
    } else if (age <= endAge) {
      payout = annualPayout / 10000;
    }

    data.push({ age, accumulation, payout });
  }

  return (
    <div className="mini-chart-container">
      <ResponsiveContainer width="100%" height={200}>
        <ComposedChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis
            dataKey="age"
            tick={{ fontSize: 11 }}
            label={{ value: '年齢', position: 'insideBottomRight', offset: -5, fontSize: 11 }}
          />
          <YAxis
            tick={{ fontSize: 11 }}
            tickFormatter={(v) => Number(v).toLocaleString()}
            width={55}
            label={{ value: '万円', angle: -90, position: 'insideLeft', offset: 5, fontSize: 11 }}
          />
          <Tooltip
  formatter={(value, name) => [
    `${Number(value ?? 0).toLocaleString()}万円`,
    name === 'accumulation' ? '年金原資' : '年金受取額',
  ]}
  labelFormatter={(label) => `${label}歳`}
/>
          <Area
            type="monotone"
            dataKey="accumulation"
            name="年金原資"
            stroke="#f59e0b"
            fill="#fef3c7"
            strokeWidth={2}
          />
          <Area
            type="stepAfter"
            dataKey="payout"
            name="年金受取額"
            stroke="#6b8e23"
            fill="#e8f5e0"
            strokeWidth={2}
          />
          <ReferenceLine
            x={currentAge}
            stroke="#e53e3e"
            strokeWidth={2}
            strokeDasharray="4 4"
          />
          <ReferenceLine
            x={annuityStartAge}
            stroke="#38a169"
            strokeWidth={1}
            strokeDasharray="4 4"
          />
        </ComposedChart>
      </ResponsiveContainer>
      <div className="mini-chart-legend">
        <span className="mini-chart-legend-item">
          <span className="mini-chart-legend-line" style={{ borderColor: '#e53e3e' }} />
          現在（{currentAge}歳）
        </span>
        <span className="mini-chart-legend-item">
          <span className="mini-chart-legend-line" style={{ borderColor: '#38a169' }} />
          受取開始（{annuityStartAge}歳）
        </span>
      </div>
    </div>
  );
};

export default PolicyMiniChart;
