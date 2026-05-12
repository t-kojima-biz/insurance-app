import { useState, useEffect } from 'react'
import './App.css'
import SummaryDashboard from './components/SummaryDashboard'
import CoverageChart from './components/CoverageChart'
import CostChart from './components/CostChart'
import PolicyTable from './components/PolicyTable'
import PolicyForm from './components/PolicyForm'
import PrintCoverPage from './components/PrintCoverPage'
import CustomerModal from './components/CustomerModal'
import { Policy, FamilyMember, Agency } from './types'

import { Printer, Trash2, FileJson, Settings } from 'lucide-react'

function App() {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [agency, setAgency] = useState<Agency>({
    name: "新日本プロレス",
    representative: "橋本 信也",
    phone: "050-3317-0226"
  });
  const [isLoading, setIsLoading] = useState(true);
  const [editingPolicy, setEditingPolicy] = useState<Policy | null>(null);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);

  const loadSampleData = () => {
    setIsLoading(true);
    fetch('/sample-data.json')
      .then(res => res.json())
      .then(data => {
        const members: FamilyMember[] = [
          { id: "m1", name: data.customer.name, relationship: "本人", birthDate: data.customer.birthDate, gender: data.customer.gender },
          { id: "m2", name: "北斗晶", relationship: "配偶者", birthDate: "1985-04-12", gender: "female" }
        ];
        setFamilyMembers(members);
        
        const mappedPolicies = data.policies.map((p: any) => ({
          ...p,
          insuredId: "m1",
          beneficiaryId: "m2"
        }));
        setPolicies(mappedPolicies);
        setIsLoading(false);
      })
      .catch(err => {
        console.error("データの読み込みに失敗しました:", err);
        setIsLoading(false);
      });
  };

  useEffect(() => {
    loadSampleData();
  }, []);

  const calculateAge = (birthDate: string) => {
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  const self = familyMembers.find(m => m.relationship === "本人") || familyMembers[0];
  const currentAge = self ? calculateAge(self.birthDate) : 0;

  const handleAddOrUpdatePolicy = (policy: Policy) => {
    if (editingPolicy) {
      setPolicies(policies.map(p => p.id === policy.id ? policy : p));
      setEditingPolicy(null);
    } else {
      setPolicies([...policies, policy]);
    }
  };

  const handleDeletePolicy = (id: string) => {
    if (window.confirm("この保険証券を削除しますか？")) {
      setPolicies(policies.filter(p => p.id !== id));
    }
  };

  const handleEditStart = (policy: Policy) => {
    setEditingPolicy(policy);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleClear = () => {
    if (window.confirm("すべての入力データを削除して初期状態に戻しますか？")) {
      setPolicies([]);
      setFamilyMembers([{
        id: "m1",
        name: "",
        birthDate: new Date().toISOString().split('T')[0],
        gender: "male",
        relationship: "本人"
      }]);
    }
  };

  const handleSaveModal = (updatedFamily: FamilyMember[], updatedAgency: Agency) => {
    setFamilyMembers(updatedFamily);
    setAgency(updatedAgency);
  };

  if (isLoading) {
    return <div className="loading-screen">データを読み込んでいます...</div>;
  }

  return (
    <div className="App">
      <PrintCoverPage customerName={self?.name || ""} agency={agency} />
      
      {isCustomerModalOpen && (
        <CustomerModal 
          familyMembers={familyMembers} 
          agency={agency}
          onSave={handleSaveModal} 
          onClose={() => setIsCustomerModalOpen(false)} 
        />
      )}

      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>保険証券分析・診断ダッシュボード</h1>
          <div className="customer-summary-display" onClick={() => setIsCustomerModalOpen(true)} title="クリックして情報を編集">
            <span className="customer-name-tag">{self?.name} 様</span>
            <span className="customer-meta-tag">({currentAge}歳 | 世帯人数: {familyMembers.length}名)</span>
            <Settings size={16} className="settings-icon" />
          </div>
        </div>
        <div className="header-actions">
          <button onClick={loadSampleData} className="sample-button">
            <FileJson size={18} /> サンプル読込
          </button>
          <button onClick={handleClear} className="clear-button">
            <Trash2 size={18} /> データ消去
          </button>
          <button onClick={handlePrint} className="print-button">
            <Printer size={18} /> 診断結果を印刷 / PDF保存
          </button>
        </div>
      </header>

      <main>
        <SummaryDashboard policies={policies} currentAge={currentAge} />
        
        <div className="charts-container">
          <div className="chart-item">
            <CoverageChart policies={policies} currentAge={currentAge} />
          </div>
          <div className="chart-item">
            <CostChart policies={policies} currentAge={currentAge} />
          </div>
        </div>

        <div style={{ marginTop: '3rem' }}>
          <PolicyForm 
            onAdd={handleAddOrUpdatePolicy} 
            familyMembers={familyMembers} 
            editingPolicy={editingPolicy}
            onCancel={() => setEditingPolicy(null)}
          />
          <PolicyTable 
            policies={policies} 
            familyMembers={familyMembers}
            onDelete={handleDeletePolicy}
            onEdit={handleEditStart}
          />
        </div>
      </main>
    </div>
  )
}

export default App
