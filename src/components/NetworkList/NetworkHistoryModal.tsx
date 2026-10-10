import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ProcessedAccessPoint } from '../../types/wigle';
import { analyzeNetworkHistory } from '../../utils/historyUtils';
import { formatToEuropeanDate } from '../../utils/statsUtils';
import { useLanguage } from '../../context/LanguageContext';
import { History, X, Radio, Bluetooth, Lock, ArrowDown, Calendar, Layers, AlertCircle } from 'lucide-react';

interface NetworkHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  ap: ProcessedAccessPoint | null;
  initialType?: 'SSID' | 'SECURITY';
  isWigleDevice?: boolean;
}

export const NetworkHistoryModal: React.FC<NetworkHistoryModalProps> = ({
  isOpen,
  onClose,
  ap,
  initialType = 'SSID',
  isWigleDevice = false,
}) => {
  const { language } = useLanguage();
  const [activeTab, setActiveTab] = useState<'SSID' | 'SECURITY'>(initialType);

  useEffect(() => {
    setActiveTab(initialType);
  }, [initialType, isOpen]);

  if (!isOpen || !ap) return null;

  const history = analyzeNetworkHistory(ap);

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-scaleUp">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/90">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 rounded-xl bg-amber-100 dark:bg-amber-950/80 border border-amber-300 dark:border-amber-700/60 text-amber-600 dark:text-amber-400 shrink-0">
              <History className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-base text-slate-900 dark:text-white truncate">
                {language === 'fr'
                  ? 'Historique d\'évolution du réseau'
                  : 'Network Evolution History'}
              </h3>
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-sans mt-0.5">
                <span className="font-bold text-slate-700 dark:text-slate-300">{ap.mac}</span>
                <span>•</span>
                <span className="truncate">{ap.vendor}</span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title={language === 'fr' ? 'Fermer' : 'Close'}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switcher if both or either has changed */}
        <div className="px-4 pt-3 pb-1 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2 bg-white dark:bg-slate-900">
          <button
            onClick={() => setActiveTab('SSID')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'SSID'
                ? 'bg-amber-500 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            <span>{language === 'fr' ? 'Évolution du SSID' : 'SSID Changes'}</span>
            {history.hasSsidChanged && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-white/25 text-white font-extrabold">
                {history.ssidTimeline.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('SECURITY')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'SECURITY'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>{language === 'fr' ? 'Évolution du Chiffrement' : 'Security/Encryption Changes'}</span>
            {history.hasSecurityChanged && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-white/25 text-white font-extrabold">
                {history.securityTimeline.length}
              </span>
            )}
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 custom-scrollbar flex-1">
          {activeTab === 'SSID' ? (
            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                <div>
                  <p className="font-semibold">
                    {history.hasSsidChanged
                      ? language === 'fr'
                        ? `Ce point d'accès a changé de SSID (${history.ssidTimeline.length} noms constatés).`
                        : `This Access Point has changed its SSID (${history.ssidTimeline.length} distinct SSIDs recorded).`
                      : language === 'fr'
                      ? 'Aucun changement de SSID constaté pour ce point d’accès.'
                      : 'No SSID changes observed for this Access Point.'}
                  </p>
                  <p className="text-[11px] opacity-80 mt-0.5">
                    {language === 'fr'
                      ? 'Le SSID n\'a pas évolué au cours du temps. Seul le type de chiffrement a été modifié.'
                      : 'The SSID has not changed over time. However, a change in encryption was observed.'}
                  </p>
                </div>
              </div>

              {/* Timeline steps */}
              <div className="space-y-3 relative before:absolute before:left-5 before:top-4 before:bottom-4 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
                {history.ssidTimeline.map((item, idx) => {
                  const isFirst = idx === 0;
                  const isLast = idx === history.ssidTimeline.length - 1;

                  return (
                    <div key={`ssid-step-${idx}`} className="relative pl-10">
                      {/* Step Indicator Dot */}
                      <div className="absolute left-3 -translate-x-1/2 top-3 w-5 h-5 rounded-full bg-white dark:bg-slate-900 border-2 border-amber-500 flex items-center justify-center text-[10px] font-bold text-amber-600 dark:text-amber-400 shadow-xs">
                        {idx + 1}
                      </div>

                      <div className="bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 space-y-1.5 shadow-2xs">
                        <div className="flex items-center justify-between text-xs flex-wrap gap-1">
                          <span className="font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider text-[10px]">
                            {language === 'fr'
                              ? isFirst
                                ? '1ère constatation'
                                : `${idx + 1}ème constatation`
                              : isFirst
                              ? '1st Observation'
                              : `${idx + 1}${idx + 1 === 2 ? 'nd' : idx + 1 === 3 ? 'rd' : 'th'} Observation`}
                          </span>
                          <span className="text-[11px] font-sans font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-slate-400" />
                            {item.firstSeen ? formatToEuropeanDate(item.firstSeen) : (language === 'fr' ? 'Date inconnue' : 'Unknown date')}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 pt-0.5">
                          {isWigleDevice || (ap && (ap.isBluetooth || ap.type === 'BLE' || ap.type === 'BT')) ? (
                            <Bluetooth className="w-4 h-4 text-cyan-600 dark:text-cyan-400 shrink-0" />
                          ) : (
                            <Radio className="w-4 h-4 text-cyan-600 dark:text-cyan-400 shrink-0" />
                          )}
                          <span className="font-bold text-sm text-slate-900 dark:text-white font-sans">
                            {item.ssid ? (
                              item.ssid
                            ) : (
                              <i className="text-slate-400 font-normal">
                                &lt;{(isWigleDevice || (ap && (ap.isBluetooth || ap.type === 'BLE' || ap.type === 'BT')))
                                  ? (language === 'fr' ? 'Nom masqué' : 'Hidden Name')
                                  : (language === 'fr' ? 'SSID Masqué' : 'Hidden SSID')}&gt;
                              </i>
                            )}
                          </span>
                        </div>

                        <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 dark:border-slate-800/80 text-[11px] text-slate-500 dark:text-slate-400 font-sans">
                          <span className="flex items-center gap-1">
                            <Layers className="w-3 h-3 text-slate-400" />
                            {item.count} {language === 'fr' ? (item.count > 1 ? 'détections sous ce nom' : 'détection sous ce nom') : (item.count > 1 ? 'detections with this name' : 'detection with this name')}
                          </span>
                          {item.lastSeen && item.lastSeen !== item.firstSeen && (
                            <span className="text-[10px]">
                              {language === 'fr' ? 'Dernière détection\u00A0:' : 'Last seen:'} {formatToEuropeanDate(item.lastSeen)}
                            </span>
                          )}
                        </div>
                      </div>

                      {!isLast && (
                        <div className="flex items-center justify-center my-1 text-amber-500 dark:text-amber-400">
                          <ArrowDown className="w-4 h-4 animate-bounce" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/60 text-xs text-purple-900 dark:text-purple-200 flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 text-purple-600 dark:text-purple-400 mt-0.5" />
                <div>
                  <p className="font-semibold">
                    {history.hasSecurityChanged
                      ? language === 'fr'
                        ? `Le chiffrement de ce point d'accès a été modifié (${history.securityTimeline.length} types de chiffrement constatés).`
                        : `The encryption of this Access Point has been modified (${history.securityTimeline.length} encryption types observed).`
                      : language === 'fr'
                      ? 'Aucun changement de chiffrement constaté pour ce point d’accès.'
                      : 'No encryption change detected for this Access Point.'}
                  </p>
                  <p className="text-[11px] opacity-80 mt-0.5">
                    {language === 'fr'
                      ? 'Une modification du chiffrement a été détectée au cours des différents scans.'
                      : 'A security change was observed across the different scans.'}
                  </p>
                </div>
              </div>

              {/* Timeline steps */}
              <div className="space-y-3 relative before:absolute before:left-5 before:top-4 before:bottom-4 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
                {history.securityTimeline.map((item, idx) => {
                  const isFirst = idx === 0;
                  const isLast = idx === history.securityTimeline.length - 1;

                  return (
                    <div key={`sec-step-${idx}`} className="relative pl-10">
                      {/* Step Indicator Dot */}
                      <div className="absolute left-3 -translate-x-1/2 top-3 w-5 h-5 rounded-full bg-white dark:bg-slate-900 border-2 border-purple-500 flex items-center justify-center text-[10px] font-bold text-purple-600 dark:text-purple-400 shadow-xs">
                        {idx + 1}
                      </div>

                      <div className="bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 space-y-1.5 shadow-2xs">
                        <div className="flex items-center justify-between text-xs flex-wrap gap-1">
                          <span className="font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider text-[10px]">
                            {language === 'fr'
                              ? isFirst
                                ? '1ère constatation'
                                : `${idx + 1}ème constatation`
                              : isFirst
                              ? '1st Observation'
                              : `${idx + 1}${idx + 1 === 2 ? 'nd' : idx + 1 === 3 ? 'rd' : 'th'} Observation`}
                          </span>
                          <span className="text-[11px] font-sans font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-slate-400" />
                            {item.firstSeen ? formatToEuropeanDate(item.firstSeen) : (language === 'fr' ? 'Date inconnue' : 'Unknown date')}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold text-white shadow-2xs cursor-default"
                            style={{ backgroundColor: item.color }}
                            title={item.authMode || item.securityLabel || '[]'}
                          >
                            <Lock className="w-3 h-3 stroke-[2.5] text-white shrink-0" />
                            <span>{item.securityLabel}</span>
                          </span>

                          {!isWigleDevice && item.cipherLabel && item.securityType !== 'OPEN' && (
                            <span
                              className="text-[9.5px] font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700/80 shadow-2xs whitespace-nowrap inline-block cursor-default"
                              title={item.authMode || '[]'}
                            >
                              {item.cipherLabel}
                            </span>
                          )}

                          {item.hasWps && (
                            <span
                              className="inline-flex items-center px-1.5 py-0.2 rounded text-[9.5px] font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700/60 shadow-2xs cursor-default"
                              title={`WPS (Wi-Fi Protected Setup) • ${item.authMode || ''}`}
                            >
                              WPS
                            </span>
                          )}
                        </div>

                        <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 dark:border-slate-800/80 text-[11px] text-slate-500 dark:text-slate-400 font-sans">
                          <span className="flex items-center gap-1">
                            <Layers className="w-3 h-3 text-slate-400" />
                            {item.count} {language === 'fr' ? (item.count > 1 ? 'détections avec ce chiffrement' : 'détection avec ce chiffrement') : (item.count > 1 ? 'detections with this encryption' : 'detection with this encryption')}
                          </span>
                          {item.lastSeen && item.lastSeen !== item.firstSeen && (
                            <span className="text-[10px]">
                              {language === 'fr' ? 'Dernière détection\u00A0:' : 'Last seen:'} {formatToEuropeanDate(item.lastSeen)}
                            </span>
                          )}
                        </div>
                      </div>

                      {!isLast && (
                        <div className="flex items-center justify-center my-1 text-purple-500 dark:text-purple-400">
                          <ArrowDown className="w-4 h-4 animate-bounce" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 sm:p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/90 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors shadow-xs cursor-pointer"
          >
            {language === 'fr' ? 'Fermer' : 'Close'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
