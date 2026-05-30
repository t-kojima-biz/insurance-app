'use client';

import React, { useState, useEffect, useRef } from 'react';
import type { Policy, PolicyType } from '@/types';
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
  Trash,
  Plus,
  RotateCcw,
  Pencil,
  Check,
  X,
} from 'lucide-react';
import {
  INSURANCE_TYPE_INFO,
  analyzePortfolio,
  getActiveMonthlyPremium,
  getCurrentDeathBenefit,
  type PortfolioInsight,
} from '@/utils/analysisUtils';
import {
  fetchInsuranceTypeDescriptions,
  updateInsuranceTypeDescription,
  type InsuranceTypeDescription,
  fetchPortfolioInsights,
  savePortfolioInsights,
  resetPortfolioInsights,
  type PortfolioInsightData,
} from '@/lib/api';

interface EditableInsight extends PortfolioInsight {
  id: string;
  isCustom?: boolean;
}

interface InsuranceTypeOverviewProps {
  caseId: string;
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

const insightTypeLabels: Record<PortfolioInsight['type'], string> = {
  gap: 'ギャップ',
  recommendation: '推奨',
  redundancy: '重複',
};

let nextId = 1;
const genId = () => `insight-${nextId++}`;

const InsuranceTypeOverview: React.FC<InsuranceTypeOverviewProps> = ({ caseId, policies, currentAge }) => {
  const grouped = policies.reduce<Record<PolicyType, Policy[]>>((acc, p) => {
    if (!acc[p.policyType]) acc[p.policyType] = [];
    acc[p.policyType].push(p);
    return acc;
  }, {} as Record<PolicyType, Policy[]>);

  const [editableInsights, setEditableInsights] = useState<EditableInsight[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);
  const insightsLoadedRef = useRef(false);

  const [descriptions, setDescriptions] = useState<Map<string, InsuranceTypeDescription>>(new Map());
  const [editingType, setEditingType] = useState<PolicyType | null>(null);
  const [editDesc, setEditDesc] = useState({ longDescription: '', purpose: '' });
  const [savingType, setSavingType] = useState(false);

  useEffect(() => {
    fetchInsuranceTypeDescriptions().then(list => {
      setDescriptions(new Map(list.map(d => [d.policyType, d])));
    }).catch(() => {});
  }, []);

  const getDescription = (type: PolicyType) => {
    const saved = descriptions.get(type);
    return {
      longDescription: saved?.longDescription ?? INSURANCE_TYPE_INFO[type].longDescription,
      purpose: saved?.purpose ?? INSURANCE_TYPE_INFO[type].purpose,
    };
  };

  const handleStartEditType = (type: PolicyType) => {
    const desc = getDescription(type);
    setEditingType(type);
    setEditDesc({ longDescription: desc.longDescription, purpose: desc.purpose });
  };

  const handleSaveType = async () => {
    if (!editingType) return;
    setSavingType(true);
    try {
      const result = await updateInsuranceTypeDescription(editingType, editDesc.longDescription, editDesc.purpose);
      setDescriptions(prev => new Map(prev).set(editingType, result));
      setEditingType(null);
    } catch {
    } finally {
      setSavingType(false);
    }
  };

  const persistInsights = (insights: EditableInsight[]) => {
    savePortfolioInsights(caseId, insights.map(i => ({
      type: i.type,
      text: i.text,
      isCustom: !!i.isCustom,
    }))).catch(() => {});
  };

  useEffect(() => {
    insightsLoadedRef.current = false;
    fetchPortfolioInsights(caseId).then(({ insights, hasData }) => {
      if (hasData && insights.length > 0) {
        setEditableInsights(insights.map(i => ({
          id: i.id || genId(),
          type: i.type,
          text: i.text,
          isCustom: i.isCustom,
        })));
      } else {
        const auto = analyzePortfolio(policies, currentAge);
        const mapped = auto.map(a => ({ ...a, id: genId(), isCustom: false }));
        setEditableInsights(mapped);
        if (policies.length > 0) persistInsights(mapped);
      }
      insightsLoadedRef.current = true;
    }).catch(() => {
      const auto = analyzePortfolio(policies, currentAge);
      setEditableInsights(auto.map(a => ({ ...a, id: genId(), isCustom: false })));
      insightsLoadedRef.current = true;
    });
  }, [caseId]);

  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
    }
  }, [editingId]);

  const handleDelete = (id: string) => {
    setEditableInsights(prev => {
      const next = prev.filter(i => i.id !== id);
      persistInsights(next);
      return next;
    });
  };

  const handleStartEdit = (insight: EditableInsight) => {
    setEditingId(insight.id);
    setEditText(insight.text);
  };

  const handleSaveEdit = (id: string) => {
    if (editText.trim()) {
      setEditableInsights(prev => {
        const next = prev.map(i => i.id === id ? { ...i, text: editText.trim() } : i);
        persistInsights(next);
        return next;
      });
    }
    setEditingId(null);
    setEditText('');
  };

  const handleAdd = (type: PortfolioInsight['type']) => {
    const newInsight: EditableInsight = {
      id: genId(),
      type,
      text: '',
      isCustom: true,
    };
    setEditableInsights(prev => [...prev, newInsight]);
    setEditingId(newInsight.id);
    setEditText('');
  };

  const handleReset = async () => {
    await resetPortfolioInsights(caseId).catch(() => {});
    const auto = analyzePortfolio(policies, currentAge);
    const mapped = auto.map(a => ({ ...a, id: genId(), isCustom: false }));
    setEditableInsights(mapped);
    persistInsights(mapped);
    setEditingId(null);
  };

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
          const totalMonthly = typePolicies.reduce((sum, p) => sum + getActiveMonthlyPremium(p, currentAge), 0);
          const totalDeathBenefit = typePolicies.reduce((sum, p) => sum + getCurrentDeathBenefit(p, currentAge), 0);
          const totalHosp = typePolicies.reduce((sum, p) => sum + p.hospDayDisease, 0);
          const desc = getDescription(type);
          const isEditingThis = editingType === type;

          return (
            <div key={type} className="type-overview-card" style={{ borderTopColor: info.borderColor }}>
              <div className="toc-header">
                <div className="toc-title">
                  {Icon && <Icon size={20} />}
                  <span>{type}</span>
                </div>
                <div className="toc-header-right">
                  <span className="toc-count" style={{ background: info.bgColor, color: info.color }}>
                    {typePolicies.length}件
                  </span>
                  {!isEditingThis && (
                    <button className="toc-edit-btn no-print" onClick={() => handleStartEditType(type)} title="説明を編集">
                      <Pencil size={13} />
                    </button>
                  )}
                </div>
              </div>

              {isEditingThis ? (
                <div className="toc-edit-form">
                  <label className="toc-edit-label">説明</label>
                  <textarea
                    className="toc-edit-textarea"
                    value={editDesc.longDescription}
                    onChange={e => setEditDesc(prev => ({ ...prev, longDescription: e.target.value }))}
                    rows={3}
                  />
                  <label className="toc-edit-label">目的</label>
                  <input
                    className="toc-edit-input"
                    value={editDesc.purpose}
                    onChange={e => setEditDesc(prev => ({ ...prev, purpose: e.target.value }))}
                  />
                  <div className="toc-edit-actions">
                    <button className="toc-edit-save" onClick={handleSaveType} disabled={savingType}>
                      <Check size={14} /> {savingType ? '保存中...' : '保存'}
                    </button>
                    <button className="toc-edit-cancel" onClick={() => setEditingType(null)}>
                      <X size={14} /> キャンセル
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="toc-description">{desc.longDescription}</p>
                  <div className="toc-purpose">
                    <span className="toc-purpose-label">目的</span>
                    <span>{desc.purpose}</span>
                  </div>
                </>
              )}

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

      <div className="portfolio-insights">
        <div className="insights-header">
          <h4>ポートフォリオ診断</h4>
          <div className="insights-actions no-print">
            <button className="insight-action-btn" onClick={handleReset} title="自動生成に戻す">
              <RotateCcw size={14} /> リセット
            </button>
            <button className="insight-action-btn insight-add-btn" onClick={() => handleAdd('recommendation')} title="推奨を追加">
              <Plus size={14} /> 追加
            </button>
          </div>
        </div>
        <div className="insights-list">
          {editableInsights.map((insight) => {
            const InsightIcon = insightIconMap[insight.type];
            const colors = insightColorMap[insight.type];
            const isEditing = editingId === insight.id;

            return (
              <div key={insight.id} className="insight-item" style={{ background: colors.bg, borderColor: colors.border, color: colors.color }}>
                <InsightIcon size={16} />
                {isEditing ? (
                  <div className="insight-edit-row">
                    <select
                      className="insight-type-select"
                      value={insight.type}
                      onChange={e => {
                        const newType = e.target.value as PortfolioInsight['type'];
                        setEditableInsights(prev => {
                          const next = prev.map(i => i.id === insight.id ? { ...i, type: newType } : i);
                          persistInsights(next);
                          return next;
                        });
                      }}
                    >
                      {Object.entries(insightTypeLabels).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                    <input
                      ref={editInputRef}
                      className="insight-edit-input"
                      value={editText}
                      onChange={e => setEditText(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleSaveEdit(insight.id); }}
                      placeholder="診断内容を入力..."
                    />
                    <button className="insight-icon-btn" onClick={() => handleSaveEdit(insight.id)} title="保存">
                      <Check size={14} />
                    </button>
                  </div>
                ) : (
                  <>
                    <span>{insight.text}</span>
                    <div className="insight-item-actions no-print">
                      <button className="insight-icon-btn" onClick={() => handleStartEdit(insight)} title="編集">
                        <Pencil size={13} />
                      </button>
                      <button className="insight-icon-btn" onClick={() => handleDelete(insight.id)} title="削除">
                        <Trash size={13} />
                      </button>
                    </div>
                  </>
                )}
              </div>
            );
          })}
          {editableInsights.length === 0 && (
            <div className="insight-empty">診断項目がありません。「追加」ボタンで手動追加できます。</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default InsuranceTypeOverview;
