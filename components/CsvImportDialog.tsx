'use client';

import { useState, useRef, useCallback } from 'react';
import { Upload, X, AlertTriangle, FileUp } from 'lucide-react';
import { importCsv } from '@/lib/api';
import type { CsvImportResult, AppState } from '@/types';

interface Props {
  caseId: string;
  onClose: () => void;
  onImported: (state: AppState) => void;
}

export default function CsvImportDialog({ caseId, onClose, onImported }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [result, setResult] = useState<CsvImportResult | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const acceptFile = useCallback((f: File | null) => {
    if (f && !f.name.toLowerCase().endsWith('.csv')) {
      setResult({ errors: [{ row: 0, message: 'CSV ファイルのみ対応しています' }] });
      return;
    }
    setFile(f);
    setResult(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const f = e.dataTransfer.files[0] ?? null;
    acceptFile(f);
  }, [acceptFile]);

  const handleImport = async (overwrite = false) => {
    if (!file) return;
    setIsImporting(true);
    setResult(null);
    try {
      const res = await importCsv(caseId, file, overwrite);
      if (res.code === 'DUPLICATE_POLICY_NUMBER') {
        setResult(res);
        setIsImporting(false);
        return;
      }
      if (res.errors && res.errors.length > 0 && !res.state) {
        setResult(res);
        setIsImporting(false);
        return;
      }
      if (res.state) {
        onImported(res.state);
      }
    } catch {
      setResult({ errors: [{ row: 0, message: 'CSV 取り込みに失敗しました' }] });
    }
    setIsImporting(false);
  };

  return (
    <div className="form-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="form-container csv-import-dialog">
        <div className="modal-header">
          <div className="title-with-icon">
            <Upload size={20} />
            <h3>CSV 取込</h3>
          </div>
          <button className="close-btn" onClick={onClose}><X size={20} /></button>
        </div>

        <div
          className={`csv-dropzone ${isDragOver ? 'csv-dropzone-active' : ''} ${file ? 'csv-dropzone-has-file' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
        >
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            style={{ display: 'none' }}
            onChange={(e) => acceptFile(e.target.files?.[0] ?? null)}
          />
          {file ? (
            <div className="csv-dropzone-file">
              <FileUp size={24} />
              <span>{file.name}</span>
            </div>
          ) : (
            <div className="csv-dropzone-prompt">
              <Upload size={32} />
              <p>ここにCSVファイルをドラッグ&ドロップ</p>
              <p className="csv-dropzone-sub">またはクリックしてファイルを選択</p>
            </div>
          )}
        </div>

        {result?.code === 'DUPLICATE_POLICY_NUMBER' && (
          <div className="csv-duplicate-warning">
            <div className="csv-warning-header">
              <AlertTriangle size={16} /> 証券番号が重複しています
            </div>
            <table className="csv-error-table">
              <thead>
                <tr><th>行</th><th>証券番号</th></tr>
              </thead>
              <tbody>
                {result.duplicates?.map((d, i) => (
                  <tr key={i}><td>{d.row}</td><td>{d.policyNumber}</td></tr>
                ))}
              </tbody>
            </table>
            <button
              className="csv-overwrite-btn"
              onClick={() => handleImport(true)}
              disabled={isImporting}
            >
              {isImporting ? '取り込み中...' : '上書きして取り込む'}
            </button>
          </div>
        )}

        {result?.errors && result.errors.length > 0 && !result.code && (
          <div className="csv-errors">
            <table className="csv-error-table">
              <thead>
                <tr><th>行</th><th>エラー</th></tr>
              </thead>
              <tbody>
                {result.errors.map((e, i) => (
                  <tr key={i}><td>{e.row}</td><td>{e.message}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="form-actions">
          <button
            type="button"
            className="save-btn"
            onClick={() => handleImport(false)}
            disabled={!file || isImporting}
          >
            {isImporting ? '取り込み中...' : '取り込む'}
          </button>
          <button type="button" onClick={onClose}>キャンセル</button>
        </div>
      </div>
    </div>
  );
}
