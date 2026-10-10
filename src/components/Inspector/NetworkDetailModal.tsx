import React, { useState, useMemo } from 'react';
import { ProcessedAccessPoint } from '../../types/wigle';
import { generateTechnicalAnalysis, classifySecurity } from '../../utils/csvParser';
import { calculateTriangulation } from '../../utils/triangulation';
import { formatToEuropeanDate } from '../../utils/statsUtils';
import {
  X,
  Radio,
  Bluetooth,
  MapPin,
  Lock,
  Unlock,
  Signal,
  Cpu,
  Copy,
  Check,
  ExternalLink,
  History,
  Compass,
  Wifi,
  ShieldCheck,
  Shield,
  Sparkles,
  KeyRound,
  Key,
  Zap,
  Binary,
  Target,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Tag,
  HelpCircle,
  Headphones,
  Smartphone,
  Watch,
  Keyboard,
  Car,
  Heart,
  Bot,
  Tv,
  Laptop,
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

interface NetworkDetailModalProps {
  ap: ProcessedAccessPoint | null;
  onClose: () => void;
  onFocusMap?: (ap: ProcessedAccessPoint) => void;
  isWigleDevice?: boolean;
}

export const NetworkDetailModal: React.FC<NetworkDetailModalProps> = ({ ap, onClose, onFocusMap, isWigleDevice = false }) => {
  const { t, language } = useLanguage();
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const renderCategoryIcon = (iconName: string) => {
    const iconClass = 'w-4 h-4 shrink-0';
    switch (iconName) {
      case 'Headphones':
      case 'Speaker':
      case 'Music':
        return <Headphones className={iconClass} />;
      case 'Smartphone':
      case 'Phone':
        return <Smartphone className={iconClass} />;
      case 'Watch':
        return <Watch className={iconClass} />;
      case 'Keyboard':
        return <Keyboard className={iconClass} />;
      case 'Car':
        return <Car className={iconClass} />;
      case 'Laptop':
      case 'Monitor':
      case 'Server':
        return <Laptop className={iconClass} />;
      case 'Heart':
      case 'Activity':
      case 'Thermometer':
      case 'Scale':
        return <Heart className={iconClass} />;
      case 'Gamepad2':
      case 'Toy':
      case 'Bot':
        return <Bot className={iconClass} />;
      case 'Tv':
      case 'Video':
      case 'Camera':
        return <Tv className={iconClass} />;
      default:
        return <Bluetooth className={iconClass} />;
    }
  };
  const [detailSortField, setDetailSortField] = useState<string>('timestamp');
  const [detailSortOrder, setDetailSortOrder] = useState<'asc' | 'desc'>('desc');

  if (!ap) return null;

  const handleDetailSort = (field: string) => {
    if (detailSortField === field) {
      setDetailSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setDetailSortField(field);
      setDetailSortOrder('asc');
    }
  };

  const renderDetailSortIndicator = (field: string) => {
    if (detailSortField !== field) {
      return <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60 shrink-0" />;
    }
    return detailSortOrder === 'asc' ? (
      <ArrowUp className="w-3 h-3 text-cyan-600 dark:text-cyan-400 shrink-0 font-bold" />
    ) : (
      <ArrowDown className="w-3 h-3 text-cyan-600 dark:text-cyan-400 shrink-0 font-bold" />
    );
  };

  const copyToClipboard = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const getSignalStrengthPercent = (rssi: number) => {
    const normalized = Math.min(100, Math.max(0, ((rssi + 100) / 60) * 100));
    return Math.round(normalized);
  };

  const signalPercent = getSignalStrengthPercent(ap.bestRssi);
  const sec = ap.security;

  const renderDetailSecurityBadge = (secCat: typeof sec, rawAuth: string) => {
    const rawTitle = rawAuth || secCat.label || '[]';
    if (secCat.type === 'OPEN' || !secCat.isSecure) {
      return (
        <span
          title={rawTitle}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-semibold bg-rose-50 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border border-rose-400 dark:border-rose-600 shadow-xs whitespace-nowrap cursor-default"
        >
          <Unlock className="w-3 h-3 stroke-[2] text-rose-600 dark:text-rose-400 shrink-0" />
          <span>OPEN</span>
        </span>
      );
    }
    if (secCat.type === 'WPA3') {
      return (
        <span
          title={rawTitle}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 border border-purple-300 dark:border-purple-700 shadow-xs whitespace-nowrap cursor-default"
        >
          <Lock className="w-3 h-3 stroke-[2.5] text-purple-600 dark:text-purple-400 shrink-0" />
          <span>WPA3</span>
        </span>
      );
    }
    if (secCat.type === 'WPA3_ENTERPRISE') {
      return (
        <span
          title={rawTitle}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-700 shadow-xs whitespace-nowrap cursor-default"
        >
          <Lock className="w-3 h-3 stroke-[2.5] text-indigo-600 dark:text-indigo-400 shrink-0" />
          <span>WPA3 Enterprise</span>
        </span>
      );
    }
    if (secCat.type === 'WPA2_WPA3') {
      return (
        <span
          title={rawTitle}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-fuchsia-100 dark:bg-fuchsia-950 text-fuchsia-800 dark:text-fuchsia-300 border border-fuchsia-300 dark:border-fuchsia-700 shadow-xs whitespace-nowrap cursor-default"
        >
          <Lock className="w-3 h-3 stroke-[2.5] text-fuchsia-600 dark:text-fuchsia-400 shrink-0" />
          <span>WPA2/WPA3</span>
        </span>
      );
    }
    if (secCat.type === 'ENTERPRISE') {
      return (
        <span
          title={rawTitle}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-cyan-100 dark:bg-cyan-950 text-cyan-800 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-700 shadow-xs whitespace-nowrap cursor-default"
        >
          <Lock className="w-3 h-3 stroke-[2.5] text-cyan-600 dark:text-cyan-400 shrink-0" />
          <span>WPA2 Enterprise</span>
        </span>
      );
    }
    if (secCat.type === 'WPA1_ENTERPRISE') {
      return (
        <span
          title={rawTitle}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-sky-100 dark:bg-sky-950 text-sky-800 dark:text-sky-300 border border-sky-300 dark:border-sky-700 shadow-xs whitespace-nowrap cursor-default"
        >
          <Lock className="w-3 h-3 stroke-[2.5] text-sky-600 dark:text-sky-400 shrink-0" />
          <span>WPA1 Enterprise</span>
        </span>
      );
    }
    if (secCat.type === 'WPA_WPA2') {
      return (
        <span
          title={rawTitle}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-sky-100 dark:bg-sky-950 text-sky-800 dark:text-sky-300 border border-sky-300 dark:border-sky-700 shadow-xs whitespace-nowrap cursor-default"
        >
          <Lock className="w-3 h-3 stroke-[2.5] text-sky-600 dark:text-sky-400 shrink-0" />
          <span>WPA1/WPA2</span>
        </span>
      );
    }
    if (secCat.type === 'WEP') {
      return (
        <span
          title={rawTitle}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border border-rose-400 dark:border-rose-600 shadow-xs whitespace-nowrap cursor-default"
        >
          <Lock className="w-3 h-3 stroke-[2.5] text-rose-600 dark:text-rose-400 shrink-0" />
          <span>WEP</span>
        </span>
      );
    }
    if (secCat.type === 'WPA') {
      return (
        <span
          title={rawTitle}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-yellow-100 dark:bg-yellow-950 text-yellow-800 dark:text-yellow-300 border border-yellow-300 dark:border-yellow-700 shadow-xs whitespace-nowrap cursor-default"
        >
          <Lock className="w-3 h-3 stroke-[2.5] text-yellow-600 dark:text-yellow-400 shrink-0" />
          <span>WPA1 (PSK)</span>
        </span>
      );
    }
    return (
      <span
        title={rawTitle}
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 border border-blue-300 dark:border-blue-700 shadow-xs whitespace-nowrap cursor-default"
      >
        <Lock className="w-3 h-3 stroke-[2.5] text-blue-600 dark:text-blue-400 shrink-0" />
        <span>WPA2 (PSK)</span>
      </span>
    );
  };

  // Triangulation calculation (weighted by RSSI if multiple observations exist)
  const triangulation = useMemo(() => {
    return calculateTriangulation(ap);
  }, [ap]);

  const isBtDevice = ap.type === 'BLE' || ap.type === 'BT' || ap.btProtocol !== undefined || ap.btCategory !== undefined;

  // Fully dynamic technical analysis based on raw capabilities
  const dynamicAnalysis = useMemo(() => {
    if (isBtDevice) return { pointsEn: [], pointsFr: [] };
    return generateTechnicalAnalysis(
      ap.authMode,
      sec.type,
      sec.cipherLabel || '',
      sec.keyManagement || [],
      sec.ciphers || []
    );
  }, [ap.authMode, sec, isBtDevice]);

  const renderFormattedText = (text: string) => {
    const normalized = text.replace(/<\/?b>/gi, '**').replace(/<\/?strong>/gi, '**');
    const parts = normalized.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
        return (
          <strong key={i} className="font-bold text-slate-900 dark:text-white">
            {part.slice(2, -2)}
          </strong>
        );
      }
      return part;
    });
  };

  const rawPoints: string[] = language === 'fr' ? dynamicAnalysis.pointsFr : dynamicAnalysis.pointsEn;
  const analysisPoints: string[] = rawPoints.filter((pt) => {
    const lower = pt.toLowerCase();
    if (
      lower.includes('evaluation') ||
      lower.includes('évaluation') ||
      lower.includes('security evaluation')
    ) {
      return false;
    }
    const isApWigleOnly = isWigleDevice || (ap.isWigleOnly && !ap.hasCompleteDetails);
    if (isApWigleOnly) {
      // In WiGLE device mode, only show architecture/topology info
      const isArch =
        lower.includes('infrastructure') ||
        lower.includes('ad-hoc') ||
        lower.includes('ibss') ||
        lower.includes('mesh') ||
        lower.includes('architecture') ||
        lower.includes('mode de fonctionnement') ||
        lower.includes('operating mode') ||
        lower.includes('type de réseau');
      return isArch;
    }
    return true;
  });
  const fullCipherSpec = sec.ciphers && sec.ciphers.length > 0 ? sec.ciphers.join(' + ') : (sec.cipherLabel || 'None');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-4xl lg:max-w-5xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] transition-colors">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl border ${
              isBtDevice
                ? 'bg-indigo-100 dark:bg-indigo-950 border-indigo-300 dark:border-indigo-700/50 text-indigo-600 dark:text-indigo-400'
                : 'bg-cyan-100 dark:bg-cyan-950 border-cyan-300 dark:border-cyan-700/50 text-cyan-600 dark:text-cyan-400'
            }`}>
              {isBtDevice ? <Bluetooth className="w-5 h-5" /> : <Radio className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                {ap.ssid ? (
                  ap.ssid
                ) : isBtDevice ? (
                  <span className="text-slate-400 italic">
                    &lt;{language === 'fr' ? 'Nom masqué' : 'Hidden Name'}&gt;
                  </span>
                ) : (
                  <span className="text-slate-400 italic">
                    &lt;{language === 'fr' ? 'SSID Masqué' : 'Hidden SSID'}&gt;
                  </span>
                )}
              </h2>
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-sans font-medium mt-0.5">
                <span>
                  {isBtDevice
                    ? (language === 'fr' ? 'MAC\u00A0: ' : 'MAC: ')
                    : (language === 'fr' ? 'BSSID\u00A0: ' : 'BSSID: ')}
                  {ap.mac}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 overflow-y-auto custom-scrollbar">
          {/* Main Specs Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Vendor / Manufacturer Card */}
            <div className="bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 p-4 rounded-xl space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-semibold">
                <span className="flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
                  {t('modal.hardwareVendor')}
                </span>
                <button
                  onClick={() => copyToClipboard(ap.btCompany || ap.vendor, 'vendor')}
                  className="text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors"
                  title={language === 'fr' ? 'Copier le nom du fabricant' : 'Copy manufacturer name'}
                >
                  {copiedField === 'vendor' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
              <div className="text-base font-bold text-slate-900 dark:text-white">
                {ap.btCompany || ap.vendor}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 font-sans flex items-center gap-2 flex-wrap">
                <span>
                  {language === 'fr' ? 'Préfixe OUI\u00A0:' : 'OUI Prefix:'}{' '}
                  <span className="text-indigo-600 dark:text-indigo-300 font-bold">{ap.oui}</span>
                </span>
              </div>
            </div>

            {/* Bluetooth Category Card OR WiFi Security Card */}
            {isBtDevice ? (
              <div className="bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 p-4 rounded-xl space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-semibold">
                  <span className="flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    {language === 'fr' ? 'Catégorie' : 'Category'}
                  </span>
                </div>
                <div className="text-sm font-semibold text-slate-900 dark:text-white flex items-center">
                  <span className="flex items-center gap-2">
                    <span className="p-1 rounded-md bg-indigo-100 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400">
                      {renderCategoryIcon(ap.btIconName || '')}
                    </span>
                    <span>
                      {(language === 'fr' ? ap.btCategoryFr : ap.btCategoryEn) ||
                        ap.btCategory ||
                        (language === 'fr' ? 'Non catégorisé' : 'Uncategorized')}
                    </span>
                  </span>
                </div>
              </div>
            ) : (
              <div className="bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 p-4 rounded-xl space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-semibold">
                  <span className="flex items-center gap-1.5">
                    {sec.isSecure ? (
                      <Lock className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                    ) : (
                      <Unlock className="w-3.5 h-3.5 text-rose-500" />
                    )}
                    {t('modal.securityEncryption')}
                  </span>
                </div>
                <div className="text-sm font-semibold text-slate-900 dark:text-white flex items-center justify-between">
                  <span>{sec.label}</span>
                  {!isWigleDevice && (!ap.isWigleOnly || ap.hasCompleteDetails) && sec.type !== 'OPEN' && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-cyan-100 dark:bg-cyan-950 text-cyan-800 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-800">
                      {fullCipherSpec}
                    </span>
                  )}
                </div>
                {sec.keyManagement && sec.keyManagement.length > 0 && sec.type !== 'OPEN' && (
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 font-sans">
                    {t('modal.keyMgmt')}{language === 'fr' ? '\u00A0: ' : ': '}<span className="font-semibold text-slate-800 dark:text-slate-200">{sec.keyManagement.join(' + ')}</span>
                  </div>
                )}
                <div className="flex items-start justify-between gap-2 p-2 rounded-lg bg-white/70 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 text-[11px] font-sans">
                  <div className="min-w-0 flex-1">
                    <span className="text-slate-400 font-semibold mr-1.5">{language === 'fr' ? 'Brut\u00A0:' : 'Raw:'}</span>
                    <span className="text-slate-800 dark:text-slate-200 font-sans text-xs break-all select-all font-semibold">
                      {ap.authMode || '[]'}
                    </span>
                  </div>
                  <button
                    onClick={() => copyToClipboard(ap.authMode, 'authMode')}
                    className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
                    title={language === 'fr' ? 'Copier les capacités brutes (capabilities)' : 'Copy raw capability string'}
                  >
                    {copiedField === 'authMode' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Technical Analysis Callout (WiFi Only) */}
          {!isBtDevice && (
            <div className="bg-gradient-to-r from-cyan-500/10 via-indigo-500/10 to-blue-500/10 dark:from-cyan-950/40 dark:via-indigo-950/30 dark:to-blue-950/40 border border-cyan-300/70 dark:border-cyan-700/60 p-4 rounded-xl space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-cyan-800 dark:text-cyan-300">
                <span className="flex items-center gap-1.5">
                  <Binary className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                  {t('modal.technicalAnalysis')}
                </span>
              </div>

              {/* Individual Spaced Bullet Point Cards */}
              <div className="space-y-2">
                {analysisPoints.length > 0 ? (
                  analysisPoints.map((pt, idx) => {
                    const cleanText = pt.startsWith('• ') ? pt.substring(2) : pt;
                    const isEval = cleanText.toLowerCase().includes('evaluation') || cleanText.toLowerCase().includes('évaluation') || cleanText.toLowerCase().includes('assessment');
                    const isPmf = cleanText.toLowerCase().includes('frame protection') || cleanText.toLowerCase().includes('protection des trames');
                    const isKey = cleanText.toLowerCase().includes('key management') || cleanText.toLowerCase().includes('gestion des clés');
                    const isCipher = cleanText.toLowerCase().includes('symmetric cipher') || cleanText.toLowerCase().includes('chiffrement symétrique') || cleanText.toLowerCase().includes('encryption');
                    const isRoam = cleanText.toLowerCase().includes('roaming') || cleanText.toLowerCase().includes('mobilité') || cleanText.toLowerCase().includes('itinérance') || cleanText.toLowerCase().includes('initial link');
                    const isWps = cleanText.toLowerCase().includes('wps') || cleanText.toLowerCase().includes('wi-fi protected setup');
                    const isProv = cleanText.toLowerCase().includes('provisioning') || cleanText.toLowerCase().includes('provisionnement') || cleanText.toLowerCase().includes('dpp') || cleanText.toLowerCase().includes('osen') || cleanText.toLowerCase().includes('délestage') || cleanText.toLowerCase().includes('offload') || cleanText.toLowerCase().includes('infrastructure');

                    return (
                      <div
                        key={idx}
                        className="flex items-start gap-2.5 p-2.5 rounded-xl bg-white/90 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800/80 shadow-2xs hover:border-cyan-400/50 transition-all"
                      >
                        <span className="mt-0.5 p-1 rounded-md bg-cyan-50 dark:bg-cyan-950/80 text-cyan-600 dark:text-cyan-400 shrink-0">
                          {isEval ? (
                            <ShieldCheck className="w-3.5 h-3.5" />
                          ) : isPmf ? (
                            <Shield className="w-3.5 h-3.5" />
                          ) : isKey ? (
                            <Key className="w-3.5 h-3.5" />
                          ) : isCipher ? (
                            <KeyRound className="w-3.5 h-3.5" />
                          ) : isRoam ? (
                            <Zap className="w-3.5 h-3.5" />
                          ) : isProv ? (
                            <Sparkles className="w-3.5 h-3.5 text-teal-500" />
                          ) : isWps ? (
                            <Radio className="w-3.5 h-3.5 text-amber-500" />
                          ) : (
                            <Sparkles className="w-3.5 h-3.5" />
                          )}
                        </span>
                        <div className="text-xs leading-relaxed text-slate-800 dark:text-slate-200 font-sans whitespace-pre-line">
                          {renderFormattedText(cleanText)}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed font-sans whitespace-pre-line">
                    {renderFormattedText(language === 'fr' ? (sec.technicalAnalysisFr || sec.technicalAnalysis || 'Aucune analyse approfondie disponible.') : (sec.technicalAnalysis || 'No in-depth analysis available.'))}
                  </p>
                )}
              </div>

              {/* Technical Feature Chips */}
              <div className="flex items-center gap-1.5 flex-wrap pt-2 border-t border-cyan-200/60 dark:border-cyan-900/60 text-[10px]">
                {!isWigleDevice && (!ap.isWigleOnly || ap.hasCompleteDetails) && sec.type !== 'OPEN' && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-800 font-semibold shadow-2xs">
                    <KeyRound className="w-3 h-3 text-cyan-600 dark:text-cyan-400" />
                    {language === 'fr' ? 'Chiffrement\u00A0: ' : 'Cipher: '}{fullCipherSpec}
                  </span>
                )}

                {!isWigleDevice && (!ap.isWigleOnly || ap.hasCompleteDetails) && (sec.pmfStatus === 'REQUIRED' ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 font-bold shadow-2xs">
                    <ShieldCheck className="w-3 h-3" />
                    {t('modal.pmfRequired')}
                  </span>
                ) : sec.pmfStatus === 'CAPABLE' ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 border border-blue-300 dark:border-blue-700 font-semibold shadow-2xs">
                    <ShieldCheck className="w-3 h-3" />
                    {t('modal.pmfCapable')}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 shadow-2xs">
                    <Shield className="w-3 h-3 text-slate-400" />
                    {language === 'fr' ? 'PMF 802.11w\u00A0: Absent' : 'PMF 802.11w: None'}
                  </span>
                ))}

                {sec.fastRoaming && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 border border-purple-300 dark:border-purple-700 font-semibold shadow-2xs">
                    <Zap className="w-3 h-3" />
                    {t('modal.fastRoaming')}
                  </span>
                )}

                {sec.protocols?.includes('DPP') && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-300 border border-teal-300 dark:border-teal-700 font-semibold shadow-2xs">
                    <Sparkles className="w-3 h-3 text-teal-600 dark:text-teal-400" />
                    DPP (Easy Connect)
                  </span>
                )}

                {sec.protocols?.includes('OSEN') && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-700 font-semibold shadow-2xs">
                    <Radio className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                    OSEN (Passpoint)
                  </span>
                )}

                {(ap.hasWps || (ap.authMode || '').toUpperCase().includes('WPS')) && (!ap.isWigleOnly || ap.hasCompleteDetails) ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700 font-semibold shadow-2xs">
                    <Radio className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                    {t('modal.wpsActive')}
                  </span>
                ) : null}
              </div>
            </div>
          )}

          {/* Radio Parameters Card (Frequency & Channel - WiFi Only) */}
          {!isWigleDevice && !isBtDevice && (
            <div className="bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 p-4 rounded-xl space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                <Wifi className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                <span>{language === 'fr' ? 'Canal & Bande WiFi' : 'WiFi Channel & Band Details'}</span>
              </div>
              {ap.isWigleOnly || !ap.channel || ap.channel === '0' || ap.channel === '' ? (
                <div className="p-3 text-xs text-slate-400 italic font-sans text-center">
                  {language === 'fr'
                    ? 'Données non disponibles sur ce fichier.'
                    : 'Data not available on this file.'}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                  <div className="bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800">
                    <div className="text-slate-500 dark:text-slate-400 text-[10px]">{language === 'fr' ? 'Canal' : 'Channel'}</div>
                    <div className="font-sans font-bold text-slate-900 dark:text-white text-sm">Ch {ap.channel}</div>
                  </div>
                  <div className="bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800">
                    <div className="text-slate-500 dark:text-slate-400 text-[10px]">{language === 'fr' ? 'Fréquence' : 'Frequency'}</div>
                    <div className="font-sans font-bold text-slate-900 dark:text-white text-sm">
                      {ap.frequency ? `${ap.frequency}${language === 'fr' ? '\u00A0MHz' : ' MHz'}` : 'N/A'}
                    </div>
                  </div>
                  <div className="bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800">
                    <div className="text-slate-500 dark:text-slate-400 text-[10px]">{language === 'fr' ? 'Bande' : 'Band'}</div>
                    <div className="font-sans font-bold text-slate-900 dark:text-white text-sm">{ap.band}</div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Signal RSSI Gauge */}
          <div className="bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 p-4 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Signal className="w-4 h-4 text-emerald-500" />
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {language === 'fr' ? 'Force de signal (RSSI)' : 'Signal Strength (RSSI)'}
                </span>
              </div>
              <div className="text-base font-sans font-bold text-emerald-600 dark:text-emerald-400">
                {ap.bestRssi}{language === 'fr' ? '\u00A0dBm' : ' dBm'}{' '}
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  (
                  {ap.bestRssi >= -50
                    ? (language === 'fr' ? 'Excellent' : 'Excellent')
                    : ap.bestRssi >= -60
                    ? (language === 'fr' ? 'Fort' : 'Strong')
                    : ap.bestRssi >= -72
                    ? (language === 'fr' ? 'Bon' : 'Good')
                    : ap.bestRssi >= -82
                    ? (language === 'fr' ? 'Moyen' : 'Fair')
                    : (language === 'fr' ? 'Faible' : 'Weak')}
                  )
                </span>
              </div>
            </div>

            <div className="w-full bg-slate-200 dark:bg-slate-900 h-3 rounded-full overflow-hidden p-0.5 border border-slate-300 dark:border-slate-800">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  ap.bestRssi >= -50
                    ? 'bg-gradient-to-r from-emerald-500 to-green-400'
                    : ap.bestRssi >= -60
                    ? 'bg-gradient-to-r from-cyan-500 to-emerald-400'
                    : ap.bestRssi >= -72
                    ? 'bg-gradient-to-r from-blue-500 to-cyan-400'
                    : ap.bestRssi >= -82
                    ? 'bg-gradient-to-r from-amber-500 to-yellow-400'
                    : 'bg-gradient-to-r from-rose-500 to-red-500'
                }`}
                style={{ width: `${signalPercent}%` }}
              />
            </div>
          </div>

          {/* GPS Coordinates & Triangulation Card */}
          {(() => {
            const displayLat = triangulation.hasMultiplePoints ? triangulation.estimatedLat : ap.latitude;
            const displayLng = triangulation.hasMultiplePoints ? triangulation.estimatedLng : ap.longitude;

            return (
              <div className="bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 p-4 rounded-xl space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    {triangulation.hasMultiplePoints ? (
                      <Target className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                    ) : (
                      <MapPin className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                    )}
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      {triangulation.hasMultiplePoints
                        ? t('modal.geoPositionTriangulated')
                        : t('modal.geoPositionSingle')}
                    </span>
                  </div>

                  {displayLat !== 0 && (
                    <div className="flex items-center gap-2">
                      <a
                        href={`https://www.openstreetmap.org/?mlat=${displayLat}&mlon=${displayLng}#map=17/${displayLat}/${displayLng}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
                      >
                        <span>OpenStreetMap</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                      <a
                        href={`https://www.google.com/maps?q=${displayLat},${displayLng}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 text-xs text-cyan-600 dark:text-cyan-400 hover:underline"
                      >
                        <span>Google Maps</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-800">
                    <div className="text-slate-500 dark:text-slate-400 text-[10px]">
                      {triangulation.hasMultiplePoints
                        ? (language === 'fr' ? 'Latitude estimée' : 'Estimated Latitude')
                        : (language === 'fr' ? 'Latitude' : 'Latitude')}
                    </div>
                    <div className="font-sans font-bold text-slate-900 dark:text-white">
                      {displayLat !== 0 ? displayLat.toFixed(6) : 'N/A'}
                    </div>
                  </div>
                  <div className="bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-800">
                    <div className="text-slate-500 dark:text-slate-400 text-[10px]">
                      {triangulation.hasMultiplePoints
                        ? (language === 'fr' ? 'Longitude estimée' : 'Estimated Longitude')
                        : (language === 'fr' ? 'Longitude' : 'Longitude')}
                    </div>
                    <div className="font-sans font-bold text-slate-900 dark:text-white">
                      {displayLng !== 0 ? displayLng.toFixed(6) : 'N/A'}
                    </div>
                  </div>
                  <div className="bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-800">
                    <div className="text-slate-500 dark:text-slate-400 text-[10px]">
                      {language === 'fr' ? 'Altitude' : 'Altitude'}
                    </div>
                    <div className="font-sans font-bold text-slate-900 dark:text-white">
                      {ap.altitudeMeters !== undefined ? `${ap.altitudeMeters}${language === 'fr' ? '\u00A0m' : ' m'}` : 'N/A'}
                    </div>
                  </div>
                  <div className="bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-800">
                    <div className="text-slate-500 dark:text-slate-400 text-[10px]">
                      {triangulation.hasMultiplePoints
                        ? (language === 'fr' ? 'Rayon d\'incertitude' : 'Accuracy Radius')
                        : (language === 'fr' ? 'Précision GPS' : 'GPS Accuracy')}
                    </div>
                    <div className="font-sans font-bold text-slate-900 dark:text-white">
                      {triangulation.hasMultiplePoints
                        ? `±\u00A0${triangulation.accuracyRadiusMeters.toFixed(1)}${language === 'fr' ? '\u00A0m' : ' m'}`
                        : ap.accuracyMeters !== undefined
                        ? `±\u00A0${ap.accuracyMeters.toFixed(1)}${language === 'fr' ? '\u00A0m' : ' m'}`
                        : 'N/A'}
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Observations History Table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
              <span className="flex items-center gap-1.5">
                <History className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                {language === 'fr'
                  ? `Historique des détections (${ap.observationCount} ${ap.observationCount > 1 ? 'scans' : 'scan'})`
                  : `Detection History (${ap.observationCount} ${ap.observationCount > 1 ? 'scans' : 'scan'})`}
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-sans">
                {language === 'fr' ? '1ère détection\u00A0:' : 'First seen:'} {formatToEuropeanDate(ap.firstSeen)}
              </span>
            </div>

            <div className={`max-h-[420px] overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 custom-scrollbar ${ap.observations.length >= 5 ? 'min-h-[220px]' : ''}`}>
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10 select-none">
                  <tr>
                    <th
                      onClick={() => handleDetailSort('index')}
                      className="px-3 py-2 cursor-pointer hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors"
                    >
                      <div className="flex items-center gap-1">
                        <span>#</span>
                        {renderDetailSortIndicator('index')}
                      </div>
                    </th>
                    <th
                      onClick={() => handleDetailSort('timestamp')}
                      className="px-3 py-2 cursor-pointer hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors"
                    >
                      <div className="flex items-center gap-1">
                        <span>{language === 'fr' ? 'Horodatage' : 'Timestamp'}</span>
                        {renderDetailSortIndicator('timestamp')}
                      </div>
                    </th>
                    <th
                      onClick={() => handleDetailSort('rssi')}
                      className="px-3 py-2 cursor-pointer hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors"
                    >
                      <div className="flex items-center gap-1">
                        <span>Signal (RSSI)</span>
                        {renderDetailSortIndicator('rssi')}
                      </div>
                    </th>
                    <th
                      onClick={() => handleDetailSort('ssid')}
                      className="px-3 py-2 cursor-pointer hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors"
                    >
                      <div className="flex items-center gap-1">
                        <span>
                          {isBtDevice
                            ? (language === 'fr' ? 'Nom & Profil' : 'Name & Profile')
                            : (language === 'fr' ? 'SSID & Chiffrement' : 'SSID & Security')}
                        </span>
                        {renderDetailSortIndicator('ssid')}
                      </div>
                    </th>
                    {!isBtDevice && (
                      <th
                        onClick={() => handleDetailSort('channel')}
                        className="px-3 py-2 cursor-pointer hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors"
                      >
                        <div className="flex items-center gap-1">
                          <span>
                            {language === 'fr' ? 'Canal / Fréquence' : 'Channel / Frequency'}
                          </span>
                          {renderDetailSortIndicator('channel')}
                        </div>
                      </th>
                    )}
                    <th
                      onClick={() => handleDetailSort('gps')}
                      className="px-3 py-2 cursor-pointer hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors"
                    >
                      <div className="flex items-center gap-1">
                        <span>{language === 'fr' ? 'Coordonnées GPS' : 'GPS Coordinates'}</span>
                        {renderDetailSortIndicator('gps')}
                      </div>
                    </th>
                    <th
                      onClick={() => handleDetailSort('source')}
                      className="px-3 py-2 cursor-pointer hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors"
                    >
                      <div className="flex items-center gap-1">
                        <span>Source</span>
                        {renderDetailSortIndicator('source')}
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60">
                  {(() => {
                    const indexed = ap.observations.map((obs, origIdx) => ({ obs, origIdx }));
                    const sorted = [...indexed].sort((a, b) => {
                      let valA: any;
                      let valB: any;
                      switch (detailSortField) {
                        case 'index':
                          valA = a.origIdx;
                          valB = b.origIdx;
                          break;
                        case 'timestamp':
                          valA = a.obs.timestamp || ap.firstSeen || '';
                          valB = b.obs.timestamp || ap.firstSeen || '';
                          break;
                        case 'rssi':
                          valA = a.obs.rssi;
                          valB = b.obs.rssi;
                          break;
                        case 'ssid':
                          valA = (a.obs.ssid || ap.ssid || '').toLowerCase();
                          valB = (b.obs.ssid || ap.ssid || '').toLowerCase();
                          break;
                        case 'channel':
                          valA = a.obs.channel || ap.channel || 0;
                          valB = b.obs.channel || ap.channel || 0;
                          break;
                        case 'gps':
                          valA = a.obs.latitude || 0;
                          valB = b.obs.latitude || 0;
                          break;
                        case 'source':
                          valA = (a.obs.sourceFile || '').toLowerCase();
                          valB = (b.obs.sourceFile || '').toLowerCase();
                          break;
                        default:
                          valA = a.origIdx;
                          valB = b.origIdx;
                      }
                      if (valA < valB) return detailSortOrder === 'asc' ? -1 : 1;
                      if (valA > valB) return detailSortOrder === 'asc' ? 1 : -1;
                      return 0;
                    });

                    return sorted.map(({ obs, origIdx }) => {
                      const obsSsid = obs.ssid !== undefined && obs.ssid !== null ? obs.ssid : ap.ssid;
                      const obsAuth = obs.authMode !== undefined && obs.authMode !== null ? obs.authMode : ap.authMode;
                      const obsSec = classifySecurity(obsAuth);

                      return (
                        <tr key={origIdx} className="hover:bg-white dark:hover:bg-slate-800/40 font-medium">
                          <td className="px-3 py-2 text-slate-400 font-sans font-semibold">#{origIdx + 1}</td>
                          <td className="px-3 py-2 font-sans text-slate-700 dark:text-slate-300 whitespace-nowrap">{formatToEuropeanDate(obs.timestamp || ap.firstSeen)}</td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            <span
                              className={
                                obs.rssi >= -50
                                  ? 'text-emerald-700 dark:text-emerald-400 font-bold'
                                  : obs.rssi >= -60
                                  ? 'text-green-600 dark:text-green-400 font-bold'
                                  : obs.rssi >= -70
                                  ? 'text-lime-600 dark:text-lime-400 font-bold'
                                  : obs.rssi >= -80
                                  ? 'text-amber-600 dark:text-amber-400 font-bold'
                                  : 'text-rose-600 dark:text-rose-400 font-bold'
                              }
                            >
                              {obs.rssi}{language === 'fr' ? '\u00A0dBm' : ' dBm'}
                            </span>
                          </td>
                          {/* SSID / Name per detection */}
                          <td className="px-3 py-2 min-w-[130px]">
                            <div
                              className="font-semibold text-slate-900 dark:text-slate-100 truncate max-w-[160px]"
                              title={obsSsid || (isBtDevice ? (language === 'fr' ? '<Nom masqué>' : '<Hidden Name>') : (language === 'fr' ? '<SSID Masqué>' : '<Hidden SSID>'))}
                            >
                              {obsSsid ? (
                                obsSsid
                              ) : isBtDevice ? (
                                <i className="text-slate-400 font-normal">
                                  &lt;{language === 'fr' ? 'Nom masqué' : 'Hidden Name'}&gt;
                                </i>
                              ) : (
                                <i className="text-slate-400 font-normal">
                                  &lt;{language === 'fr' ? 'SSID Masqué' : 'Hidden SSID'}&gt;
                                </i>
                              )}
                            </div>
                            {isBtDevice ? (
                              <div className="flex items-center gap-1 mt-1 flex-wrap">
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                  {renderCategoryIcon(ap.btIconName || '')}
                                  <span>
                                    {(language === 'fr' ? ap.btCategoryFr : ap.btCategoryEn) ||
                                      ap.btCategory ||
                                      (language === 'fr' ? 'Non catégorisé' : 'Uncategorized')}
                                  </span>
                                </span>
                              </div>
                            ) : (
                              <div className="flex flex-col gap-0.5 items-start mt-1 cursor-default" title={obsAuth || '[]'}>
                                <div className="flex items-center gap-1 flex-wrap">
                                  {renderDetailSecurityBadge(obsSec, obsAuth)}
                                  {obsAuth && obsAuth.toUpperCase().includes('WPS') && (
                                    <span
                                      className="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700/60 shadow-2xs"
                                      title={`WPS (Wi-Fi Protected Setup) • ${obsAuth}`}
                                    >
                                      WPS
                                    </span>
                                  )}
                                </div>
                                {(() => {
                                  const rawMode = (obsAuth || '').toUpperCase();
                                  const isOweTrans =
                                    rawMode.includes('OWE-TRANS') ||
                                    rawMode.includes('OWE_TRANS') ||
                                    rawMode.includes('OWE-TRANSITION') ||
                                    rawMode.includes('OWE_TRANSITION') ||
                                    (rawMode.includes('OWE') && (rawMode.includes('TRANSITION') || rawMode.includes('TRANS'))) ||
                                    obsSec.label.includes('OWE Transition');
                                  const isOwe = rawMode.includes('OWE') || obsSec.label.includes('OWE');

                                  if (isOweTrans) {
                                    return (
                                      <span
                                        className="text-[9.5px] font-semibold text-purple-800 dark:text-purple-200 bg-purple-100/80 dark:bg-purple-950/90 px-1.5 py-0.5 rounded-md border border-purple-300 dark:border-purple-700 shadow-2xs whitespace-nowrap inline-block"
                                        title={obsAuth || '[]'}
                                      >
                                        OWE Transition (WPA3 Enhanced Open)
                                      </span>
                                    );
                                  }

                                  if (isOwe) {
                                    return (
                                      <span
                                        className="text-[9.5px] font-semibold text-purple-800 dark:text-purple-200 bg-purple-100/80 dark:bg-purple-950/90 px-1.5 py-0.5 rounded-md border border-purple-300 dark:border-purple-700 shadow-2xs whitespace-nowrap inline-block"
                                        title={obsAuth || '[]'}
                                      >
                                        OWE (WPA3 Enhanced Open)
                                      </span>
                                    );
                                  }

                                  if (obsSec.type === 'OPEN') {
                                    return null;
                                  }

                                  if (!isWigleDevice && !obs.isFromWigleFile && obsSec.cipherLabel) {
                                    return (
                                      <span
                                        className="text-[9px] font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800/80 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700/60 whitespace-nowrap inline-block shadow-2xs"
                                        title={obsAuth || '[]'}
                                      >
                                        {obsSec.cipherLabel}
                                      </span>
                                    );
                                  }

                                  return null;
                                })()}
                              </div>
                            )}
                          </td>
                          {!isBtDevice && (
                            <td className="px-3 py-2 font-sans text-slate-700 dark:text-slate-300 whitespace-nowrap">
                              {isWigleDevice || obs.isFromWigleFile || (!obs.channel && (!ap.channel || ap.isWigleOnly)) ? (
                                <span className="text-slate-400 font-normal">—</span>
                              ) : (
                                `${language === 'fr' ? 'Canal' : 'Ch'} ${obs.channel || ap.channel} ${obs.frequency ? `(${obs.frequency}${language === 'fr' ? '\u00A0MHz' : ' MHz'})` : ''}`
                              )}
                            </td>
                          )}
                          <td className="px-3 py-2 font-sans text-slate-700 dark:text-slate-300 text-[11px] whitespace-nowrap">
                            {obs.latitude !== 0 ? `${obs.latitude.toFixed(5)}, ${obs.longitude.toFixed(5)}` : 'N/A'}
                          </td>
                          <td
                            className="px-3 py-2 text-slate-500 dark:text-slate-400 text-[10px] truncate max-w-[120px]"
                            title={obs.sourceFile || 'scan.csv'}
                          >
                            {obs.sourceFile || 'scan.csv'}
                          </td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/80">
          <button
            onClick={() => copyToClipboard(`${ap.mac} - ${ap.ssid} - ${ap.vendor} - ${ap.bestRssi}dBm - ${sec.label} (${sec.cipherLabel || ''})`, 'all')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            {copiedField === 'all' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{t('modal.copySummary')}</span>
          </button>

          <div className="flex items-center gap-2">
            {onFocusMap && ap.latitude !== 0 && (
              <button
                onClick={() => {
                  onFocusMap(ap);
                  onClose();
                }}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 text-white text-xs font-semibold shadow hover:from-cyan-500 hover:to-blue-500 transition-all cursor-pointer"
              >
                <Compass className="w-3.5 h-3.5" />
                <span>{t('modal.centerMap')}</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-white text-xs font-medium transition-colors cursor-pointer"
            >
              {t('modal.close')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
