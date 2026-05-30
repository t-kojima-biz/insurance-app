'use client';

import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import ChartContainer from './ChartContainer';
import type { Policy } from '@/types';
import { getActiveMonthlyPremium } from '@/utils/analysisUtils';

interface CostChartProps {
  policies: Policy[];
  currentAge: number;
}

const formatAxisTick = (value: number | string) =>
  Number(value).toLocaleString('ja-JP', { maximumFractionDigits: 0 });

const CostChart: React.FC<CostChartProps> = ({ policies, currentAge }) => {
  const data: { age: number; cost: number }[] = [];
  for (let age = currentAge; age <= 80; age++) {
    let totalCost = 0;
    policies.forEach((policy) => {
      totalCost += getActiveMonthlyPremium(policy, age);
    });
    data.push({ age, cost: Math.round(totalCost) });
  }

  return (
    <div style={{ width: '100%', marginTop: '40px' }}>
      <h3>将来の月額保険料負担推移</h3>
      <ChartContainer height={300}>
        {(width, height) => (
          <BarChart width={width} height={height} data={data} margin={{ top: 5, right: 30, left: 20, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="age" />
            <YAxis tickFormatter={formatAxisTick} width={80} />
            <Tooltip formatter={(value: any) => [`${formatAxisTick(value)}円`, '月額負担']} />
            <Bar dataKey="cost" fill="#f6ad55" />
          </BarChart>
        )}
      </ChartContainer>
    </div>
  );
};

export default CostChart;
