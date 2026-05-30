import React from 'react';
import type { Agency } from '@/types';
import PrintPageNumber from '@/components/PrintPageNumber';

interface PrintCoverPageProps {
  customerName: string;
  agency: Agency;
  totalPages: number;
}

const PrintCoverPage: React.FC<PrintCoverPageProps> = ({ customerName, agency, totalPages }) => {
  const today = new Date();
  const reiwaYear = today.getFullYear() - 2018;
  const dateStr = `令和${reiwaYear}年${today.getMonth() + 1}月${today.getDate()}日`;

  return (
    <div className="print-only cover-page">
      <div className="cover-accent-bar" />

      <div className="cover-top">
        <div className="cover-customer">
          <span className="cover-customer-label">お客様</span>
          <span className="cover-customer-name">{customerName}</span>
          <span className="cover-sama">様</span>
        </div>
        <div className="cover-date">{dateStr} 作成</div>
      </div>

      <div className="cover-center">
        <div className="cover-title-main">保険証券分析表</div>
        <div className="cover-title-sub">Insurance Policy Analysis Report</div>
      </div>

      <div className="cover-footer">
        <div className="logo-container">
          <img src="/njpw_logo.webp" alt="Company Logo" className="agency-logo" />
        </div>
        <div className="cover-agent">
          <div className="cover-agent-name">{agency.name}</div>
          <div className="cover-agent-detail">
            <span>取扱者：{agency.representative}</span>
            <span className="cover-agent-divider" />
            <span>TEL：{agency.phone}</span>
          </div>
        </div>
      </div>

      <PrintPageNumber currentPage={1} totalPages={totalPages} />
    </div>
  );
};

export default PrintCoverPage;
