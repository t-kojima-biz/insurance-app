import React from 'react';
import { Agency } from '../types';

interface PrintCoverPageProps {
  customerName: string;
  agency: Agency;
}

const PrintCoverPage: React.FC<PrintCoverPageProps> = ({ customerName, agency }) => {
  const today = new Date();
  // 和暦表示の簡易版 (2026年 = 令和8年)
  const reiwaYear = today.getFullYear() - 2018;
  const dateStr = `令和${reiwaYear}年${today.getMonth() + 1}月${today.getDate()}日`;

  return (
    <div className="print-only cover-page">
      <div className="cover-title-container">
        <div className="customer-name-display">
          {customerName} 様
        </div>
        <div className="logo-container">
          <img src="/njpw_logo.webp" alt="Company Logo" className="agency-logo" />
        </div>
      </div>

      <div className="creation-date-row">
        作成日： {dateStr}
      </div>

      <div className="main-title">
        保険証券分析表
      </div>

      <div className="agent-info">
        <div className="agent-box">
          <p>【保険代理店】 {agency.name}</p>
          <p>取扱者： {agency.representative}</p>
          <p>連絡先： {agency.phone}</p>
        </div>
      </div>
    </div>
  );
};

export default PrintCoverPage;
