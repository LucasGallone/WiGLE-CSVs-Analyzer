import React, { useState, useRef } from 'react';
import { UploadCloud, FileSpreadsheet, Trash2, CheckCircle2, Smartphone } from 'lucide-react';
import { WigleHeaderInfo } from '../../types/wigle';
import { useLanguage } from '../../context/LanguageContext';

interface FileDropzoneProps {
  onLoadFiles?: (files: File[]) => void;
  onLoadCsv?: (csvContent: string, fileName: string, isAppend: boolean, totalFilesCount?: number) => void;
  onClearSession: () => void;
  loadedFiles: string[];
  totalAps: number;
  totalRecords: number;
  headerInfo?: WigleHeaderInfo;
  isInitialModal?: boolean;
  isAddCsvModal?: boolean;
}

export const FileDropzone: React.FC<FileDropzoneProps> = ({
  onLoadFiles,
  onLoadCsv,
  onClearSession,
  loadedFiles,
  totalAps,
  totalRecords,
  headerInfo,
  isInitialModal = false,
  isAddCsvModal = false,
}) => {
  const { language } = useLanguage();
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const fileArray = Array.from(files);

    if (onLoadFiles) {
      onLoadFiles(fileArray);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    if (onLoadCsv) {
      const count = fileArray.length;
      fileArray.forEach((file, index) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const text = e.target?.result as string;
          if (text) {
            const append = isAddCsvModal || loadedFiles.length > 0 || index > 0;
            onLoadCsv(text, file.name, append, count);
          }
        };
        reader.readAsText(file);
      });
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  return (
    <div className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-md dark:shadow-xl space-y-4 transition-colors ${isInitialModal ? 'max-w-xl mx-auto' : ''}`}>
      {!isInitialModal && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200 dark:border-slate-800">
          <div className="flex flex-wrap items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              {isAddCsvModal
                ? language === 'fr'
                  ? 'Ajout de fichiers'
                  : 'Adding files'
                : language === 'fr'
                ? 'Gestionnaire d\'imports CSV'
                : 'CSV Import Manager'}
            </h2>
            {loadedFiles.length > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                {loadedFiles.length} {language === 'fr' ? 'fichier(s) importé(s)' : 'imported file(s)'}
              </span>
            )}
            {!isAddCsvModal && headerInfo?.format && (
              <span className="px-2 py-0.5 rounded-full text-[11px] font-sans font-semibold bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-800">
                {headerInfo.format}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Forced merge badge without possibility of deactivating */}
            {(isAddCsvModal || loadedFiles.length > 0) && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-cyan-700 dark:text-cyan-300 bg-cyan-50 dark:bg-cyan-950/70 border border-cyan-300 dark:border-cyan-800 px-2.5 py-1 rounded-lg shadow-2xs">
                <CheckCircle2 className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                <span>{language === 'fr' ? 'Fusion activée' : 'Merge enforced'}</span>
              </span>
            )}

            {/* Clear Session Button - Not displayed in Add CSV modal */}
            {!isAddCsvModal && loadedFiles.length > 0 && (
              <button
                onClick={onClearSession}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 hover:border-cyan-500 text-slate-600 hover:text-cyan-700 dark:text-slate-400 dark:hover:text-cyan-300 text-xs font-semibold transition-all cursor-pointer"
                title={language === 'fr' ? 'Retourner au menu principal' : 'Return to main menu'}
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{language === 'fr' ? 'Menu principal' : 'Main Menu'}</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Drag & Drop Area without bouncing icon */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
          isDragging
            ? 'border-cyan-500 bg-cyan-50 dark:bg-cyan-950/20 scale-[0.99]'
            : 'border-slate-300 dark:border-slate-700/80 hover:border-cyan-500/60 bg-slate-50/60 dark:bg-slate-950/40 hover:bg-slate-100/60 dark:hover:bg-slate-950/60'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.txt"
          multiple
          onChange={(e) => handleFiles(e.target.files)}
          className="hidden"
        />

        <div className="flex flex-col items-center justify-center space-y-2.5">
          {/* Static icon without bounce */}
          <div className="p-3.5 rounded-2xl bg-cyan-100 dark:bg-cyan-950/60 border border-cyan-300 dark:border-cyan-700/50 text-cyan-600 dark:text-cyan-400 shadow-sm">
            <UploadCloud className="w-7 h-7" />
          </div>

          <div>
            <p className="text-sm font-bold text-slate-900 dark:text-white">
              {language === 'fr' ? (
                <>
                  Glissez-déposez vos fichiers <span className="text-cyan-600 dark:text-cyan-400 font-sans font-bold">WiGLE</span> ici, ou{' '}
                  <span className="text-cyan-600 dark:text-cyan-400 underline font-semibold">parcourez vos fichiers</span>
                </>
              ) : (
                <>
                  Drag & drop your <span className="text-cyan-600 dark:text-cyan-400 font-sans font-bold">WiGLE</span> files here, or{' '}
                  <span className="text-cyan-600 dark:text-cyan-400 underline font-semibold">browse your files</span>
                </>
              )}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {language === 'fr'
                ? 'Format attendu\u00A0: CSV'
                : 'Expected format: CSV'}
            </p>
          </div>

          {/* Scanner Device Metadata Pill with capitalization and ignoring WIGLE.net Server */}
          {(() => {
            if (isAddCsvModal || !headerInfo) return null;
            const brandRaw = (headerInfo.brand || '').trim();
            const modelRaw = (headerInfo.model || '').trim();
            const deviceRaw = (headerInfo.device || '').trim();

            if (
              brandRaw.toLowerCase().includes('wigle.net server') ||
              modelRaw.toLowerCase().includes('wigle.net server') ||
              deviceRaw.toLowerCase().includes('wigle.net server')
            ) {
              return null;
            }

            const brand = brandRaw ? brandRaw.charAt(0).toUpperCase() + brandRaw.slice(1) : '';
            const model = modelRaw ? modelRaw.charAt(0).toUpperCase() + modelRaw.slice(1) : '';
            const device = deviceRaw ? deviceRaw.charAt(0).toUpperCase() + deviceRaw.slice(1) : '';
            const display = [brand, model || device].filter(Boolean).join(' ').trim();
            if (!display || display.toLowerCase().includes('wigle.net server')) return null;

            return (
              <div className="flex flex-wrap items-center justify-center gap-1.5 pt-1 text-[11px] text-slate-600 dark:text-slate-300">
                <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200">
                  <Smartphone className="w-3.5 h-3.5 text-cyan-500" />
                  <span>
                    {language === 'fr' ? 'Appareil\u00A0:' : 'Device:'} <strong>{display}</strong>
                  </span>
                </span>
                {headerInfo.appRelease && (
                  <span className="px-2.5 py-1 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-sans font-semibold text-[10px]">
                    WiGLE App v{headerInfo.appRelease}
                  </span>
                )}
              </div>
            );
          })()}

          {!isAddCsvModal && loadedFiles.length > 0 && (
            <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
              <span className="text-[11px] text-slate-600 dark:text-slate-300 font-semibold">
                {language === 'fr' ? 'Fichiers importés\u00A0:' : 'Imported files:'}
              </span>
              {loadedFiles.map((file, i) => (
                <span
                  key={i}
                  className="px-2 py-0.5 rounded-lg bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-cyan-700 dark:text-cyan-300 text-[10px] font-sans font-semibold"
                >
                  {file}
                </span>
              ))}
              <span className="text-[10px] text-slate-500 dark:text-slate-400">
                ({totalAps.toLocaleString()} {language === 'fr' ? 'points d\'accès uniques' : 'unique APs'} / {totalRecords.toLocaleString()} {language === 'fr' ? 'scans' : 'scans'})
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
