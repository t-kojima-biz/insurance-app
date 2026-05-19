'use client';

import React from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import ChartContainer from './ChartContainer';
import type { Policy } from '@/types';

interface CoverageChartProps {
  policies: Policy[];
  currentAge: number;
}

const formatAxisTick = (value: number | string) =>
  Number(value).toLocaleString('ja-JP', { maximumFractionDigits: 0 });

const CoverageChart: React.FC<CoverageChartProps> = ({ policies, currentAge }) => {
  const data = [];
  for (let age = currentAge; age <= 90; age++) {
    const dataPoint: any = { age };
    policies.forEach((policy) => {
      if (age < policy.policyEndAge || policy.policyEndAge === 999) {
        let amount = policy.deathBenefitDisease;

        if (policy.policyType === '収入保障保険') {
          const totalYears = policy.policyEndAge - policy.contractAge;
          const remainingYears = policy.policyEndAge - age;
          amount = (policy.deathBenefitDisease * remainingYears) / totalYears;
        }

        dataPoint[policy.id] = amount / 10000;
      } else {
        dataPoint[policy.id] = 0;
      }
    });
    data.push(dataPoint);
  }

  const colors = ['#a5b4fc', '#86efac', '#fde68a', '#fdba74'];

  return (
    <div style={{ width: '100%', marginTop: '20px' }}>
      <h3>死亡保障推移（積み上げグラフ）</h3>
      <ChartContainer height={300}>
        {(width, height) => (
          <AreaChart
            width={width}
            height={height}
            data={data}
            margin={{ top: 5, right: 30, left: 40, bottom: 20 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="age" />
            <YAxis
              label={{ value: '保障額 (万円)', angle: -90, position: 'insideLeft', offset: -30 }}
              tickFormatter={formatAxisTick}
              width={80}
            />
            <Tooltip
              formatter={(value: any) => [`${formatAxisTick(value)}万円`, '']}
            />
            <Legend
              verticalAlign="top"
              wrapperStyle={{ paddingBottom: '5px', fontWeight: 'bold', fontSize: '12px' }}
            />
            {policies.map((policy, index) => (
              policy.deathBenefitDisease > 0 && (
                <Area
                  key={policy.id}
                  type="monotone"
                  dataKey={policy.id}
                  name={`${policy.companyName} / ${policy.policyType}`}
                  stackId="1"
                  stroke={colors[index % colors.length]}
                  fill={colors[index % colors.length]}
                />
              )
            ))}
          </AreaChart>
        )}
      </ChartContainer>
    </div>
  );
};

export default CoverageChart;
