import React from 'react';
import type { Policy, FamilyMember } from '@/types';
import { ClipboardList } from 'lucide-react';
import InsuranceTypeOverview from '@/components/InsuranceTypeOverview';
import PolicyAnalysisCard from '@/components/PolicyAnalysisCard';

interface PolicyAnalysisSectionProps {
  caseId: string;
  policies: Policy[];
  currentAge: number;
  familyMembers: FamilyMember[];
  onUpdateNote: (policyId: string, note: string) => void;
}

const PolicyAnalysisSection: React.FC<PolicyAnalysisSectionProps> = ({ caseId, policies, currentAge, familyMembers, onUpdateNote }) => {
  if (policies.length === 0) return null;

  return (
    <div className="analysis-section">
      <InsuranceTypeOverview caseId={caseId} policies={policies} currentAge={currentAge} />

      <div className="individual-analysis">
        <h3 className="analysis-section-title">
          <ClipboardList size={20} />
          個々の保険の分析
        </h3>

        <div className="analysis-cards-list">
          {policies.map((policy) => (
            <div key={policy.id} className="analysis-card-page">
              <PolicyAnalysisCard
                policy={policy}
                currentAge={currentAge}
                familyMembers={familyMembers}
                onUpdateNote={onUpdateNote}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PolicyAnalysisSection;
