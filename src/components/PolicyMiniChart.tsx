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
import type { Policy } from '../types';
import { INSURANCE_TYPE_INFO } from '../utils/analysisUtils';

interface PolicyMiniChartProps {
  policy: Policy;
  currentAge: number;
}

const PolicyMiniChart: React.FC<PolicyMiniChartProps> = ({ policy, currentAge }) => {
  const hasCoverage = policy.deathBenefitDisease > 0 || policy.hospDayDisease > 0;
  if (!hasCoverage && policy.maturityBenefit <= 0) return null;

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

  const typeInfo = INSURANCE_TYPE_INFO[policy.policyType];
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
            width={45}
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
            label={{ value: '現在', position: 'top', fontSize: 11, fill: '#e53e3e' }}
          />
          {policy.paymentEndAge !== 999 && (
            <ReferenceLine
              x={policy.paymentEndAge}
              stroke="#38a169"
              strokeWidth={1}
              strokeDasharray="4 4"
              label={{ value: '払込完了', position: 'top', fontSize: 10, fill: '#38a169' }}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};

export default PolicyMiniChart;
