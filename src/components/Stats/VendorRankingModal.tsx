import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Cpu, Search, X, Filter, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

interface VendorStatItem {
  vendor: string;
  count: number;
  percentage: number;
  percentageFormatted: string;
}

interface VendorRankingModalProps {
  isOpen: boolean;
  onClose: () => void;
  allVendors: VendorStatItem[];
  totalUniqueAPs: number;
  onFilterByVendor?: (vendor: string) => void;
}

export const VendorRankingModal: React.FC<VendorRankingModalProps> = ({
  isOpen,
  onClose,
  allVendors,
  totalUniqueAPs,
  onFilterByVendor,
}) => {
  const { language } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(15);

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Lock body scroll when modal is open to keep view centered and prevent background scrolling
  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen]);

  // Reset to page 1 when search or rowsPerPage changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, rowsPerPage]);

  const filteredVendors = useMemo(() => {
    if (!searchQuery.trim()) return allVendors;
    const q = searchQuery.toLowerCase().trim();
    return allVendors.filter((item) => item.vendor.toLowerCase().includes(q));
  }, [allVendors, searchQuery]);

  const totalPages = rowsPerPage === 0 ? 1 : Math.ceil(filteredVendors.length / rowsPerPage);

  const paginatedVendors = useMemo(() => {
    if (rowsPerPage === 0) return filteredVendors;
    const start = (currentPage - 1) * rowsPerPage;
    return filteredVendors.slice(start, start + rowsPerPage);
  }, [filteredVendors, currentPage, rowsPerPage]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-3xl max-h-[88vh] flex flex-col shadow-2xl overflow-hidden animate-scaleUp"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-100 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                {language === 'fr'
                  ? 'Liste complète des fabricants détectés'
                  : 'All Detected Manufacturers'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {allVendors.length} {language === 'fr' ? 'fabricants détectés sur' : 'manufacturers detected across'}{' '}
                <span className="font-bold text-slate-700 dark:text-slate-300 font-sans">{totalUniqueAPs}</span>{' '}
                {language === 'fr' ? (totalUniqueAPs > 1 ? 'réseaux' : 'réseau') : (totalUniqueAPs > 1 ? 'APs' : 'AP')}
              </p>
            </div>
          </div>
        </div>

        {/* Search Bar & Rows Selector Toolbar */}
        <div className="p-3.5 sm:p-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                language === 'fr'
                  ? 'Rechercher un fabricant...'
                  : 'Search manufacturer...'
              }
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl pl-10 pr-10 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500 font-sans"
              autoFocus
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0 text-xs text-slate-500 dark:text-slate-400">
            <span className="hidden sm:inline font-medium">{language === 'fr' ? 'Lignes\u00A0:' : 'Rows:'}</span>
            <select
              value={rowsPerPage}
              onChange={(e) => setRowsPerPage(Number(e.target.value))}
              className="bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:border-indigo-500 font-sans font-medium"
            >
              <option value={15}>15</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={0}>{language === 'fr' ? 'Tous' : 'All'}</option>
            </select>
          </div>
        </div>

        {/* Vendor List (Contained and cleanly scrolled) */}
        <div className="flex-1 overflow-y-auto p-3.5 sm:p-4 space-y-2 max-h-[52vh] custom-scrollbar">
          {filteredVendors.length === 0 ? (
            <div className="py-12 text-center text-slate-500 dark:text-slate-400">
              <Cpu className="w-10 h-10 text-slate-400 dark:text-slate-600 mx-auto mb-2 opacity-60" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                {language === 'fr' ? 'Aucun fabricant trouvé.' : 'No manufacturer found.'}
              </p>
              <p className="text-xs mt-1">
                {language === 'fr'
                  ? `Aucun résultat pour "${searchQuery}"`
                  : `No results for "${searchQuery}"`}
              </p>
            </div>
          ) : (
            paginatedVendors.map((item) => {
              const originalRank = allVendors.findIndex((v) => v.vendor === item.vendor) + 1;
              const isTop3 = originalRank <= 3;
              const isOther = item.vendor.toLowerCase().includes('other') || item.vendor.toLowerCase().includes('autre');

              return (
                <div
                  key={item.vendor}
                  className={`px-3 py-2 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                    isTop3
                      ? 'bg-indigo-50/50 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-800/60'
                      : 'bg-slate-50/70 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    {/* Rank Badge */}
                    <span
                      className={`w-6 h-6 rounded-md flex items-center justify-center font-black text-[11px] shrink-0 font-sans ${
                        originalRank === 1
                          ? 'bg-amber-400 text-slate-950 shadow-xs'
                          : originalRank === 2
                          ? 'bg-slate-300 text-slate-950 shadow-xs'
                          : originalRank === 3
                          ? 'bg-amber-700 text-white shadow-xs'
                          : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      #{originalRank}
                    </span>

                    {/* Vendor Name & Progress Bar */}
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-xs text-slate-900 dark:text-white truncate">
                          {language === 'fr' && isOther ? 'Autres fabricants' : item.vendor}
                        </span>
                        <div className="flex items-center gap-2 font-sans shrink-0">
                          <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 font-sans">
                            {item.count} {language === 'fr' ? (item.count > 1 ? 'réseaux' : 'réseau') : (item.count > 1 ? 'APs' : 'AP')}
                          </span>
                          <span className="text-[11px] font-black text-indigo-600 dark:text-indigo-400 min-w-[36px] text-right">
                            {item.percentageFormatted}
                          </span>
                        </div>
                      </div>

                      <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-1 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-cyan-500 transition-all duration-300"
                          style={{ width: `${Math.min(100, Math.max(item.percentage, 1))}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Filter Action Button */}
                  {onFilterByVendor && !isOther && (
                    <button
                      type="button"
                      onClick={() => {
                        onFilterByVendor(item.vendor);
                        onClose();
                      }}
                      className="shrink-0 px-2 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 text-slate-700 dark:text-slate-300 text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                      title={language === 'fr' ? 'Ajouter un filtre pour ce fabricant' : 'Add filter for this manufacturer'}
                    >
                      <Filter className="w-3 h-3" />
                      <span>{language === 'fr' ? 'Filtrer' : 'Filter'}</span>
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Pagination & Footer */}
        <div className="p-3 sm:p-4 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50 dark:bg-slate-900 text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-2">
            <span>
              {language === 'fr' ? 'Résultats\u00A0:' : 'Showing:'}{' '}
              <strong className="text-slate-700 dark:text-slate-300 font-sans">
                {filteredVendors.length > 0
                  ? rowsPerPage === 0
                    ? `1 - ${filteredVendors.length}`
                    : `${(currentPage - 1) * rowsPerPage + 1} - ${Math.min(
                        currentPage * rowsPerPage,
                        filteredVendors.length
                      )}`
                  : '0'}
              </strong>{' '}
              {language === 'fr' ? 'sur' : 'of'}{' '}
              <strong className="text-slate-700 dark:text-slate-300 font-sans">{filteredVendors.length}</strong>
            </span>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title={language === 'fr' ? 'Première page' : 'First page'}
              >
                <ChevronsLeft className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title={language === 'fr' ? 'Page précédente' : 'Previous page'}
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>

              <span className="px-2.5 py-1 text-xs font-semibold text-slate-700 dark:text-slate-300 font-sans">
                {currentPage} / {totalPages}
              </span>

              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title={language === 'fr' ? 'Page suivante' : 'Next page'}
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title={language === 'fr' ? 'Dernière page' : 'Last page'}
              >
                <ChevronsRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold transition-colors cursor-pointer"
          >
            {language === 'fr' ? 'Fermer' : 'Close'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
