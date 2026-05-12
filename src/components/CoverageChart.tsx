import React from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import type { Policy } from '../types';

interface CoverageChartProps {
  policies: Policy[];
  currentAge: number;
}

const CoverageChart: React.FC<CoverageChartProps> = ({ policies, currentAge }) => {
  const data = [];
  for (let age = currentAge; age <= 90; age++) {
    const dataPoint: any = { age };
    policies.forEach((policy) => {
      if (age < policy.policyEndAge || policy.policyEndAge === 999) {
        let amount = policy.deathBenefitDisease;
        
        // Logic for Income Protection (linear decrease)
        if (policy.policyType === '収入保障保険') {
          const totalYears = policy.policyEndAge - policy.contractAge;
          const remainingYears = policy.policyEndAge - age;
          amount = (policy.deathBenefitDisease * remainingYears) / totalYears;
        }
        
        dataPoint[policy.id] = amount / 10000; // Convert to Man-yen
      } else {
        dataPoint[policy.id] = 0;
      }
    });
    data.push(dataPoint);
  }

  const colors = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300'];

  return (
    <div style={{ width: '100%', height: 350, marginTop: '20px' }}>
      <h3>死亡保障推移（積み上げグラフ）</h3>
      <ResponsiveContainer>
        <AreaChart
          data={data}
          margin={{ top: 10, right: 30, left: 40, bottom: 20 }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey="age" 
            label={{ value: '年齢', position: 'insideBottomRight', offset: -10 }} 
          />
          <YAxis 
            label={{ value: '保障額 (万円)', angle: -90, position: 'insideLeft', offset: -30 }} 
          />
          <Tooltip 
            formatter={(value: any) => [`${Math.round(value)}万円`, '']}
          />
          <Legend 
            wrapperStyle={{ paddingTop: '20px', fontWeight: 'bold', fontSize: '14px' }}
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
      </ResponsiveContainer>
    </div>
  );
};

export default CoverageChart;
