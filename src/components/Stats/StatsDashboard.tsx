import React, { useState, useMemo } from 'react';
import { ScanSessionData, ProcessedAccessPoint, AnalysisMode } from '../../types/wigle';
import { calculateStats, calculateBtStats, formatPercentage, calculatePercentagesWithExactSum } from '../../utils/statsUtils';
import { useLanguage } from '../../context/LanguageContext';
import { VendorRankingModal } from './VendorRankingModal';
import {
  Wifi,
  Bluetooth,
  Radio,
  Lock,
  Unlock,
  ShieldCheck,
  Cpu,
  BarChart3,
  Signal,
  ExternalLink,
  RotateCcw,
  Headphones,
  Smartphone,
  Watch,
  Keyboard,
  Car,
  Heart,
  Bot,
  Tv,
  HelpCircle,
  Tag,
} from 'lucide-react';

interface StatsDashboardProps {
  session: ScanSessionData | null;
  filteredAps?: ProcessedAccessPoint[];
  isFilterActive?: boolean;
  isSecurityFiltered?: boolean;
  isVendorFiltered?: boolean;
  isCategoryFiltered?: boolean;
  isWigleDevice?: boolean;
  analysisMode?: AnalysisMode;
  onFilterBySecurity?: (type: string) => void;
  onFilterByVendor?: (vendor: string) => void;
  onFilterByCategory?: (category: string) => void;
  onResetSecurityFilter?: () => void;
  onResetVendorFilter?: () => void;
  onResetCategoryFilter?: () => void;
}

export const StatsDashboard: React.FC<StatsDashboardProps> = ({
  session,
  filteredAps,
  isFilterActive = false,
  isSecurityFiltered = false,
  isVendorFiltered = false,
  isCategoryFiltered = false,
  isWigleDevice = false,
  analysisMode = 'WIFI',
  onFilterBySecurity,
  onFilterByVendor,
  onFilterByCategory,
  onResetSecurityFilter,
  onResetVendorFilter,
  onResetCategoryFilter,
}) => {
  const { t, language } = useLanguage();
  const [isVendorModalOpen, setIsVendorModalOpen] = useState(false);
  
  const stats = useMemo(() => {
    if (analysisMode === 'BT') return null;
    return calculateStats(session, filteredAps);
  }, [session, filteredAps, analysisMode]);

  const btStats = useMemo(() => {
    if (analysisMode !== 'BT') return null;
    return calculateBtStats(session, filteredAps);
  }, [session, filteredAps, analysisMode]);

  if (!session) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center text-slate-500 dark:text-slate-400 shadow-sm transition-colors">
        {analysisMode === 'BT' ? (
          <Bluetooth className="w-12 h-12 text-slate-400 dark:text-slate-600 mx-auto mb-3" />
        ) : (
          <Wifi className="w-12 h-12 text-slate-400 dark:text-slate-600 mx-auto mb-3" />
        )}
        <p className="font-semibold text-slate-700 dark:text-slate-300">
          {language === 'fr' ? 'Aucune donnée de session disponible.' : 'No session data available.'}
        </p>
        <p className="text-xs mt-1">
          {language === 'fr' ? 'Importez un fichier CSV complet pour générer les analyses.' : 'Import a complete CSV file to generate comprehensive analytics.'}
        </p>
      </div>
    );
  }

  if (filteredAps && filteredAps.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center text-slate-500 dark:text-slate-400 shadow-sm transition-colors flex flex-col items-center justify-center">
        <BarChart3 className="w-12 h-12 text-amber-500 mx-auto mb-3" />
        <p className="font-bold text-slate-800 dark:text-slate-200 text-sm">
          {language === 'fr' ? (analysisMode === 'BT' ? 'Aucun périphérique Bluetooth ne correspond à vos filtres actifs.' : 'Aucun réseau ne correspond à vos filtres actifs.') : (analysisMode === 'BT' ? 'No Bluetooth devices match your active filters.' : 'No networks match your active filters.')}
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md">
          {language === 'fr'
            ? 'Veuillez modifier ou réinitialiser vos critères de recherche pour afficher les statistiques.'
            : 'Please modify or reset your active filters to display statistics.'}
        </p>
      </div>
    );
  }

  // Bluetooth Mode Dashboard View
  if (analysisMode === 'BT' && btStats) {
    const getCategoryIcon = (iconName: string) => {
      switch (iconName) {
        case 'Headphones': return <Headphones className="w-4 h-4" />;
        case 'Smartphone': return <Smartphone className="w-4 h-4" />;
        case 'Watch': return <Watch className="w-4 h-4" />;
        case 'Keyboard': return <Keyboard className="w-4 h-4" />;
        case 'Car': return <Car className="w-4 h-4" />;
        case 'Heart': case 'Activity': case 'Thermometer': case 'Scale': return <Heart className="w-4 h-4" />;
        case 'Gamepad2': case 'Toy': case 'Bot': return <Bot className="w-4 h-4" />;
        case 'Tv': case 'Video': case 'Camera': return <Tv className="w-4 h-4" />;
        default: return <Bluetooth className="w-4 h-4" />;
      }
    };

    return (
      <div className="space-y-5">
        {/* Main Bluetooth KPI Row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* 1. Total Unique Bluetooth Devices */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3.5 rounded-2xl shadow-sm dark:shadow-lg">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider">
                {language === 'fr' ? 'PÉRIPHÉRIQUES BLUETOOTH' : 'BLUETOOTH DEVICES'}
              </span>
              <Bluetooth className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div className="text-2xl font-black text-slate-900 dark:text-white font-sans tracking-tight">
              {btStats.totalUniqueDevices.toLocaleString()}
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
              {btStats.totalObservations.toLocaleString()} {language === 'fr' ? 'captures au total' : 'captures in total'}
            </div>
          </div>

          {/* 2. Named Devices (with Broadcast Name) */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3.5 rounded-2xl shadow-sm dark:shadow-lg">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider">
                {language === 'fr' ? 'PÉRIPHÉRIQUES NOMMÉS' : 'NAMED DEVICES'}
              </span>
              <Tag className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
            </div>
            <div className="text-2xl font-black text-slate-900 dark:text-white font-sans tracking-tight">
              {btStats.totalNamedDevices.toLocaleString()}
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
              {formatPercentage(btStats.totalNamedDevices, btStats.totalUniqueDevices)} {language === 'fr' ? 'de périphériques avec un nom affiché' : 'of devices with a displayed name'}
            </div>
          </div>

          {/* 3. Unnamed / Anonymous Devices */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3.5 rounded-2xl shadow-sm dark:shadow-lg">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider">
                {language === 'fr' ? 'PÉRIPHÉRIQUES SANS NOM' : 'UNNAMED DEVICES'}
              </span>
              <HelpCircle className="w-4 h-4 text-slate-400" />
            </div>
            <div className="text-2xl font-black text-slate-700 dark:text-slate-300 font-sans tracking-tight">
              {btStats.totalUnnamedDevices.toLocaleString()}
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
              {formatPercentage(btStats.totalUnnamedDevices, btStats.totalUniqueDevices)} {language === 'fr' ? 'avec un nom masqué' : 'with hidden name'}
            </div>
          </div>

          {/* 4. Average Signal RSSI */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3.5 rounded-2xl shadow-sm dark:shadow-lg">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider">
                {language === 'fr' ? 'SIGNAL MOYEN (RSSI)' : 'AVERAGE SIGNAL'}
              </span>
              <Signal className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-sans tracking-tight">
              {btStats.averageRssi} dBm
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
              {language === 'fr' ? `Niveau maximal : ${btStats.bestRssi} dBm` : `Max Level: ${btStats.bestRssi} dBm`}
            </div>
          </div>

          {/* 5. Identified Manufacturers */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3.5 rounded-2xl shadow-sm dark:shadow-lg">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider">
                {language === 'fr' ? 'FABRICANTS DÉTECTÉS' : 'DETECTED MANUFACTURERS'}
              </span>
              <Cpu className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="text-2xl font-black text-purple-600 dark:text-purple-400 font-sans tracking-tight">
              {btStats.totalUniqueVendors.toLocaleString()}
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
              {language === 'fr' ? 'Fabricants identifiés' : 'Identified manufacturers'}
            </div>
          </div>

          {/* 6. Device Categories */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3.5 rounded-2xl shadow-sm dark:shadow-lg">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider">
                {language === 'fr' ? 'CATÉGORIES DE PÉRIPHÉRIQUES' : 'DEVICE CATEGORIES'}
              </span>
              <HelpCircle className="w-4 h-4 text-amber-500 dark:text-amber-400" />
            </div>
            <div className="text-2xl font-black text-amber-600 dark:text-amber-400 font-sans tracking-tight">
              {btStats.categoryBreakdown.length}
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
              {language === 'fr' ? 'catégories différentes identifiées par WiGLE' : 'different categories identified by WiGLE'}
            </div>
          </div>
        </div>

        {/* Main Analysis Panels: Categories & Manufacturers */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Categories Breakdown */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm dark:shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800 gap-2 flex-wrap">
              <div className="flex items-center gap-2 font-bold text-sm text-slate-900 dark:text-white">
                <Bluetooth className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span>{language === 'fr' ? 'Catégories de périphériques Bluetooth' : 'Bluetooth Device Categories'}</span>
                {(isCategoryFiltered || isFilterActive) && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-slate-950 uppercase tracking-wide">
                    {language === 'fr' ? 'FILTRAGE ACTIF' : 'FILTERED'}
                  </span>
                )}
              </div>

              {isCategoryFiltered && onResetCategoryFilter && (
                <button
                  type="button"
                  onClick={onResetCategoryFilter}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 dark:hover:bg-rose-900 border border-rose-200 dark:border-rose-800 transition-colors shadow-xs cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>{language === 'fr' ? 'Réinitialiser' : 'Reset'}</span>
                </button>
              )}
            </div>

            <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1 custom-scrollbar">
              {btStats.categoryBreakdown.map((cat) => {
                const label = language === 'fr' ? cat.labelFr : cat.labelEn;
                return (
                  <div
                    key={cat.id}
                    onClick={() => onFilterByCategory && onFilterByCategory(cat.labelEn)}
                    className="group cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40 p-2 rounded-xl transition-all"
                  >
                    <div className="flex items-center justify-between text-xs mb-1.5 font-medium">
                      <div className="flex items-center gap-2">
                        <span
                          className="p-1 rounded-lg text-white"
                          style={{ backgroundColor: cat.color }}
                        >
                          {getCategoryIcon(cat.iconName)}
                        </span>
                        <span className="text-slate-800 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-300 transition-colors font-semibold">
                          {label}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 font-sans">
                        <span className="text-slate-500 dark:text-slate-400 font-medium">{cat.count.toLocaleString()}</span>
                        <span className="font-bold text-slate-900 dark:text-white min-w-[36px] text-right">{cat.percentageFormatted}</span>
                      </div>
                    </div>

                    <div className="w-full bg-slate-100 dark:bg-slate-950 rounded-full h-2 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: cat.percentage > 0 ? `${cat.percentage}%` : '0%',
                          backgroundColor: cat.color,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Top Bluetooth Manufacturers */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm dark:shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800 gap-2 flex-wrap">
              <div className="flex items-center gap-2 font-bold text-sm text-slate-900 dark:text-white">
                <Cpu className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                <span>{language === 'fr' ? 'Principaux fabricants détectés' : 'Top Detected Manufacturers'}</span>
                {(isVendorFiltered || isFilterActive) && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-slate-950 uppercase tracking-wide">
                    {language === 'fr' ? 'FILTRAGE ACTIF' : 'FILTERED'}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {isVendorFiltered && onResetVendorFilter && (
                  <button
                    type="button"
                    onClick={onResetVendorFilter}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 dark:hover:bg-rose-900 border border-rose-200 dark:border-rose-800 transition-colors shadow-xs cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>{language === 'fr' ? 'Réinitialiser' : 'Reset'}</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setIsVendorModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900 border border-indigo-200 dark:border-indigo-800 transition-colors shadow-xs cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>{language === 'fr' ? 'Voir la liste complète' : 'View full list'}</span>
                </button>
              </div>
            </div>

            <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1 custom-scrollbar">
              {btStats.vendorBreakdown.map((v) => {
                const isOther = v.vendor.toLowerCase().includes('other') || v.vendor.toLowerCase().includes('autre');
                return (
                  <div
                    key={v.vendor}
                    onClick={() => {
                      if (isOther) return;
                      if (onFilterByVendor) onFilterByVendor(v.vendor);
                    }}
                    className={`group p-1.5 rounded-xl transition-all ${
                      isOther
                        ? 'cursor-default opacity-80 select-none'
                        : 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs mb-1 font-medium gap-2">
                      <span
                        title={isOther ? '' : v.vendor}
                        className={`truncate flex-1 min-w-0 pr-1 ${
                          isOther
                            ? 'text-slate-500 dark:text-slate-400 italic'
                            : 'text-slate-800 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-300 transition-colors font-semibold'
                        }`}
                      >
                        {language === 'fr' && isOther ? 'Autres fabricants' : v.vendor}
                      </span>
                      <div className="flex items-center gap-2 font-sans shrink-0">
                        <span className="text-slate-500 dark:text-slate-400 font-medium">{v.count.toLocaleString()}</span>
                        <span className="font-bold text-slate-900 dark:text-white min-w-[32px] text-right">{v.percentageFormatted}</span>
                      </div>
                    </div>

                    <div className="w-full bg-slate-100 dark:bg-slate-950 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-blue-500 transition-all duration-500"
                        style={{ width: v.percentage > 0 ? `${v.percentage}%` : '0%' }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Secondary Analysis Row: Signal RSSI */}
        <div className="grid grid-cols-1 gap-5">
          {/* Signal RSSI Distribution */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm dark:shadow-xl space-y-3">
            <div className="flex items-center gap-2 font-bold text-sm text-slate-900 dark:text-white pb-2 border-b border-slate-200 dark:border-slate-800">
              <Signal className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>{language === 'fr' ? 'Répartition des niveaux de signal (RSSI)' : 'Signal Strength Ranking (RSSI)'}</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-1">
              {btStats.rssiBreakdown.map((rb) => (
                <div key={rb.range} className="space-y-1.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-700 dark:text-slate-300 font-semibold">
                      {rb.range}
                    </span>
                    <span className="font-sans font-bold text-slate-900 dark:text-white">
                      {rb.count} ({rb.percentageFormatted})
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400">
                    {rb.label}
                  </div>
                  <div className="w-full bg-slate-200 dark:bg-slate-950 rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: rb.percentage > 0 ? `${rb.percentage}%` : '0%',
                        backgroundColor: rb.color,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Full Vendor Ranking Modal */}
        <VendorRankingModal
          isOpen={isVendorModalOpen}
          onClose={() => setIsVendorModalOpen(false)}
          allVendors={btStats.allVendorsBreakdown}
          totalUniqueAPs={btStats.totalUniqueDevices}
          onFilterByVendor={onFilterByVendor}
        />
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  const [withEncStat, withoutEncStat] = calculatePercentagesWithExactSum(
    [{ count: stats.totalWithEncryption }, { count: stats.totalWithoutEncryption }],
    stats.totalUniqueAPs
  );

  const getSecurityDisplayLabel = (type: string, fallbackLabel: string) => {
    if (language === 'fr') {
      if (type === 'OPEN') return 'Ouvert (Sans chiffrement + OWE)';
      if (type === 'WPA3_ENTERPRISE') return 'WPA3 Entreprise';
      if (type === 'ENTERPRISE') return 'WPA2 Entreprise';
      if (type === 'WPA1_ENTERPRISE') return 'WPA1 Entreprise';
      if (type === 'WPA_WPA2') return 'WPA1 / WPA2 (Mixte)';
      if (type === 'UNKNOWN') return 'Autre / Inconnu';
    }
    return fallbackLabel;
  };

  return (
    <div className="space-y-5">
      {/* Main KPI Row strictly displaying all 6 requested metrics permanently without hover animations */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* 1. Unique Networks */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3.5 rounded-2xl shadow-sm dark:shadow-lg">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider">{t('kpi.uniqueNetworks')}</span>
            <Wifi className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white font-sans tracking-tight">{stats.totalUniqueAPs.toLocaleString()}</div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">{stats.totalObservations.toLocaleString()} {t('status.totalRecords')}</div>
        </div>

        {/* 2. Unique SSIDs */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3.5 rounded-2xl shadow-sm dark:shadow-lg">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider">{t('kpi.uniqueSsids')}</span>
            <Radio className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white font-sans tracking-tight">{stats.totalUniqueSSIDs.toLocaleString()}</div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">{stats.totalHiddenSSIDs.toLocaleString()} {t('kpi.hiddenSsids')}</div>
        </div>

        {/* 3. With Encryption (WEP included) */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3.5 rounded-2xl shadow-sm dark:shadow-lg">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider">{t('kpi.withEncryption')}</span>
            <Lock className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-sans tracking-tight">
            {stats.totalWithEncryption.toLocaleString()}
          </div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
            {withEncStat?.percentageFormatted ?? formatPercentage(stats.totalWithEncryption, stats.totalUniqueAPs)} {language === 'fr' ? 'des réseaux' : 'of networks'}
          </div>
        </div>

        {/* 4. Open Networks */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3.5 rounded-2xl shadow-sm dark:shadow-lg">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider">
              {language === 'fr' ? 'RÉSEAUX OUVERTS' : 'OPEN NETWORKS'}
            </span>
            <Unlock className="w-4 h-4 text-rose-500 dark:text-rose-400" />
          </div>
          <div className="text-2xl font-black text-rose-600 dark:text-rose-400 font-sans tracking-tight">
            {stats.totalWithoutEncryption.toLocaleString()}
          </div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
            {language === 'fr' ? 'Sans chiffrement + OWE • ' : 'Unencrypted + OWE • '}
            {withoutEncStat?.percentageFormatted ?? formatPercentage(stats.totalWithoutEncryption, stats.totalUniqueAPs)}
          </div>
        </div>

        {/* 5. Detected Vendors */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3.5 rounded-2xl shadow-sm dark:shadow-lg">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider">{t('kpi.detectedVendors')}</span>
            <Cpu className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          </div>
          <div className="text-2xl font-black text-purple-600 dark:text-purple-400 font-sans tracking-tight">{stats.totalUniqueVendors.toLocaleString()}</div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">{t('kpi.manufacturers')}</div>
        </div>

        {/* 6. WPS Networks (Permanently visible) */}
        <div className="bg-white dark:bg-slate-900 border border-amber-300/80 dark:border-amber-700/60 p-3.5 rounded-2xl shadow-sm dark:shadow-lg">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">{t('kpi.wpsEnabled')}</span>
            <span className="text-[11px] font-bold px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700/60">
              WPS
            </span>
          </div>
          <div className="text-2xl font-black text-amber-600 dark:text-amber-400 font-sans tracking-tight">{stats.totalWpsNetworks.toLocaleString()}</div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
            {formatPercentage(stats.totalWpsNetworks, stats.totalUniqueAPs)} {t('kpi.withWps')}
          </div>
        </div>
      </div>

      {/* Main Analysis Panels (2 columns) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Security & Encryption Breakdown */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm dark:shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800 gap-2 flex-wrap">
            <div className="flex items-center gap-2 font-bold text-sm text-slate-900 dark:text-white">
              <Lock className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
              <span>{t('dashboard.securityBreakdown')}</span>
              {(isSecurityFiltered || isFilterActive) && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-slate-950 uppercase tracking-wide">
                  {language === 'fr' ? 'FILTRAGE ACTIF' : 'FILTERED'}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {/* Reset button specific to Security filter */}
              {isSecurityFiltered && onResetSecurityFilter && (
                <button
                  type="button"
                  onClick={onResetSecurityFilter}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 dark:hover:bg-rose-900 border border-rose-200 dark:border-rose-800 transition-colors shadow-xs cursor-pointer"
                  title={language === 'fr' ? 'Réinitialiser le filtre de sécurité' : 'Reset security filter'}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>{language === 'fr' ? 'Réinitialiser' : 'Reset'}</span>
                </button>
              )}

              {/* Hide total unique networks when filtering is active as requested */}
              {!isFilterActive && !isSecurityFiltered && (
                <span className="text-xs text-slate-500 dark:text-slate-400 font-sans font-medium">
                  {language === 'fr'
                    ? `Sur un total de ${stats.totalUniqueAPs.toLocaleString()} réseaux uniques`
                    : `Based on ${stats.totalUniqueAPs.toLocaleString()} unique networks`}
                </span>
              )}
            </div>
          </div>

          <div className="space-y-3">
            {(isWigleDevice
              ? stats.securityBreakdown.filter(
                  (sec) =>
                    sec.type !== 'WPA3_ENTERPRISE' &&
                    sec.type !== 'WPA2_WPA3' &&
                    sec.type !== 'WPA_WPA2' &&
                    sec.type !== 'ENTERPRISE' &&
                    sec.type !== 'WPA1_ENTERPRISE'
                )
              : stats.securityBreakdown
            ).map((sec, index) => {
              const hasTooltip = !isWigleDevice && sec.type !== 'WEP' && Boolean(sec.ciphers && sec.ciphers.length > 0);

              return (
                <div
                  key={sec.label}
                  onClick={() => onFilterBySecurity && onFilterBySecurity(sec.type)}
                  className="relative group cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40 p-2 rounded-xl transition-all"
                >
                  <div className="flex items-center justify-between text-xs mb-1.5 font-medium">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: sec.color }} />
                      <span className="text-slate-800 dark:text-slate-200 group-hover:text-cyan-600 dark:group-hover:text-cyan-300 transition-colors font-semibold">
                        {getSecurityDisplayLabel(sec.type, sec.label)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 font-sans">
                      <span className="text-slate-500 dark:text-slate-400 font-medium">{sec.count.toLocaleString()}</span>
                      <span className="font-bold text-slate-900 dark:text-white min-w-[36px] text-right">{sec.percentageFormatted}</span>
                    </div>
                  </div>

                  <div className="w-full bg-slate-100 dark:bg-slate-950 rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: sec.percentage > 0 ? `${sec.percentage}%` : '0%',
                        backgroundColor: sec.color,
                      }}
                    />
                  </div>

                  {/* Stylized custom tooltip (fluid GPU-accelerated CSS hover) */}
                  {hasTooltip && sec.ciphers && (
                    <div
                      role="tooltip"
                      className={`absolute z-50 pointer-events-none left-2 sm:left-4 w-max max-w-[460px] min-w-[280px] p-3 rounded-xl shadow-2xl border border-slate-700/80 bg-slate-950/95 dark:bg-slate-900/95 backdrop-blur-md text-white opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 ease-out transform group-hover:scale-100 scale-95 ${
                        index <= 1 ? 'top-full mt-1.5' : 'bottom-full mb-1.5'
                      }`}
                    >
                      {/* Tooltip Header (Strictly Single Line) */}
                      <div className="flex items-center gap-1.5 pb-2 mb-2 border-b border-slate-800 dark:border-slate-800 text-[11.5px] font-bold text-cyan-400 whitespace-nowrap">
                        <ShieldCheck className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                        <span className="whitespace-nowrap">
                          {language === 'fr'
                            ? `Protocoles de chiffrement détectés pour ${getSecurityDisplayLabel(sec.type, sec.label)}`
                            : `Statistics of detected ciphers for ${sec.label}`}
                        </span>
                      </div>

                      {/* Tooltip Ciphers List: only category percentage */}
                      <div className="space-y-1.5">
                        {sec.ciphers.map((c) => (
                          <div
                            key={c.key}
                            className="flex items-center justify-between gap-3 text-[11px] font-sans"
                          >
                            <div className="flex items-center gap-1.5 text-slate-200">
                              <span className="text-cyan-400 font-bold shrink-0">•</span>
                              <span className="font-medium">
                                {language === 'fr' ? c.labelFr : c.labelEn}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="font-bold text-white font-sans">
                                {c.count.toLocaleString()}
                              </span>
                              <span className="text-cyan-300 font-semibold font-mono text-[10.5px]">
                                ({language === 'fr' ? c.percentageFormattedFr : c.percentageFormattedEn})
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Top Hardware Vendors */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm dark:shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800 gap-2 flex-wrap">
            <div className="flex items-center gap-2 font-bold text-sm text-slate-900 dark:text-white">
              <Cpu className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span>{t('dashboard.vendorBreakdown')}</span>
              {(isVendorFiltered || isFilterActive) && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-slate-950 uppercase tracking-wide">
                  {language === 'fr' ? 'FILTRAGE ACTIF' : 'FILTERED'}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {/* Reset button specific to Vendor filter */}
              {isVendorFiltered && onResetVendorFilter && (
                <button
                  type="button"
                  onClick={onResetVendorFilter}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 dark:hover:bg-rose-900 border border-rose-200 dark:border-rose-800 transition-colors shadow-xs cursor-pointer"
                  title={language === 'fr' ? 'Réinitialiser le filtre fabricant' : 'Reset manufacturer filter'}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>{language === 'fr' ? 'Réinitialiser' : 'Reset'}</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setIsVendorModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900 border border-indigo-200 dark:border-indigo-800 transition-colors shadow-xs cursor-pointer"
                title={language === 'fr' ? 'Cliquez ici pour voir la liste complète des fabricants détectés' : 'Click here to view the complete list of detected manufacturers.'}
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>{language === 'fr' ? 'Voir la liste complète' : 'View full list'}</span>
              </button>
            </div>
          </div>

          <div className="space-y-2.5">
            {stats.vendorBreakdown.map((v) => {
              const isOther = v.vendor.toLowerCase().includes('other') || v.vendor.toLowerCase().includes('autre');
              return (
                <div
                  key={v.vendor}
                  onClick={() => {
                    if (isOther) return;
                    if (onFilterByVendor) onFilterByVendor(v.vendor);
                  }}
                  className={`group p-1.5 rounded-xl transition-all ${
                    isOther
                      ? 'cursor-default opacity-80 select-none'
                      : 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs mb-1 font-medium gap-2">
                    <span
                      title={isOther ? '' : v.vendor}
                      className={`truncate flex-1 min-w-0 pr-1 ${
                        isOther
                          ? 'text-slate-500 dark:text-slate-400 italic'
                          : 'text-slate-800 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-300 transition-colors'
                      }`}
                    >
                      {language === 'fr' && isOther ? 'Autres fabricants' : v.vendor}
                    </span>
                    <div className="flex items-center gap-2 font-sans shrink-0">
                      <span className="text-slate-500 dark:text-slate-400 font-medium">{v.count.toLocaleString()}</span>
                      <span className="font-bold text-slate-900 dark:text-white min-w-[32px] text-right">{v.percentageFormatted}</span>
                    </div>
                  </div>

                  <div className="w-full bg-slate-100 dark:bg-slate-950 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-cyan-500 transition-all duration-500"
                      style={{ width: v.percentage > 0 ? `${v.percentage}%` : '0%' }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Secondary Analysis Row: Signal Quality, Frequency Bands & Channels */}
      <div className={`grid grid-cols-1 ${isWigleDevice ? 'grid-cols-1' : 'md:grid-cols-3'} gap-5`}>
        {/* Signal RSSI Distribution */}
        <div className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm dark:shadow-xl space-y-3 ${isWigleDevice ? 'col-span-full' : ''}`}>
          <div className="flex items-center gap-2 font-bold text-sm text-slate-900 dark:text-white pb-2 border-b border-slate-200 dark:border-slate-800">
            <Signal className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>{language === 'fr' ? 'Répartition des niveaux de signal (RSSI)' : 'Signal Strength Ranking (RSSI)'}</span>
          </div>

          <div className="space-y-3 pt-1">
            {stats.rssiBreakdown.map((rb) => {
              const labelFr =
                rb.label === 'Excellent' ? 'Excellent' :
                rb.label === 'Strong' ? 'Fort' :
                rb.label === 'Good' ? 'Bon' :
                rb.label === 'Fair' ? 'Moyen' : 'Faible';
              return (
                <div key={rb.range} className="space-y-1">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-700 dark:text-slate-300 font-medium">
                      {language === 'fr' ? labelFr : rb.label} ({rb.range})
                    </span>
                    <span className="font-sans font-bold text-slate-900 dark:text-white">{rb.count} ({rb.percentageFormatted})</span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-950 rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: rb.percentage > 0 ? `${rb.percentage}%` : '0%',
                        backgroundColor: rb.color,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {!isWigleDevice && (
          <>
            {/* Frequency Band Breakdown */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm dark:shadow-xl space-y-3">
              <div className="flex items-center gap-2 font-bold text-sm text-slate-900 dark:text-white pb-2 border-b border-slate-200 dark:border-slate-800">
                <Radio className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                <span>{language === 'fr' ? 'Bandes de fréquences' : 'Frequency Bands'}</span>
              </div>

              <div className="space-y-3 pt-1">
                {stats.bandBreakdown.map((band) => (
                  <div key={band.band} className="space-y-1">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-700 dark:text-slate-300 font-semibold">{band.band}</span>
                      <span className="font-sans font-bold text-slate-900 dark:text-white">{band.count} ({band.percentageFormatted})</span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-950 rounded-full h-2 overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: band.percentage > 0 ? `${band.percentage}%` : '0%',
                          backgroundColor: band.color,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Top Active WiFi Channels (Limited strictly to 10 active channels with font-sans font-bold) */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm dark:shadow-xl space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2 font-bold text-sm text-slate-900 dark:text-white">
                  <BarChart3 className="w-4 h-4 text-amber-500 dark:text-amber-400" />
                  <span>{language === 'fr' ? 'Canaux les plus utilisés' : 'Most Used Channels'}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-2 gap-2 pt-1 max-h-56 overflow-y-auto pr-1 custom-scrollbar">
                {stats.channelBreakdown.map((ch) => (
                  <div
                    key={ch.channel}
                    className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-2 rounded-xl flex items-center justify-between hover:border-amber-400/50 transition-colors"
                  >
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 font-sans tracking-tight">{ch.channel}</span>
                    <span className="text-xs font-sans font-bold text-cyan-600 dark:text-cyan-400">{ch.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Full Vendor Ranking Modal */}
      <VendorRankingModal
        isOpen={isVendorModalOpen}
        onClose={() => setIsVendorModalOpen(false)}
        allVendors={stats.allVendorsBreakdown}
        totalUniqueAPs={stats.totalUniqueAPs}
        onFilterByVendor={onFilterByVendor}
      />
    </div>
  );
};
