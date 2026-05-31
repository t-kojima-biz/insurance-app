'use client';

import React, { useMemo } from 'react';
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

const COLORS = ['#a5b4fc', '#86efac', '#fde68a', '#fdba74'];

const CoverageChart: React.FC<CoverageChartProps> = ({ policies, currentAge }) => {
  const chartPolicies = useMemo(
    () => policies.filter(policy => policy.deathBenefitDisease > 0),
    [policies],
  );

  const chartOrderKey = useMemo(
    () => chartPolicies.map(policy => policy.id).join('|'),
    [chartPolicies],
  );

  const stackPolicies = useMemo(
    () => [...chartPolicies].reverse(),
    [chartPolicies],
  );

  const policyColors = useMemo(
    () => new Map(chartPolicies.map((policy, index) => [policy.id, COLORS[index % COLORS.length]])),
    [chartPolicies],
  );

  const data = useMemo(() => {
    const rows: Record<string, number>[] = [];
    for (let age = currentAge; age <= 90; age++) {
      const dataPoint: Record<string, number> = { age };
      chartPolicies.forEach((policy) => {
        if (age < policy.policyEndAge || policy.policyEndAge === 999) {
          let amount = policy.deathBenefitDisease;

          if (policy.policyType === '収入保障保険') {
            const totalYears = policy.policyEndAge - policy.contractAge;
            const remainingYears = policy.policyEndAge - age;
            amount = totalYears > 0 ? (policy.deathBenefitDisease * remainingYears) / totalYears : 0;
          }

          dataPoint[policy.id] = amount / 10000;
        } else {
          dataPoint[policy.id] = 0;
        }
      });
      rows.push(dataPoint);
    }
    return rows;
  }, [chartPolicies, currentAge]);

  const legendItems = chartPolicies.map((policy, index) => ({
    id: policy.id,
    color: policyColors.get(policy.id) ?? COLORS[index % COLORS.length],
    label: `${policy.companyName} / ${policy.policyType}`,
  }));

  return (
    <div style={{ width: '100%', marginTop: '20px' }}>
      <h3>死亡保障推移（積み上げグラフ）</h3>
      <ChartContainer height={300}>
        {(width, height) => (
          <AreaChart
            // Recharts keeps stacked series order internally, so remount when policy order changes.
            key={chartOrderKey}
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
              content={() => (
                <ul className="coverage-chart-legend">
                  {legendItems.map(item => (
                    <li key={item.id}>
                      <span style={{ backgroundColor: item.color }} />
                      {item.label}
                    </li>
                  ))}
                </ul>
              )}
            />
            {/* Render in reverse because Recharts stacks the first series at the bottom. */}
            {stackPolicies.map((policy) => {
              const color = policyColors.get(policy.id) ?? COLORS[0];
              return (
                <Area
                  key={policy.id}
                  type="monotone"
                  dataKey={policy.id}
                  name={`${policy.companyName} / ${policy.policyType}`}
                  stackId="1"
                  stroke={color}
                  fill={color}
                  isAnimationActive={false}
                />
              );
            })}
          </AreaChart>
        )}
      </ChartContainer>
    </div>
  );
};

export default CoverageChart;
