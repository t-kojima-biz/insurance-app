import React from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle } from 'lucide-react';
import type { EvaluationResult } from '@/utils/analysisUtils';

const ratingConfig = {
  good: { icon: CheckCircle2, color: '#166534', bgColor: '#dcfce7', borderColor: '#86efac' },
  caution: { icon: AlertTriangle, color: '#92400e', bgColor: '#fef3c7', borderColor: '#fcd34d' },
  warning: { icon: AlertCircle, color: '#991b1b', bgColor: '#fee2e2', borderColor: '#fca5a5' },
};

const EvaluationBadge: React.FC<{ evaluation: EvaluationResult }> = ({ evaluation }) => {
  const config = ratingConfig[evaluation.rating];
  const Icon = config.icon;

  return (
    <div className="eval-badge" style={{ background: config.bgColor, borderColor: config.borderColor, color: config.color }}>
      <div className="eval-badge-header">
        <Icon size={16} />
        <span className="eval-badge-label">{evaluation.label}</span>
      </div>
      <span className="eval-badge-text">{evaluation.text}</span>
    </div>
  );
};

export default EvaluationBadge;
