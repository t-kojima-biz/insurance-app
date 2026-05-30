import React from 'react';

interface PrintPageNumberProps {
  currentPage: number;
  totalPages: number;
}

const PrintPageNumber: React.FC<PrintPageNumberProps> = ({ currentPage, totalPages }) => (
  <div className="print-only print-page-number" aria-hidden="true">
    {currentPage} / {totalPages}
  </div>
);

export default PrintPageNumber;
