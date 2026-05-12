import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Policy } from '../types';

interface CostChartProps {
  policies: Policy[];
  currentAge: number;
}

const CostChart: React.FC<CostChartProps> = ({ policies, currentAge }) => {
  const data = [];
  for (let age = currentAge; age <= 80; age++) {
    let totalCost = 0;
    policies.forEach((policy) => {
      if (age < policy.paymentEndAge || policy.paymentEndAge === 999) {
        totalCost += policy.paymentFrequency === 'monthly' ? policy.premiumAmount : policy.premiumAmount / 12;
      }
    });
    data.push({ age, cost: Math.round(totalCost) });
  }

  return (
    <div style={{ width: '100%', height: 350, marginTop: '40px' }}>
      <h3>将来の保険料負担推移（月額合計）</h3>
      <ResponsiveContainer>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="age" />
          <YAxis />
          <Tooltip formatter={(value: any) => [`${value.toLocaleString()}円`, '合計保険料']} />
          <Bar dataKey="cost" fill="#f6ad55" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default CostChart;
