'use client';

import { useState, useRef, useCallback } from 'react';
import { Upload, X, AlertTriangle, FileUp, Download } from 'lucide-react';
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

  const handleDownloadTemplate = () => {
    const headers = [
      '保険会社', '保険種類', '証券番号', '契約日', '契約年齢',
      '被保険者', '受取人', '死亡保障疾病', '死亡保障災害',
      '入院日額疾病', '入院日額災害', '診断一時金', '保険期間',
      '払方', '保険料', '払込終了年月日', '払込終了年齢', '満期保険金',
      'コンサルタントメモ',
    ];
    const hints = [
      '※必須', '※必須：個人年金保険/収入保障保険/変額終身保険/医療保険/終身保険/養老保険', '任意', '※必須：YYYY-MM-DD', '自動計算可',
      '※必須：家族情報の氏名と一致', '任意：家族情報の氏名と一致', '円（例:10000000）', '円',
      '円（例:10000）', '円', '円', '※必須：終身は999/有期は満了年齢',
      '※必須：monthly=月払/annual=年払/single=一時払', '※必須：円', 'YYYY-MM-DD', '歳 ※左と片方必須', '円',
      '自由記述',
    ];
    const sample = [
      '住友生命', '終身保険', '1234567890', '2020-04-01', '30',
      '佐々木健介', '佐々木北斗晶', '10000000', '0',
      '0', '0', '0', '999',
      'monthly', '15000', '', '60', '0',
      '',
    ];
    const bom = '﻿';
    const csv = bom + headers.join(',') + '\n' + hints.join(',') + '\n' + sample.join(',') + '\n';
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '保険証券_取込テンプレート.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

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

        <button type="button" className="csv-template-btn" onClick={handleDownloadTemplate}>
          <Download size={14} /> テンプレートCSVをダウンロード
        </button>

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
