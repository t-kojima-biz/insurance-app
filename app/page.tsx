'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import SummaryDashboard from '@/components/SummaryDashboard';
import CoverageChart from '@/components/CoverageChart';
import CostChart from '@/components/CostChart';
import PolicyTable from '@/components/PolicyTable';
import PolicyForm from '@/components/PolicyForm';
import PolicyAnalysisSection from '@/components/PolicyAnalysisSection';
import PrintCoverPage from '@/components/PrintCoverPage';
import PrintPageNumber from '@/components/PrintPageNumber';
import CustomerModal from '@/components/CustomerModal';
import CsvImportDialog from '@/components/CsvImportDialog';
import CaseListPage from '@/components/CaseListPage';
import ToastContainer, { type ToastMessage } from '@/components/Toast';
import type { Policy, FamilyMember, Agency, AppState } from '@/types';
import { fetchAppState, saveAppState as apiSave, resetAppState, clearAppState, getExportUrl, getBackupUrl, restoreBackup } from '@/lib/api';

import { AlertTriangle, Printer, Trash2, FileUp, Settings, Save, Upload, Download, Menu, ChevronDown, ArrowLeft, DatabaseBackup } from 'lucide-react';

const VALID_POLICY_TYPES = ['個人年金保険', '収入保障保険', '変額終身保険', '医療保険', '終身保険', '養老保険'] as const;
const VALID_FREQUENCIES = ['monthly', 'annual', 'single'] as const;

function validateBeforeSave(familyMembers: FamilyMember[], policies: Policy[], agency: Agency): string | null {
  if (familyMembers.length === 0) return '家族情報が1件もありません';
  for (const m of familyMembers) {
    if (!m.id) return '家族情報にIDが不足しています';
    if (!m.relationship) return '続柄が未入力の家族がいます';
    if (!['male', 'female'].includes(m.gender)) return '性別が不正な家族がいます';
  }
  if (typeof agency.name !== 'string' || typeof agency.representative !== 'string' || typeof agency.phone !== 'string') {
    return '代理店情報が不正です';
  }
  for (const p of policies) {
    if (!p.companyName) return `保険会社が未入力の証券があります`;
    if (!VALID_POLICY_TYPES.includes(p.policyType)) return `保険種類「${p.policyType}」が不正です`;
    if (!p.contractDate) return '契約日が未入力の証券があります';
    if (!p.insuredId) return '被保険者が未設定の証券があります';
    if (!VALID_FREQUENCIES.includes(p.paymentFrequency)) return `払方「${p.paymentFrequency}」が不正です`;
  }
  return null;
}

function getErrorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === 'object') {
    const error = 'error' in err ? (err as { error?: unknown }).error : undefined;
    if (typeof error === 'string' && error.trim()) return error;

    const message = 'message' in err ? (err as { message?: unknown }).message : undefined;
    if (typeof message === 'string' && message.trim() && !message.startsWith('API Error:')) return message;
  }
  return fallback;
}

export default function Page() {
  const [activeCaseId, setActiveCaseId] = useState<string | null>(null);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [agency, setAgency] = useState<Agency>({
    name: "",
    representative: "",
    phone: ""
  });
  const [isLoading, setIsLoading] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<Policy | null>(null);
  const [isPolicyFormOpen, setIsPolicyFormOpen] = useState(false);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [csvImportOpen, setCsvImportOpen] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const restoreInputRef = useRef<HTMLInputElement>(null);

  const addToast = useCallback((type: ToastMessage['type'], text: string) => {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    setToasts(prev => [...prev, { id, type, text }]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const applyState = useCallback((state: AppState) => {
    setFamilyMembers(state.familyMembers);
    setPolicies(state.policies);
    setAgency(state.agency);
    setHasUnsavedChanges(false);
    setError(null);
  }, []);

  const loadFromApi = useCallback(async (caseId: string) => {
    setIsLoading(true);
    try {
      const state = await fetchAppState(caseId);
      applyState(state);
    } catch (err) {
      addToast('error', getErrorMessage(err, 'データの読み込みに失敗しました'));
    }
    setIsLoading(false);
  }, [applyState]);

  const handleSelectCase = useCallback((caseId: string) => {
    setActiveCaseId(caseId);
    loadFromApi(caseId);
  }, [loadFromApi]);

  const handleBackToList = () => {
    if (hasUnsavedChanges) {
      if (!window.confirm('未保存の変更があります。お客様一覧に戻りますか？')) return;
    }
    setActiveCaseId(null);
    setHasUnsavedChanges(false);
    setError(null);
    setMenuOpen(false);
  };

  const loadSampleData = async () => {
    if (!activeCaseId) return;
    if (!window.confirm('サンプルデータを読み込みますか？現在のデータは上書きされます。')) return;
    setIsLoading(true);
    try {
      const state = await resetAppState(activeCaseId);
      applyState(state);
    } catch (err) {
      addToast('error', getErrorMessage(err, 'サンプル読込に失敗しました'));
    }
    setIsLoading(false);
  };

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasUnsavedChanges]);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  const handleBackup = () => {
    window.open(getBackupUrl(), '_blank');
    addToast('success', 'バックアップをダウンロードしています');
  };

  const handleRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    if (!window.confirm('バックアップから復元しますか？現在のデータはすべて上書きされます。')) return;

    try {
      await restoreBackup(file);
      addToast('success', '復元しました。ページをリロードします...');
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
      addToast('error', getErrorMessage(err, '復元に失敗しました。有効なバックアップファイルか確認してください。'));
    }
  };

  const calculateAge = (birthDate: string) => {
    if (!birthDate) return null;

    const today = new Date();
    const birth = new Date(birthDate);
    if (Number.isNaN(birth.getTime())) return null;

    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    if (age < 0) return null;
    return age;
  };

  const self = familyMembers.find(m => m.relationship === "本人") || familyMembers[0];
  const displayAge = self ? calculateAge(self.birthDate) : null;
  const hasKnownCurrentAge = displayAge !== null;
  const birthDateLabel = self?.birthDate || '生年月日未入力';
  const ageLabel = displayAge === null ? '年齢未入力' : `${displayAge}歳`;

  const handleAddOrUpdatePolicy = (policy: Policy) => {
    if (editingPolicy) {
      setPolicies(policies.map(p => p.id === policy.id ? policy : p));
      setEditingPolicy(null);
    } else {
      setPolicies([...policies, policy]);
    }
    setHasUnsavedChanges(true);
  };

  const handleAddFamilyMemberFromPolicy = useCallback((member: FamilyMember) => {
    setFamilyMembers(prev => {
      if (prev.some(existing => existing.id === member.id)) {
        return prev.map(existing => existing.id === member.id ? { ...existing, ...member } : existing);
      }
      return [...prev, member];
    });
    setHasUnsavedChanges(true);
  }, []);

  const handleDeletePolicy = (id: string) => {
    if (window.confirm("この保険証券を削除しますか？")) {
      setPolicies(policies.filter(p => p.id !== id));
      setHasUnsavedChanges(true);
    }
  };

  const handleReorderPolicy = (draggedId: string, targetId: string, position: 'before' | 'after') => {
    setPolicies(currentPolicies => {
      const fromIndex = currentPolicies.findIndex(policy => policy.id === draggedId);
      const targetIndex = currentPolicies.findIndex(policy => policy.id === targetId);

      if (fromIndex === -1 || targetIndex === -1 || fromIndex === targetIndex) {
        return currentPolicies;
      }

      const nextPolicies = [...currentPolicies];
      const [movedPolicy] = nextPolicies.splice(fromIndex, 1);
      const targetIndexAfterRemoval = nextPolicies.findIndex(policy => policy.id === targetId);
      const insertionIndex = position === 'after' ? targetIndexAfterRemoval + 1 : targetIndexAfterRemoval;

      nextPolicies.splice(insertionIndex, 0, movedPolicy);
      return nextPolicies;
    });
    setHasUnsavedChanges(true);
  };

  const handleUpdateNote = (policyId: string, note: string) => {
    setPolicies(prev => prev.map(p => p.id === policyId ? { ...p, consultantNote: note } : p));
    setHasUnsavedChanges(true);
  };

  const handleEditStart = (policy: Policy) => {
    setEditingPolicy(policy);
    setIsPolicyFormOpen(true);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleClear = async () => {
    if (!activeCaseId) return;
    if (!window.confirm("すべての入力データを削除して初期状態に戻しますか？")) return;
    setIsLoading(true);
    try {
      const state = await clearAppState(activeCaseId);
      applyState(state);
    } catch (err) {
      addToast('error', getErrorMessage(err, 'データ消去に失敗しました'));
    }
    setIsLoading(false);
  };

  const handleSave = async () => {
    if (!activeCaseId) return;
    const validationError = validateBeforeSave(familyMembers, policies, agency);
    if (validationError) {
      addToast('warning', validationError);
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const state = await apiSave(activeCaseId, { familyMembers, policies, agency });
      applyState(state);
      addToast('success', '保存しました');
    } catch (err) {
      addToast('error', getErrorMessage(err, '保存に失敗しました'));
    }
    setIsSaving(false);
  };

  const handleExport = () => {
    if (!activeCaseId) return;
    window.open(getExportUrl(activeCaseId), '_blank');
  };

  const handleCsvImported = (state: AppState) => {
    applyState(state);
    setCsvImportOpen(false);
  };

  const handleSaveModal = async (updatedFamily: FamilyMember[], updatedAgency: Agency) => {
    if (!activeCaseId) return;
    const validationError = validateBeforeSave(updatedFamily, policies, updatedAgency);
    if (validationError) {
      addToast('warning', validationError);
      throw new Error(validationError);
    }

    setIsSaving(true);
    setError(null);
    try {
      const state = await apiSave(activeCaseId, { familyMembers: updatedFamily, policies, agency: updatedAgency });
      applyState(state);
      addToast('success', '世帯・代理店情報を保存しました');
    } catch (err) {
      addToast('error', getErrorMessage(err, '世帯・代理店情報の保存に失敗しました'));
      throw err;
    } finally {
      setIsSaving(false);
    }
  };

  if (!activeCaseId) {
    return <CaseListPage onSelect={handleSelectCase} />;
  }

  if (isLoading) {
    return <div className="loading-screen">データを読み込んでいます...</div>;
  }

  const hasPrintableCharts = displayAge !== null;
  const hasPrintableAnalysis = displayAge !== null && policies.length > 0;
  const printTotalPages = 2
    + (hasPrintableCharts ? 1 : 0)
    + (hasPrintableAnalysis ? 1 + policies.length : 0);

  return (
    <div className="App">
      <PrintCoverPage customerName={self?.name || ""} agency={agency} totalPages={printTotalPages} />

      {isCustomerModalOpen && (
        <CustomerModal
          familyMembers={familyMembers}
          agency={agency}
          onSave={handleSaveModal}
          onClose={() => setIsCustomerModalOpen(false)}
        />
      )}

      {csvImportOpen && (
        <CsvImportDialog
          caseId={activeCaseId}
          onClose={() => setCsvImportOpen(false)}
          onImported={handleCsvImported}
        />
      )}

      {error && (
        <div className="error-banner">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="error-close-btn">&times;</button>
        </div>
      )}

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <input
        ref={restoreInputRef}
        type="file"
        accept=".sqlite,.db"
        style={{ display: 'none' }}
        onChange={handleRestore}
      />

      <header className="app-header">
        <div>
          <h1>
            <button className="back-to-list-btn" onClick={handleBackToList} title="お客様一覧に戻る">
              <ArrowLeft size={20} />
            </button>
            保険証券分析・診断ダッシュボード
          </h1>
          <div className="customer-summary-display" onClick={() => setIsCustomerModalOpen(true)} title="クリックして情報を編集">
            <span className="customer-name-tag">{self?.name} 様</span>
            <span className="customer-meta-tag">({birthDateLabel} | {ageLabel} | 世帯人数: {familyMembers.length}名)</span>
            <Settings size={16} className="settings-icon" />
          </div>
        </div>
        <div className="header-actions">
          <div className="dropdown-wrapper" ref={menuRef}>
            <button onClick={() => setMenuOpen(v => !v)} className="dropdown-trigger">
              <Menu size={18} /> データ管理 <ChevronDown size={14} />
            </button>
            {menuOpen && (
              <div className="dropdown-menu">
                <button onClick={() => { setMenuOpen(false); loadSampleData(); }}>
                  <FileUp size={16} /> サンプル読込
                </button>
                <button onClick={() => { setMenuOpen(false); setCsvImportOpen(true); }}>
                  <Upload size={16} /> CSV取込
                </button>
                <button onClick={() => { setMenuOpen(false); handleExport(); }}>
                  <Download size={16} /> JSON出力
                </button>
                <hr />
                <button onClick={() => { setMenuOpen(false); handleBackup(); }}>
                  <DatabaseBackup size={16} /> バックアップ
                </button>
                <button onClick={() => { setMenuOpen(false); restoreInputRef.current?.click(); }}>
                  <Settings size={16} /> 復元
                </button>
                <hr />
                <button className="dropdown-danger" onClick={() => { setMenuOpen(false); handleClear(); }}>
                  <Trash2 size={16} /> データ消去
                </button>
              </div>
            )}
          </div>
          <button onClick={handleSave} className="save-button" disabled={!hasUnsavedChanges || isSaving}>
            <Save size={18} /> {isSaving ? '保存中...' : '保存'}
          </button>
          <button onClick={handlePrint} className="print-button">
            <Printer size={18} /> <span>印刷 / PDF保存</span>
          </button>
        </div>
      </header>

      <main>
        <section className="print-summary-page">
          {!hasKnownCurrentAge && policies.length > 0 && (
            <div className="age-analysis-notice no-print">
              <AlertTriangle size={20} />
              <div>
                <strong>年齢を使う集計・グラフ・診断は非表示にしています</strong>
                <p>本人の生年月日が未入力のため、現在年齢が必要な結果を計算できません。生年月日を入力すると自動で表示されます。</p>
              </div>
              <button type="button" onClick={() => setIsCustomerModalOpen(true)}>
                世帯・家族情報を開く
              </button>
            </div>
          )}

          <SummaryDashboard policies={policies} currentAge={displayAge} />

          <PolicyTable
            policies={policies}
            familyMembers={familyMembers}
            currentAge={displayAge}
            onDelete={handleDeletePolicy}
            onEdit={handleEditStart}
            onAddNew={() => setIsPolicyFormOpen(true)}
            onReorder={handleReorderPolicy}
          />

          <PrintPageNumber currentPage={2} totalPages={printTotalPages} />
        </section>

        {displayAge !== null && (
          <div className="charts-container">
            <div className="chart-item">
              <CoverageChart policies={policies} currentAge={displayAge} />
            </div>
            <div className="chart-item">
              <CostChart policies={policies} currentAge={displayAge} />
            </div>
            <PrintPageNumber currentPage={3} totalPages={printTotalPages} />
          </div>
        )}

        {displayAge !== null && (
          <PolicyAnalysisSection
            caseId={activeCaseId!}
            policies={policies}
            currentAge={displayAge}
            familyMembers={familyMembers}
            onUpdateNote={handleUpdateNote}
            printOverviewPage={4}
            printFirstPolicyPage={5}
            printTotalPages={printTotalPages}
          />
        )}

        <PolicyForm
          isOpen={isPolicyFormOpen}
          onClose={() => { setIsPolicyFormOpen(false); setEditingPolicy(null); }}
          onAdd={handleAddOrUpdatePolicy}
          onAddFamilyMember={handleAddFamilyMemberFromPolicy}
          familyMembers={familyMembers}
          existingPolicies={policies}
          editingPolicy={editingPolicy}
          onCancel={() => setEditingPolicy(null)}
        />

      </main>
    </div>
  );
}
