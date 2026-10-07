import React, { useState, useRef } from 'react';
import { UploadCloud, FileSpreadsheet, Trash2, CheckCircle2, Smartphone, HelpCircle, AlertCircle, X } from 'lucide-react';
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
  onOpenInstructions?: () => void;
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
  onOpenInstructions,
}) => {
  const { language } = useLanguage();
  const [isDragging, setIsDragging] = useState(false);
  const [rejectedState, setRejectedState] = useState<{
    type: 'REJECTED_ALL' | 'REJECTED_SOME';
    names: string[];
  } | null>(null);
  const [pendingValidFiles, setPendingValidFiles] = useState<File[] | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const executeImport = (fileArray: File[]) => {
    if (!fileArray || fileArray.length === 0) return;

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

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const rawFiles = Array.from(files);

    // Strictly restrict imported files exclusively to CSV
    const validCsvFiles = rawFiles.filter((file) => {
      const name = file.name.toLowerCase();
      return name.endsWith('.csv') || file.type === 'text/csv';
    });
    const rejectedFiles = rawFiles.filter((file) => {
      const name = file.name.toLowerCase();
      return !name.endsWith('.csv') && file.type !== 'text/csv';
    });

    if (rejectedFiles.length > 0) {
      const rejectedNames = rejectedFiles.map((f) => f.name);
      if (validCsvFiles.length === 0) {
        setRejectedState({
          type: 'REJECTED_ALL',
          names: rejectedNames,
        });
        setPendingValidFiles(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        return;
      } else {
        setRejectedState({
          type: 'REJECTED_SOME',
          names: rejectedNames,
        });
        setPendingValidFiles(validCsvFiles);
        return;
      }
    } else {
      setRejectedState(null);
      setPendingValidFiles(null);
    }

    executeImport(validCsvFiles);
  };

  const handleConfirmPendingImport = () => {
    if (pendingValidFiles && pendingValidFiles.length > 0) {
      const filesToLoad = pendingValidFiles;
      setPendingValidFiles(null);
      setRejectedState(null);
      executeImport(filesToLoad);
    }
  };

  const handleCancelPendingImport = () => {
    setPendingValidFiles(null);
    setRejectedState(null);
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
      {isInitialModal && (
        <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800 gap-2">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              {language === 'fr' ? 'Import de fichiers CSV' : 'CSV Files Import'}
            </h2>
          </div>
          {onOpenInstructions && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenInstructions();
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-cyan-50 dark:bg-cyan-950/70 border border-cyan-300 dark:border-cyan-800 hover:bg-cyan-100 dark:hover:bg-cyan-900/80 text-cyan-800 dark:text-cyan-200 shadow-xs transition-all cursor-pointer"
            >
              <HelpCircle className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400 shrink-0" />
              <span>
                {language === 'fr'
                  ? 'Instructions pour récupérer vos fichiers CSV'
                  : 'Instructions for collecting your CSV files'}
              </span>
            </button>
          )}
        </div>
      )}

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

      {/* Error / Warning Alert for non-CSV rejected formats (Bilingual FR/EN) */}
      {rejectedState && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-start justify-between gap-2 shadow-xs transition-all ${
            rejectedState.type === 'REJECTED_ALL'
              ? 'bg-red-50 dark:bg-red-950/60 border-red-200 dark:border-red-800/70 text-red-800 dark:text-red-200'
              : 'bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-800/70 text-amber-800 dark:text-amber-200'
          }`}
        >
          <div className="flex items-start gap-2.5">
            <AlertCircle
              className={`w-4 h-4 shrink-0 mt-0.5 ${
                rejectedState.type === 'REJECTED_ALL'
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-amber-600 dark:text-amber-400'
              }`}
            />
            <div className="space-y-0.5">
              <p className="font-bold">
                {rejectedState.type === 'REJECTED_ALL'
                  ? language === 'fr'
                    ? 'Format de fichier non pris en charge'
                    : 'Unsupported file format'
                  : language === 'fr'
                  ? rejectedState.names.length === 1
                    ? 'Fichier non pris en charge détecté'
                    : 'Fichiers non pris en charge détectés'
                  : rejectedState.names.length === 1
                  ? 'Unsupported file detected'
                  : 'Unsupported files detected'}
              </p>
              <p className="text-[11px] leading-relaxed opacity-95 whitespace-pre-line">
                {rejectedState.type === 'REJECTED_ALL'
                  ? language === 'fr'
                    ? rejectedState.names.length === 1
                      ? `Le fichier "${rejectedState.names[0]}" a été ignoré car il n'est pas pris en charge.\nSeuls les fichiers au format CSV sont acceptés.`
                      : `Les fichiers (${rejectedState.names.join(', ')}) ont été ignorés car ils ne sont pas pris en charge.\nSeuls les fichiers au format CSV sont acceptés.`
                    : rejectedState.names.length === 1
                    ? `File "${rejectedState.names[0]}" was ignored because it is not supported.\nOnly CSV files are accepted.`
                    : `Files (${rejectedState.names.join(', ')}) were rejected because they are not supported.\nOnly CSV files are accepted.`
                  : (() => {
                      const rejCount = rejectedState.names.length;
                      const validCount = pendingValidFiles?.length || 0;
                      if (language === 'fr') {
                        const rejPart =
                          rejCount === 1
                            ? `1 fichier non pris en charge ignoré (${rejectedState.names[0]}).`
                            : `${rejCount} fichiers non pris en charge ignorés (${rejectedState.names.join(', ')}).`;
                        const valPart =
                          validCount === 1
                            ? `1 fichier CSV valide détecté.`
                            : `${validCount} fichiers CSV valides détectés.`;
                        const promptPart =
                          validCount === 1
                            ? `Souhaitez-vous continuer l'import avec le fichier CSV valide ?`
                            : `Souhaitez-vous continuer l'import avec les fichiers CSV valides ?`;
                        return `${rejPart} ${valPart}\n${promptPart}`;
                      } else {
                        const rejPart =
                          rejCount === 1
                            ? `1 non-CSV file ignored (${rejectedState.names[0]}).`
                            : `${rejCount} non-CSV files ignored (${rejectedState.names.join(', ')}).`;
                        const valPart =
                          validCount === 1
                            ? `1 valid CSV file detected.`
                            : `${validCount} valid CSV files detected.`;
                        const promptPart =
                          validCount === 1
                            ? `Would you like to proceed with the valid CSV file?`
                            : `Would you like to proceed with the valid CSV files?`;
                        return `${rejPart} ${valPart}\n${promptPart}`;
                      }
                    })()}
              </p>
              {pendingValidFiles && pendingValidFiles.length > 0 && (
                <div className="pt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleConfirmPendingImport();
                    }}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white shadow-xs transition-colors cursor-pointer"
                  >
                    {language === 'fr'
                      ? `Continuer l'import (${pendingValidFiles.length} fichier${pendingValidFiles.length > 1 ? 's' : ''})`
                      : `Continue Import (${pendingValidFiles.length} file${pendingValidFiles.length > 1 ? 's' : ''})`}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCancelPendingImport();
                    }}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition-colors cursor-pointer"
                  >
                    {language === 'fr' ? 'Annuler' : 'Cancel'}
                  </button>
                </div>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleCancelPendingImport();
            }}
            className={`p-1 rounded transition-colors cursor-pointer shrink-0 ${
              rejectedState.type === 'REJECTED_ALL'
                ? 'hover:bg-red-100 dark:hover:bg-red-900/60 text-red-600 dark:text-red-300'
                : 'hover:bg-amber-100 dark:hover:bg-amber-900/60 text-amber-600 dark:text-amber-300'
            }`}
            title={language === 'fr' ? 'Fermer' : 'Dismiss'}
          >
            <X className="w-3.5 h-3.5" />
          </button>
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
          accept=".csv,text/csv"
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
                ({totalAps.toLocaleString()} {language === 'fr' ? (totalAps > 1 ? 'réseaux uniques' : 'réseau unique') : (totalAps > 1 ? 'unique APs' : 'unique AP')} / {totalRecords.toLocaleString()} {language === 'fr' ? 'scans' : 'scans'})
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
