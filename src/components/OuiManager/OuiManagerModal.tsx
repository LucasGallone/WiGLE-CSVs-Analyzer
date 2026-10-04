import React, { useState, useMemo } from 'react';
import {
  OFFICIAL_IEEE_DATABASE,
  resolveVendor,
  syncFromOfficialIeee,
  IEEE_OUI_URL,
} from '../../data/ouiDatabase';
import { useLanguage } from '../../context/LanguageContext';
import {
  X,
  Layers,
  Search,
  CheckCircle,
  AlertCircle,
  Database,
  RefreshCw,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';

interface OuiManagerModalProps {
  customOuiMap?: Record<string, string>;
  onUpdateCustomOuiMap?: (newMap: Record<string, string>) => void;
  onClose: () => void;
}

export const OuiManagerModal: React.FC<OuiManagerModalProps> = ({
  customOuiMap = {},
  onClose,
}) => {
  const { language } = useLanguage();
  const [activeTab, setActiveTab] = useState<'view' | 'search'>('view');
  const [testMac, setTestMac] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'prefix' | 'vendor'>('prefix');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [isSyncing, setIsSyncing] = useState(false);
  const [page, setPage] = useState(1);
  const rowsPerPage = 20;

  const handleSort = (column: 'prefix' | 'vendor') => {
    if (sortBy === column) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(column);
      setSortDir('asc');
    }
    setPage(1);
  };

  const [importStatus, setImportStatus] = useState<{
    success?: boolean;
    count?: number;
    errors?: number;
    message?: string;
  } | null>(null);

  const totalCount = Object.keys(OFFICIAL_IEEE_DATABASE).length;

  // Live resolution test against official IEEE database
  const testResolved = resolveVendor(testMac, customOuiMap);

  // Sync from official IEEE endpoint
  const handleSyncIeee = async () => {
    setIsSyncing(true);
    setImportStatus(null);
    try {
      const res = await syncFromOfficialIeee();
      setImportStatus({
        success: res.success,
        count: res.count,
        message:
          language === 'fr'
            ? res.success
              ? `Mise à jour de la base IEEE réussie\u00A0: ${res.count?.toLocaleString()} préfixes trouvés.`
              : (res.message || 'Erreur lors de la mise à jour de la base IEEE via standards-oui.ieee.org')
            : res.message,
      });
    } catch {
      setImportStatus({
        success: false,
        message:
          language === 'fr'
            ? 'Erreur lors de la mise à jour de la base IEEE via standards-oui.ieee.org'
            : 'An error occurred during the IEEE database update via standards-oui.ieee.org',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  // Filter and sort official IEEE entries for browser tab
  const filteredEntries = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const list: Array<{ prefix: string; vendor: string }> = [];

    for (const [prefix, vendor] of Object.entries(OFFICIAL_IEEE_DATABASE)) {
      if (!q || prefix.toLowerCase().includes(q) || vendor.toLowerCase().includes(q)) {
        list.push({ prefix, vendor });
      }
    }

    list.sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'prefix') {
        cmp = a.prefix.localeCompare(b.prefix);
        if (cmp === 0) cmp = a.vendor.localeCompare(b.vendor);
      } else {
        cmp = a.vendor.localeCompare(b.vendor);
        if (cmp === 0) cmp = a.prefix.localeCompare(b.prefix);
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return list;
  }, [searchQuery, sortBy, sortDir]);

  const totalPages = Math.ceil(filteredEntries.length / rowsPerPage) || 1;
  const paginatedEntries = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    return filteredEntries.slice(start, start + rowsPerPage);
  }, [filteredEntries, page, rowsPerPage]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-3xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] transition-colors">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-100 dark:bg-indigo-950 border border-indigo-300 dark:border-indigo-700/50 text-indigo-600 dark:text-indigo-400">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                {language === 'fr'
                  ? 'Base de données des préfixes OUI (IEEE)'
                  : 'OUI Prefixes Database (IEEE)'}
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs (Only Browse and MAC Lookup) */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 px-6 pt-2">
          <button
            onClick={() => setActiveTab('view')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
              activeTab === 'view'
                ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 rounded-t-lg'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>
              {language === 'fr'
                ? `Parcourir la base de données IEEE (${totalCount.toLocaleString()})`
                : `Browse IEEE Database (${totalCount.toLocaleString()})`}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('search')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
              activeTab === 'search'
                ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 rounded-t-lg'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            <span>
              {language === 'fr' ? 'Rechercher une adresse MAC / OUI' : 'OUI/MAC Address Lookup'}
            </span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6 space-y-5 overflow-y-auto custom-scrollbar flex-1">
          {activeTab === 'view' && (
            <div className="space-y-4">
              {/* Search & Sync Actions */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setPage(1);
                    }}
                    placeholder={
                      language === 'fr'
                        ? 'Rechercher par préfixe OUI / MAC ou par nom de fabricant...'
                        : 'Search by OUI / MAC prefix or by manufacturer name...'
                    }
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSyncIeee}
                    disabled={isSyncing}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-300 dark:border-indigo-700/60 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/80 text-xs font-semibold shadow-sm transition-all disabled:opacity-50 cursor-pointer"
                    title={
                      language === 'fr'
                        ? 'Télécharger la dernière version de la base de données IEEE via standards-oui.ieee.org'
                        : 'Download the latest IEEE database version from standards-oui.ieee.org'
                    }
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                    <span>
                      {isSyncing
                        ? language === 'fr'
                          ? 'Mise à jour en cours...'
                          : 'Update in progress...'
                        : language === 'fr'
                        ? 'Mettre à jour'
                        : 'Update'}
                    </span>
                  </button>

                  <a
                    href={IEEE_OUI_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                    title={
                      language === 'fr'
                        ? 'Accéder au fichier officiel de l\'IIEEE (standards-oui.ieee.org/oui/oui.txt)'
                        : 'Access the official IEEE file (standards-oui.ieee.org/oui/oui.txt)'
                    }
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>

              {/* Status Message */}
              {importStatus && (
                <div
                  className={`flex items-start gap-2 p-3 rounded-xl text-xs ${
                    importStatus.success
                      ? 'bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-700/60 text-emerald-800 dark:text-emerald-300'
                      : 'bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-700/60 text-rose-800 dark:text-rose-300'
                  }`}
                >
                  {importStatus.success ? (
                    <CheckCircle className="w-4 h-4 shrink-0 text-emerald-500" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                  )}
                  <p className="font-semibold">{importStatus.message}</p>
                </div>
              )}

              {/* Table of Entries */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/60 overflow-hidden">
                {/* Table Header with Sort Buttons */}
                <div className="px-3.5 py-2 bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-400 select-none">
                  <div className="flex items-center gap-6">
                    <button
                      type="button"
                      onClick={() => handleSort('prefix')}
                      className={`flex items-center gap-1.5 hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer transition-colors ${
                        sortBy === 'prefix' ? 'text-indigo-600 dark:text-indigo-400 font-bold' : ''
                      }`}
                      title={language === 'fr' ? 'Trier par préfixe OUI' : 'Sort by OUI prefix'}
                    >
                      <span>{language === 'fr' ? 'Préfixe OUI' : 'OUI Prefix'}</span>
                      {sortBy === 'prefix' ? (
                        sortDir === 'asc' ? (
                          <ArrowUp className="w-3.5 h-3.5" />
                        ) : (
                          <ArrowDown className="w-3.5 h-3.5" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 opacity-60" />
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSort('vendor')}
                      className={`flex items-center gap-1.5 hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer transition-colors ${
                        sortBy === 'vendor' ? 'text-indigo-600 dark:text-indigo-400 font-bold' : ''
                      }`}
                      title={language === 'fr' ? 'Trier par nom de fabricant' : 'Sort by manufacturer name'}
                    >
                      <span>{language === 'fr' ? 'Fabricant' : 'Manufacturer'}</span>
                      {sortBy === 'vendor' ? (
                        sortDir === 'asc' ? (
                          <ArrowUp className="w-3.5 h-3.5" />
                        ) : (
                          <ArrowDown className="w-3.5 h-3.5" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 opacity-60" />
                      )}
                    </button>
                  </div>

                  <span className="text-[10px] text-slate-400 uppercase font-semibold">
                    {language === 'fr' ? 'Source' : 'Source'}
                  </span>
                </div>

                <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60">
                  {paginatedEntries.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-500 dark:text-slate-400">
                      {language === 'fr'
                        ? 'Aucun fabricant ne correspond à votre recherche.'
                        : 'No manufacturer matches your search.'}
                    </div>
                  ) : (
                    paginatedEntries.map((item) => (
                      <div
                        key={item.prefix}
                        className="px-3.5 py-2.5 flex items-center justify-between text-xs hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="font-sans font-bold text-cyan-700 dark:text-cyan-400 tracking-tight">
                            {item.prefix}
                          </span>
                          <span className="text-slate-800 dark:text-slate-200 font-medium truncate max-w-sm sm:max-w-md">
                            {item.vendor}
                          </span>
                        </div>
                        <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                          IEEE
                        </span>
                      </div>
                    ))
                  )}
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between px-4 py-2.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs text-slate-500 dark:text-slate-400">
                  <span>
                    {language === 'fr' ? (
                      <>
                        Affichage de{' '}
                        {filteredEntries.length > 0 ? (page - 1) * rowsPerPage + 1 : 0} à{' '}
                        {Math.min(page * rowsPerPage, filteredEntries.length)} sur{' '}
                        {filteredEntries.length.toLocaleString()}
                      </>
                    ) : (
                      <>
                        Showing {filteredEntries.length > 0 ? (page - 1) * rowsPerPage + 1 : 0} to{' '}
                        {Math.min(page * rowsPerPage, filteredEntries.length)} of{' '}
                        {filteredEntries.length.toLocaleString()}
                      </>
                    )}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="p-1 rounded bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 disabled:opacity-30 cursor-pointer"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="px-2 font-sans font-bold">
                      {page} / {totalPages}
                    </span>
                    <button
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page >= totalPages}
                      className="p-1 rounded bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 disabled:opacity-30 cursor-pointer"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'search' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  {language === 'fr'
                    ? 'Indiquez une adresse MAC complète ou un préfixe OUI à 3 octets.'
                    : 'Enter a full MAC address or a 3-octet OUI prefix.'}
                </label>
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={testMac}
                    onChange={(e) => setTestMac(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl pl-10 pr-4 py-2.5 font-sans font-bold text-sm text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Resolved Card */}
              <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-5 rounded-xl space-y-3">
                <div className="text-xs text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">
                  {language === 'fr'
                    ? 'Fabricant identifié\u00A0:'
                    : 'Identified Manufacturer:'}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xl font-bold text-slate-900 dark:text-white">
                    {testResolved.vendor === '[Unassigned by IEEE]' && language === 'fr'
                      ? "[Non assigné par l'IEEE]"
                      : (testResolved.vendor === 'Unknown' || testResolved.vendor === 'Inconnu') && language === 'fr'
                      ? 'Inconnu'
                      : testResolved.vendor}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {testResolved.isRandomized && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                        {language === 'fr' ? 'MAC aléatoire' : 'Randomized MAC'}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end px-6 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/80">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-900 dark:text-white text-xs font-semibold transition-colors cursor-pointer"
          >
            {language === 'fr' ? 'Fermer' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
};
