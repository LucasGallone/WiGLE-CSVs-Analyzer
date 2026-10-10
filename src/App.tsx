import React, { useState, useEffect, useMemo } from 'react';
import {
  ScanSessionData,
  ProcessedAccessPoint,
  FilterState,
  AnalysisMode,
} from './types/wigle';
import {
  parseWigleCsvString,
  parseWigleCsvFileStreaming,
  ParseProgressInfo,
  mergeScanSessions,
  refreshVendors,
  isWigleModel,
} from './utils/csvParser';
import { analyzeNetworkHistory } from './utils/historyUtils';
import { loadCustomOuiDatabase } from './data/ouiDatabase';
import { ThemeProvider } from './context/ThemeContext';
import { LanguageProvider, useLanguage } from './context/LanguageContext';
import { Header } from './components/Header/Header';
import { FileDropzone } from './components/FileUpload/FileDropzone';
import { WigleMap } from './components/Map/WigleMap';
import { NetworkTable } from './components/NetworkList/NetworkTable';
import { StatsDashboard } from './components/Stats/StatsDashboard';
import { NetworkDetailModal } from './components/Inspector/NetworkDetailModal';
import { OuiManagerModal } from './components/OuiManager/OuiManagerModal';
import { InstructionsModal } from './components/FileUpload/InstructionsModal';
import {
  Map,
  BarChart2,
  Radio,
  Bluetooth,
  X,
  Plus,
  FileSpreadsheet,
  MapPin,
  Smartphone,
  Layers,
  LogOut,
  Loader2,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';

function AppContent() {
  const { t, language } = useLanguage();
  const [session, setSession] = useState<ScanSessionData | null>(null);
  const [analysisMode, setAnalysisMode] = useState<AnalysisMode>('WIFI');
  const [isSwitchingMode, setIsSwitchingMode] = useState(false);
  const [targetSwitchMode, setTargetSwitchMode] = useState<AnalysisMode | null>(null);
  const lastAutoSwitchedSessionRef = React.useRef<ScanSessionData | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingFileCount, setProcessingFileCount] = useState(1);
  const [currentProcessingFileName, setCurrentProcessingFileName] = useState('');
  const [progressInfo, setProgressInfo] = useState<ParseProgressInfo | null>(null);
  const [customOuiMap, setCustomOuiMap] = useState<Record<string, string>>({});
  const [selectedAp, setSelectedAp] = useState<ProcessedAccessPoint | null>(null);
  const [inspectingAp, setInspectingAp] = useState<ProcessedAccessPoint | null>(null);
  const [isOuiModalOpen, setIsOuiModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isInstructionsModalOpen, setIsInstructionsModalOpen] = useState(false);

  const initialFilters: FilterState = {
    searchQuery: '',
    securityFilter: [],
    minRssi: -100,
    maxRssi: 0,
    vendorFilter: 'ALL',
    ouiFilter: 'ALL',
    channelFilter: 'ALL',
    bandFilter: 'ALL',
    dateFilter: 'ALL',
    locationFilter: null,
    wpsFilter: 'ALL',
    cipherAlgorithmFilter: 'ALL',
    isCipherFilterActive: false,
    onlyOpenNetworks: false,
    onlyWpa3: false,
    onlyModifiedNetworks: false,
    btCategoryFilter: 'ALL',
    btTypeFilter: 'ALL',
    btCompanyFilter: 'ALL',
    onlyNamedBtDevices: false,
  };

  const [filters, setFilters] = useState<FilterState>(initialFilters);

  // Calculate distinct WiFi vs Bluetooth device counts across session
  const { wifiCount, btCount } = useMemo(() => {
    if (!session || !session.accessPoints) return { wifiCount: 0, btCount: 0 };
    let wifi = 0;
    let bt = 0;
    session.accessPoints.forEach((ap) => {
      if (ap.type === 'BLE' || ap.type === 'BT' || ap.btProtocol !== undefined) {
        bt++;
      } else {
        wifi++;
      }
    });
    return { wifiCount: wifi, btCount: bt };
  }, [session]);

  // Auto-switch mode once upon session load if session contains exclusively Bluetooth devices or WiFi
  useEffect(() => {
    if (session && lastAutoSwitchedSessionRef.current !== session) {
      lastAutoSwitchedSessionRef.current = session;
      if (wifiCount === 0 && btCount > 0 && analysisMode === 'WIFI') {
        setAnalysisMode('BT');
      } else if (btCount === 0 && wifiCount > 0 && analysisMode === 'BT') {
        setAnalysisMode('WIFI');
      }
    }
  }, [session, wifiCount, btCount, analysisMode]);

  // Check WiGLE device status across all files in session
  const { hasAnyWigleDevice, isAllWigleDevice, totalFilesCount } = useMemo(() => {
    if (!session || !session.files || session.files.length === 0) {
      return { hasAnyWigleDevice: false, isAllWigleDevice: false, totalFilesCount: 0 };
    }
    const totalFiles = session.files.length;
    let wigleCount = 0;
    session.files.forEach((file) => {
      const meta = session.filesMetadata?.[file];
      const isFileWigle = meta !== undefined ? meta.isWigleDevice : isWigleModel(session.header);
      if (isFileWigle) {
        wigleCount++;
      }
    });
    return {
      hasAnyWigleDevice: wigleCount > 0,
      isAllWigleDevice: wigleCount === totalFiles,
      totalFilesCount: totalFiles,
    };
  }, [session]);

  const isWigleDevice = isAllWigleDevice;

  // Load custom OUI map from local storage on mount
  useEffect(() => {
    const loaded = loadCustomOuiDatabase();
    setCustomOuiMap(loaded);
  }, []);

  // Update session when custom OUI map changes
  const handleUpdateCustomOuiMap = (newMap: Record<string, string>) => {
    setCustomOuiMap(newMap);
    if (session) {
      const refreshed = refreshVendors(session, newMap);
      setSession(refreshed);
    }
  };

  // High-performance streaming loader for large files (+100MB) without freezing the UI
  const handleLoadFiles = async (files: File[], mode?: AnalysisMode) => {
    if (!files || files.length === 0) return;
    if (mode) {
      setAnalysisMode(mode);
    }
    // Strictly restrict imported files exclusively to CSV
    const csvFiles = files.filter(
      (file) => file.name.toLowerCase().endsWith('.csv') || file.type === 'text/csv'
    );
    if (csvFiles.length === 0) return;

    setIsProcessing(true);
    setIsImportModalOpen(false);
    setProcessingFileCount(csvFiles.length);

    try {
      for (let i = 0; i < csvFiles.length; i++) {
        const file = csvFiles[i];
        setCurrentProcessingFileName(file.name);
        setProgressInfo({
          fileName: file.name,
          rowsParsed: 0,
          uniqueApsCount: 0,
          percent: 0,
        });

        // Parse file chunk-by-chunk asynchronously via streaming PapaParse
        const parsed = await parseWigleCsvFileStreaming(
          file,
          file.name,
          customOuiMap,
          (progress) => {
            setProgressInfo((prev) => {
              if (prev && (prev.percent ?? 0) >= 100) {
                return {
                  ...prev,
                  fileName: progress.fileName || prev.fileName,
                  rowsParsed: Math.max(prev.rowsParsed, progress.rowsParsed),
                  uniqueApsCount: Math.max(prev.uniqueApsCount, progress.uniqueApsCount),
                  percent: 100,
                };
              }
              return progress;
            });
          }
        );

        setSession((prevSession) => {
          const baseSession = prevSession;
          return mergeScanSessions(
            baseSession,
            parsed.header,
            parsed.rawRecords,
            file.name,
            customOuiMap,
            parsed.accessPoints
          );
        });

        // Small pause between multiple files to allow React state flush
        await new Promise((r) => setTimeout(r, 20));
      }

      setIsImportModalOpen(false);
      setSelectedAp(null);
    } catch (err) {
      console.error('Error streaming CSV file:', err);
    } finally {
      setIsProcessing(false);
      setProgressInfo(null);
      setCurrentProcessingFileName('');
    }
  };

  // Offload 100% of CSV imports to dedicated Web Worker via parseWigleCsvFileStreaming
  const handleLoadCsv = async (
    csvContent: string,
    fileName: string,
    isAppend: boolean,
    totalFilesCount?: number,
    mode?: AnalysisMode
  ) => {
    // Strictly restrict imported files exclusively to CSV
    if (!fileName.toLowerCase().endsWith('.csv')) {
      return;
    }
    if (mode) {
      setAnalysisMode(mode);
    }

    setIsProcessing(true);
    setIsImportModalOpen(false);
    setProcessingFileCount(totalFilesCount || 1);
    setCurrentProcessingFileName(fileName);
    try {
      const file = new File([csvContent], fileName, { type: 'text/csv' });
      const parsed = await parseWigleCsvFileStreaming(
        file,
        fileName,
        customOuiMap,
        (progress) => {
          setProgressInfo((prev) => {
            if (prev && (prev.percent ?? 0) >= 100) {
              return {
                ...prev,
                fileName: progress.fileName || prev.fileName,
                rowsParsed: Math.max(prev.rowsParsed, progress.rowsParsed),
                uniqueApsCount: Math.max(prev.uniqueApsCount, progress.uniqueApsCount),
                percent: 100,
              };
            }
            return progress;
          });
        }
      );
      setSession((prevSession) => {
        const baseSession = isAppend ? prevSession : null;
        return mergeScanSessions(
          baseSession,
          parsed.header,
          parsed.rawRecords,
          fileName,
          customOuiMap,
          parsed.accessPoints
        );
      });
      setIsImportModalOpen(false);
      setSelectedAp(null);
    } catch (err) {
      console.error('Error importing CSV via Worker:', err);
    } finally {
      setIsProcessing(false);
      setProgressInfo(null);
      setCurrentProcessingFileName('');
    }
  };

  const handleClearSession = () => {
    setSession(null);
    setSelectedAp(null);
    setInspectingAp(null);
    setFilters(initialFilters);
    setAnalysisMode('WIFI');
    lastAutoSwitchedSessionRef.current = null;
  };

  const handleSwitchAnalysisMode = (newMode: AnalysisMode) => {
    if (newMode === analysisMode) return;
    setSelectedAp(null);
    setInspectingAp(null);
    setFilters(initialFilters);
    if (session && session.accessPoints.length > 0) {
      setIsSwitchingMode(true);
      setTargetSwitchMode(newMode);
      setTimeout(() => {
        setAnalysisMode(newMode);
        setTimeout(() => {
          setIsSwitchingMode(false);
          setTargetSwitchMode(null);
        }, 160);
      }, 50);
    } else {
      setAnalysisMode(newMode);
    }
  };

  // Filtered APs based on current filter state and analysis mode (WiFi vs Bluetooth)
  const filteredAps = useMemo(() => {
    if (!session) return [];
    return session.accessPoints.filter((ap) => {
      // 0. Strict Mode Separation
      if (analysisMode === 'BT') {
        if (ap.type !== 'BLE' && ap.type !== 'BT' && ap.btProtocol === undefined) return false;

        // 1. Bluetooth Search query (SSID/Device name, MAC, OUI, Vendor, Company, Category)
        if (filters.searchQuery) {
          const q = filters.searchQuery.toLowerCase().trim();
          const matchSsid = ap.ssid ? ap.ssid.toLowerCase().includes(q) : false;
          const matchMac = ap.mac.toLowerCase().includes(q);
          const matchOui = ap.oui.toLowerCase().includes(q);
          const matchVendor = ap.vendor ? ap.vendor.toLowerCase().includes(q) : false;
          const matchCompany = ap.btCompany ? ap.btCompany.toLowerCase().includes(q) : false;
          const matchCatEn = ap.btCategoryEn ? ap.btCategoryEn.toLowerCase().includes(q) : false;
          const matchCatFr = ap.btCategoryFr ? ap.btCategoryFr.toLowerCase().includes(q) : false;
          if (!matchSsid && !matchMac && !matchOui && !matchVendor && !matchCompany && !matchCatEn && !matchCatFr) return false;
        }

        // 2. Category Filter
        if (filters.btCategoryFilter && filters.btCategoryFilter !== 'ALL') {
          const cat = filters.btCategoryFilter;
          const matchCat =
            ap.btCategory === cat ||
            ap.btCategoryEn === cat ||
            ap.btCategoryFr === cat ||
            ap.btCategoryGroup === cat ||
            (cat.toLowerCase().includes('uncategorized') &&
              (!ap.btCategory ||
                ap.btCategory.toLowerCase().includes('uncategorized') ||
                (ap.btCategoryEn && ap.btCategoryEn.toLowerCase().includes('uncategorized')) ||
                (ap.btCategoryFr && ap.btCategoryFr.toLowerCase().includes('catégorisé'))));
          if (!matchCat) {
            return false;
          }
        }

        // 3. Protocol Type Filter (BLE vs BT Classic)
        if (filters.btTypeFilter && filters.btTypeFilter !== 'ALL') {
          if (filters.btTypeFilter === 'BLE' && ap.type !== 'BLE' && ap.btProtocol !== 'BLE') return false;
          if (filters.btTypeFilter === 'BT' && ap.type !== 'BT' && ap.btProtocol !== 'BT') return false;
        }

        // 4. Company / Vendor Filter
        if (filters.btCompanyFilter && filters.btCompanyFilter !== 'ALL') {
          if (ap.btCompany !== filters.btCompanyFilter && ap.vendor !== filters.btCompanyFilter) return false;
        }

        // 5. Only Named Devices Filter
        if (filters.onlyNamedBtDevices) {
          if (!ap.ssid || ap.ssid.trim().length === 0) return false;
        }

        // 6. Vendor
        if (filters.vendorFilter && filters.vendorFilter !== 'ALL') {
          if (ap.vendor !== filters.vendorFilter && ap.btCompany !== filters.vendorFilter) return false;
        }

        // 7. OUI
        if (filters.ouiFilter && filters.ouiFilter !== 'ALL') {
          if (ap.oui !== filters.ouiFilter) return false;
        }

        // 8. RSSI range
        if (filters.minRssi > -100 && ap.bestRssi < filters.minRssi) return false;
        if (filters.maxRssi < 0 && ap.bestRssi > filters.maxRssi) return false;

        // 9. Date / Day filter
        if (filters.dateFilter && filters.dateFilter !== 'ALL') {
          const apDate = (ap.firstSeen || '').substring(0, 10);
          const hasDateInObs = ap.observations.some((obs) => (obs.timestamp || '').startsWith(filters.dateFilter));
          if (apDate !== filters.dateFilter && !hasDateInObs) return false;
        }

        // 10. Geographic Location filter
        if (filters.locationFilter) {
          const key = `${ap.latitude.toFixed(5)},${ap.longitude.toFixed(5)}`;
          const dLat = (ap.latitude - filters.locationFilter.lat) * 111320;
          const dLon =
            (ap.longitude - filters.locationFilter.lng) *
            111320 *
            Math.cos(((ap.latitude + filters.locationFilter.lat) * Math.PI) / 360);
          const isNearby = Math.sqrt(dLat * dLat + dLon * dLon) <= 32;

          const hasObsAtLocation = ap.observations.some((obs) => {
            if (obs.latitude === 0 && obs.longitude === 0) return false;
            const oKey = `${obs.latitude.toFixed(5)},${obs.longitude.toFixed(5)}`;
            if (oKey === filters.locationFilter?.key) return true;
            const odLat = (obs.latitude - filters.locationFilter!.lat) * 111320;
            const odLon =
              (obs.longitude - filters.locationFilter!.lng) *
              111320 *
              Math.cos(((obs.latitude + filters.locationFilter!.lat) * Math.PI) / 360);
            return Math.sqrt(odLat * odLat + odLon * odLon) <= 32;
          });

          if (key !== filters.locationFilter.key && !isNearby && !hasObsAtLocation) return false;
        }

        return true;
      }

      // WIFI MODE
      if (ap.type === 'BLE' || ap.type === 'BT' || ap.btProtocol !== undefined) return false;

      // 1. Search query (strictly restricted to SSID, BSSID/MAC, OUI)
      if (filters.searchQuery) {
        const q = filters.searchQuery.toLowerCase().trim();
        const matchSsid = ap.ssid.toLowerCase().includes(q);
        const matchMac = ap.mac.toLowerCase().includes(q);
        const matchOui = ap.oui.toLowerCase().includes(q);
        if (!matchSsid && !matchMac && !matchOui) return false;
      }

      // 2. Direct Security / Encryption
      if (filters.securityFilter.length > 0 && !filters.securityFilter.includes('ALL')) {
        if (!filters.securityFilter.includes(ap.security.type)) return false;
      }

      // 2b. Dynamic Cipher Algorithm Filter
      if (
        filters.isCipherFilterActive &&
        filters.cipherAlgorithmFilter &&
        filters.cipherAlgorithmFilter !== 'ALL'
      ) {
        const target = filters.cipherAlgorithmFilter.toUpperCase();
        const rawAuth = (ap.authMode || '').toUpperCase();
        const ciphers = (ap.security.ciphers || []).map((c) => c.toUpperCase());
        const cipherLabel = (ap.security.cipherLabel || '').toUpperCase();
        const isWpa3Ent192 =
          rawAuth.includes('SUITE-B') ||
          rawAuth.includes('EAP/SHA384') ||
          rawAuth.includes('EAP-SHA384') ||
          rawAuth.includes('SHA384') ||
          ap.security.type === 'WPA3_ENTERPRISE';

        let match = false;

        if (target === 'GCMP-256') {
          match =
            rawAuth.includes('GCMP-256') ||
            (isWpa3Ent192 && rawAuth.includes('GCMP')) ||
            ciphers.some((c) => c.includes('GCMP-256') || c.includes('256')) ||
            (cipherLabel.includes('GCMP') && (cipherLabel.includes('256') || isWpa3Ent192));
        } else if (target === 'GCMP-128') {
          match =
            (rawAuth.includes('GCMP-128') || (rawAuth.includes('GCMP') && !rawAuth.includes('256') && !isWpa3Ent192)) ||
            ciphers.some((c) => c.includes('GCMP-128') || (c.includes('GCMP') && !c.includes('256') && !isWpa3Ent192)) ||
            (cipherLabel.includes('GCMP') && !cipherLabel.includes('256') && !isWpa3Ent192);
        } else if (target === 'CCMP-256') {
          match =
            rawAuth.includes('CCMP-256') ||
            (rawAuth.includes('CCMP') && rawAuth.includes('256')) ||
            ciphers.some((c) => c.includes('CCMP-256') || c.includes('256')) ||
            (cipherLabel.includes('CCMP') && cipherLabel.includes('256'));
        } else if (target === 'CCMP') {
          match =
            (rawAuth.includes('CCMP') && !rawAuth.includes('256')) ||
            rawAuth.includes('AES') ||
            ciphers.some((c) => c.includes('CCMP') || c.includes('AES')) ||
            cipherLabel.includes('CCMP') ||
            cipherLabel.includes('AES');
        } else {
          match =
            rawAuth.includes(target) ||
            ciphers.some((c) => c.includes(target)) ||
            cipherLabel.includes(target);
        }

        if (!match) return false;
      }

      // 3. Channel & Band filter (Unified)
      if (filters.channelFilter && filters.channelFilter !== 'ALL') {
        if (filters.channelFilter === 'BAND_2_4') {
          if (ap.band !== '2.4 GHz') return false;
        } else if (filters.channelFilter === 'BAND_5') {
          if (ap.band !== '5 GHz') return false;
        } else if (filters.channelFilter === 'BAND_6') {
          if (ap.band !== '6 GHz') return false;
        } else if (filters.channelFilter.startsWith('2G:')) {
          const target = filters.channelFilter.replace('2G:', '');
          if (ap.band !== '2.4 GHz' || String(ap.channel) !== target) return false;
        } else if (filters.channelFilter.startsWith('5G:')) {
          const target = filters.channelFilter.replace('5G:', '');
          if (ap.band !== '5 GHz' || String(ap.channel) !== target) return false;
        } else if (filters.channelFilter.startsWith('6G:')) {
          const target = filters.channelFilter.replace('6G:', '');
          if (ap.band !== '6 GHz' || String(ap.channel) !== target) return false;
        } else {
          if (String(ap.channel) !== filters.channelFilter) return false;
        }
      }

      // 4. WPS Filter
      if (filters.wpsFilter === 'WPS_ONLY') {
        const hasWps = ap.hasWps || (ap.authMode || '').toUpperCase().includes('WPS');
        if (!hasWps) return false;
      } else if (filters.wpsFilter === 'NO_WPS') {
        const hasWps = ap.hasWps || (ap.authMode || '').toUpperCase().includes('WPS');
        if (hasWps) return false;
      }

      // 5. Date / Day filter
      if (filters.dateFilter && filters.dateFilter !== 'ALL') {
        const apDate = (ap.firstSeen || '').substring(0, 10);
        const hasDateInObs = ap.observations.some((obs) => (obs.timestamp || '').startsWith(filters.dateFilter));
        if (apDate !== filters.dateFilter && !hasDateInObs) return false;
      }

      // 6. Geographic Location filter (from map search / point selection)
      if (filters.locationFilter) {
        const key = `${ap.latitude.toFixed(5)},${ap.longitude.toFixed(5)}`;
        const dLat = (ap.latitude - filters.locationFilter.lat) * 111320;
        const dLon =
          (ap.longitude - filters.locationFilter.lng) *
          111320 *
          Math.cos(((ap.latitude + filters.locationFilter.lat) * Math.PI) / 360);
        const isNearby = Math.sqrt(dLat * dLat + dLon * dLon) <= 32;

        const hasObsAtLocation = ap.observations.some((obs) => {
          if (obs.latitude === 0 && obs.longitude === 0) return false;
          const oKey = `${obs.latitude.toFixed(5)},${obs.longitude.toFixed(5)}`;
          if (oKey === filters.locationFilter?.key) return true;
          const odLat = (obs.latitude - filters.locationFilter!.lat) * 111320;
          const odLon =
            (obs.longitude - filters.locationFilter!.lng) *
            111320 *
            Math.cos(((obs.latitude + filters.locationFilter!.lat) * Math.PI) / 360);
          return Math.sqrt(odLat * odLat + odLon * odLon) <= 32;
        });

        if (key !== filters.locationFilter.key && !isNearby && !hasObsAtLocation) return false;
      }

      // 7. RSSI range
      if (filters.minRssi > -100 && ap.bestRssi < filters.minRssi) return false;
      if (filters.maxRssi < 0 && ap.bestRssi > filters.maxRssi) return false;

      // 8. Vendor
      if (filters.vendorFilter && filters.vendorFilter !== 'ALL') {
        if (ap.vendor !== filters.vendorFilter) return false;
      }

      // 9. OUI
      if (filters.ouiFilter && filters.ouiFilter !== 'ALL') {
        if (ap.oui !== filters.ouiFilter) return false;
      }

      // 10. Toggles
      if (filters.onlyOpenNetworks && ap.security.isSecure) return false;
      if (filters.onlyWpa3 && ap.security.type !== 'WPA3') return false;

      // 11. Modified Networks Only (O(1) pre-calculated status)
      if (filters.onlyModifiedNetworks) {
        if (!(ap.isModified ?? (ap.hasSsidChanged || ap.hasSecurityChanged))) return false;
      }

      return true;
    });
  }, [session, filters, analysisMode]);

  // Check if any filter is actively enabled by the user
  const isAnyFilterActive = useMemo(() => {
    if (analysisMode === 'BT') {
      return Boolean(
        (filters.searchQuery && filters.searchQuery.trim().length > 0) ||
        (filters.btCategoryFilter && filters.btCategoryFilter !== 'ALL') ||
        (filters.btTypeFilter && filters.btTypeFilter !== 'ALL') ||
        (filters.btCompanyFilter && filters.btCompanyFilter !== 'ALL') ||
        filters.onlyNamedBtDevices ||
        filters.minRssi > -100 ||
        filters.maxRssi < 0 ||
        (filters.vendorFilter && filters.vendorFilter !== 'ALL') ||
        (filters.ouiFilter && filters.ouiFilter !== 'ALL') ||
        (filters.dateFilter && filters.dateFilter !== 'ALL') ||
        filters.locationFilter !== null
      );
    }

    return Boolean(
      (filters.searchQuery && filters.searchQuery.trim().length > 0) ||
      (filters.securityFilter && filters.securityFilter.length > 0 && !filters.securityFilter.includes('ALL')) ||
      (filters.channelFilter && filters.channelFilter !== 'ALL') ||
      (filters.dateFilter && filters.dateFilter !== 'ALL') ||
      (filters.wpsFilter && filters.wpsFilter !== 'ALL' && filters.wpsFilter !== 'HIDE_BADGES') ||
      filters.minRssi > -100 ||
      filters.maxRssi < 0 ||
      (filters.vendorFilter && filters.vendorFilter !== 'ALL') ||
      (filters.ouiFilter && filters.ouiFilter !== 'ALL') ||
      filters.locationFilter !== null ||
      filters.onlyOpenNetworks ||
      filters.onlyWpa3 ||
      filters.onlyModifiedNetworks
    );
  }, [filters, analysisMode]);

  const totalGpsPointsCount = useMemo(() => {
    if (!session) return 0;
    return filteredAps.filter((ap) => ap.latitude !== 0 && ap.longitude !== 0).length;
  }, [session, filteredAps]);

  // Shortcut to filter by security category from stats dashboard
  const handleFilterBySecurity = (type: string) => {
    setFilters((prev) => ({
      ...prev,
      securityFilter: [type],
    }));
  };

  // Shortcut to filter by vendor from stats dashboard
  const handleFilterByVendor = (vendor: string) => {
    setFilters((prev) => ({
      ...prev,
      vendorFilter: vendor,
    }));
  };

  // Shortcut to filter by Bluetooth category
  const handleFilterByCategory = (category: string) => {
    setFilters((prev) => ({
      ...prev,
      btCategoryFilter: category,
    }));
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col transition-colors duration-200">
      {/* Top Header */}
      <Header
        onOpenOuiManager={() => setIsOuiModalOpen(true)}
        analysisMode={analysisMode}
        onChangeAnalysisMode={handleSwitchAnalysisMode}
        wifiCount={wifiCount}
        btCount={btCount}
        isFileLoaded={!!session}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-[1700px] w-full mx-auto p-3 sm:p-5 lg:p-6 space-y-6">
        {/* On Initial Start / No Session: Show ONLY the Import Screen / Modal */}
        {!session ? (
          <div className="min-h-[75vh] flex flex-col items-center justify-center py-8">
            <div className="w-full max-w-xl space-y-6">
              <div className="text-center space-y-2">
                <div className={`inline-flex p-3 rounded-2xl border mb-1 transition-colors ${
                  analysisMode === 'BT'
                    ? 'bg-indigo-100 dark:bg-indigo-950 border-indigo-300 dark:border-indigo-700/50 text-indigo-600 dark:text-indigo-400'
                    : 'bg-cyan-100 dark:bg-cyan-950 border-cyan-300 dark:border-cyan-700/50 text-cyan-600 dark:text-cyan-400'
                }`}>
                  {analysisMode === 'BT' ? <Bluetooth className="w-8 h-8" /> : <Radio className="w-8 h-8" />}
                </div>
                <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                  WiGLE CSVs Analyzer
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto">
                  {language === 'fr' ? (
                    <>
                      Importez vos fichiers de scan WiFi ou Bluetooth WiGLE et accédez à une interface d'analyse complète. Visualisez les équipements sur une carte interactive, filtrez par catégories ou protocoles, et bien plus encore...
                      <br />
                      (Fonctionne également avec les détections de périphériques Bluetooth)
                    </>
                  ) : (
                    <>
                      Import your WiGLE WiFi scan files and access a comprehensive analysis interface. Visualize networks on an interactive map and generate statistics regarding encryption, OUI prefixes, and much more...
                      <br />
                      (Also works with Bluetooth devices detection)
                    </>
                  )}
                </p>
              </div>

              {/* Initial Import Dropzone */}
              <FileDropzone
                onLoadFiles={handleLoadFiles}
                onLoadCsv={handleLoadCsv}
                onClearSession={handleClearSession}
                loadedFiles={[]}
                totalAps={0}
                totalRecords={0}
                isInitialModal={true}
                onOpenInstructions={() => setIsInstructionsModalOpen(true)}
                analysisMode={analysisMode}
                onChangeAnalysisMode={handleSwitchAnalysisMode}
                isProcessing={isProcessing}
              />
            </div>
          </div>
        ) : (
          /* Once data is loaded: Show Statistics, Map, and Network List all together on the same page */
          <div className="space-y-6 animate-fadeIn">
            {/* WiGLE Export Server / Phone Notice Banner */}
            {hasAnyWigleDevice && analysisMode === 'WIFI' && (
              <div className="bg-amber-50 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-700/80 rounded-2xl p-4 text-xs sm:text-sm text-amber-950 dark:text-amber-200 flex items-start gap-3 shadow-xs">
                <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <p className="leading-relaxed font-medium">
                  {totalFilesCount > 1
                    ? language === 'fr'
                      ? 'Au moins un des fichiers importés ne contient pas de détails avancés concernant la sécurité des réseaux et les canaux WiFi utilisés. Les types de chiffrement sont affichés, mais sans détails tels que les algorithmes spécifiques ou la présence du WPS. Les canaux / bandes WiFi sont partiellement masqués.'
                      : 'At least one of the imported files does not contain advanced details regarding network security and WiFi channels. Encryption types are displayed, but without details such as specific algorithms or the presence of WPS. WiFi channels / bands are partially hidden.'
                    : language === 'fr'
                    ? 'Le fichier importé ne contient pas de détails concernant la sécurité des réseaux et les canaux WiFi utilisés. Les types de chiffrements sont affichés, mais sans détails tels que les algorithmes de chiffrement ou la présence du WPS. Les canaux / bandes WiFi sont masqués.'
                    : 'The imported CSV file does not contain advanced details regarding networks security and the used WiFi channels. The encryptions are displayed, but without details such as specific ciphers or WPS presence. WiFi channels / bands are hidden.'}
                </p>
              </div>
            )}

            {/* Quick Session Status Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 p-3.5 rounded-2xl shadow-sm">
              <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
                {/* Active Scan Files Badge */}
                <div className="relative group">
                  <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold cursor-default transition-colors group-hover:border-cyan-400 dark:group-hover:border-cyan-600">
                    <FileSpreadsheet className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400 shrink-0" />
                    <span className="font-sans font-semibold truncate max-w-[220px] sm:max-w-xs">
                      {session.files.length > 1
                        ? language === 'fr'
                          ? 'Plusieurs fichiers'
                          : 'Multiple files'
                        : session.files[0] || 'scan.csv'}
                    </span>
                  </span>

                  {/* Stylized Tooltip - Only shown when multiple files are loaded */}
                  {session.files.length > 1 && (
                    <div className="absolute left-0 top-full mt-2 hidden group-hover:block z-50 min-w-[260px] max-w-sm p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 shadow-2xl backdrop-blur-md pointer-events-none animate-fadeIn">
                      <div className="absolute -top-1.5 left-5 w-3 h-3 bg-white dark:bg-slate-900 border-t border-l border-slate-200 dark:border-slate-700/80 rotate-45" />
                      <div className="relative text-[11px] font-bold uppercase tracking-wider text-cyan-600 dark:text-cyan-400 mb-2 flex items-center gap-1.5">
                        <FileSpreadsheet className="w-3.5 h-3.5" />
                        <span>
                          {language === 'fr' ? 'Fichiers importés' : 'Imported files'} ({session.files.length})
                        </span>
                      </div>
                      <ul className="relative space-y-1.5 font-sans text-xs text-slate-700 dark:text-slate-200 max-h-60 overflow-y-auto">
                        {session.files.map((file, idx) => (
                          <li key={idx} className="flex items-center gap-2 truncate" title={file}>
                            <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 shrink-0" />
                            <span className="truncate font-medium">{file}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Total Scan Records Count Badge */}
                <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-50 dark:bg-cyan-950/60 border border-cyan-300 dark:border-cyan-800 text-cyan-800 dark:text-cyan-300 text-xs font-semibold">
                  <Layers className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    <strong>{(session.totalRecords || session.rawRecords?.length || session.accessPoints.reduce((sum, ap) => sum + ap.observationCount, 0)).toLocaleString()}</strong>{' '}
                    {language === 'fr' ? 'captures au total' : 'captures in total'}
                  </span>
                </span>

                {/* Device / Scanner Metadata from WiGLE Header */}
                {(() => {
                  if (!session.header) return null;
                  const brandRaw = (session.header.brand || '').trim();
                  const modelRaw = (session.header.model || '').trim();
                  const deviceRaw = (session.header.device || session.header.format || '').trim();

                  // If model / brand is WIGLE.net Server, ignore value and do not display phone info
                  if (
                    brandRaw.toLowerCase().includes('wigle.net server') ||
                    modelRaw.toLowerCase().includes('wigle.net server') ||
                    deviceRaw.toLowerCase().includes('wigle.net server')
                  ) {
                    return null;
                  }

                  // Capitalize first letter of brand and model
                  const brand = brandRaw ? brandRaw.charAt(0).toUpperCase() + brandRaw.slice(1) : '';
                  const model = modelRaw ? modelRaw.charAt(0).toUpperCase() + modelRaw.slice(1) : '';
                  const device = deviceRaw ? deviceRaw.charAt(0).toUpperCase() + deviceRaw.slice(1) : '';

                  const display = [brand, model || device].filter(Boolean).join(' ').trim();
                  if (!display || display.toLowerCase().includes('wigle.net server')) return null;

                  return (
                    <span className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-[11px] text-slate-600 dark:text-slate-400 font-sans font-medium hidden lg:inline-flex border border-slate-200 dark:border-slate-800">
                      <Smartphone className="w-3 h-3 text-slate-400" />
                      <span>{display}</span>
                    </span>
                  );
                })()}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsImportModalOpen(true)}
                  className="flex items-center gap-1 px-3.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-all cursor-pointer border border-slate-200 dark:border-slate-700"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{t('header.addCsv')}</span>
                </button>

                {/* Return to Main Menu / Initial Import Dropzone Button */}
                <button
                  onClick={handleClearSession}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950/60 dark:hover:text-rose-300 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all cursor-pointer border border-slate-300 dark:border-slate-700 shadow-xs"
                  title={language === 'fr' ? 'Retourner au menu principal' : 'Return to main menu'}
                >
                  <LogOut className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                  <span>{t('header.mainMenu')}</span>
                </button>
              </div>
            </div>

            {/* 1. Statistics & Synthesis Dashboard */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BarChart2 className={`w-5 h-5 ${analysisMode === 'BT' ? 'text-indigo-600 dark:text-indigo-400' : 'text-cyan-600 dark:text-cyan-400'}`} />
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    {analysisMode === 'BT' ? t('dashboard.statsTitleBt') : t('dashboard.statsTitle')}
                  </h2>
                  {isAnyFilterActive && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-slate-950 uppercase tracking-wide">
                      {t('dashboard.filterActive')}
                    </span>
                  )}
                </div>
              </div>

              <StatsDashboard
                session={session}
                filteredAps={filteredAps}
                isFilterActive={isAnyFilterActive}
                isSecurityFiltered={filters.securityFilter.length > 0 && !filters.securityFilter.includes('ALL')}
                isVendorFiltered={filters.vendorFilter !== 'ALL'}
                isCategoryFiltered={Boolean(filters.btCategoryFilter && filters.btCategoryFilter !== 'ALL')}
                isWigleDevice={isWigleDevice}
                analysisMode={analysisMode}
                onFilterBySecurity={handleFilterBySecurity}
                onFilterByVendor={handleFilterByVendor}
                onFilterByCategory={handleFilterByCategory}
                onResetSecurityFilter={() => setFilters((prev) => ({ ...prev, securityFilter: [] }))}
                onResetVendorFilter={() => setFilters((prev) => ({ ...prev, vendorFilter: 'ALL' }))}
                onResetCategoryFilter={() => setFilters((prev) => ({ ...prev, btCategoryFilter: 'ALL' }))}
              />
            </section>

            {/* 2. Interactive OpenStreetMap */}
            <section id="wigle-map-section" className="space-y-3 scroll-mt-20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Map className={`w-5 h-5 ${analysisMode === 'BT' ? 'text-indigo-600 dark:text-indigo-400' : 'text-cyan-600 dark:text-cyan-400'}`} />
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    {t('dashboard.mapTitle')} ({filteredAps.length}{' '}
                    {language === 'fr'
                      ? analysisMode === 'BT'
                        ? filteredAps.length <= 1
                          ? 'périphérique cartographié'
                          : 'périphériques cartographiés'
                        : filteredAps.length <= 1
                        ? 'réseau cartographié'
                        : 'réseaux cartographiés'
                      : analysisMode === 'BT'
                      ? filteredAps.length <= 1
                        ? 'device mapped'
                        : 'devices mapped'
                      : filteredAps.length <= 1
                      ? 'network mapped'
                      : 'networks mapped'})
                  </h2>
                </div>
              </div>

              <WigleMap
                accessPoints={filteredAps}
                selectedAp={selectedAp}
                onSelectAp={(ap) => {
                  setSelectedAp(ap);
                }}
                onInspectAp={(ap) => {
                  setInspectingAp(ap);
                }}
                activeLocationFilter={filters.locationFilter}
                onFilterByLocation={(location) => {
                  setFilters((prev) => ({
                    ...prev,
                    locationFilter: location,
                  }));
                }}
                isWigleDevice={isWigleDevice || analysisMode === 'BT'}
                isBluetoothMode={analysisMode === 'BT'}
                totalGpsPointsCount={totalGpsPointsCount}
                onResetFilters={() => setFilters(initialFilters)}
                isOnlyModifiedFilterActive={Boolean(filters.onlyModifiedNetworks)}
              />
            </section>

            {/* 3. Merged Unified Networks Table */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {analysisMode === 'BT' ? (
                    <Bluetooth className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                  ) : (
                    <Radio className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
                  )}
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    {analysisMode === 'BT'
                      ? language === 'fr'
                        ? 'Liste des périphériques Bluetooth'
                        : 'Bluetooth Devices List'
                      : t('dashboard.tableTitle')}
                  </h2>
                </div>
              </div>

              <NetworkTable
                accessPoints={filteredAps}
                allAccessPoints={session.accessPoints}
                selectedAp={selectedAp}
                onSelectAp={(ap) => setSelectedAp(ap)}
                onInspectAp={(ap) => setInspectingAp(ap)}
                onOpenOuiManager={() => setIsOuiModalOpen(true)}
                filters={filters}
                onUpdateFilters={setFilters}
                onResetFilters={() => setFilters(initialFilters)}
                isWigleDevice={isWigleDevice || analysisMode === 'BT'}
                analysisMode={analysisMode}
              />
            </section>
          </div>
        )}
      </main>

      {/* Import CSV Modal (Accessible anytime to add/replace files) */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
          <div className="relative w-full max-w-3xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800 gap-2">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {t('header.import')}
              </h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsInstructionsModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-50 dark:bg-cyan-950/70 border border-cyan-300 dark:border-cyan-800 hover:bg-cyan-100 dark:hover:bg-cyan-900/80 text-cyan-800 dark:text-cyan-200 text-xs font-semibold shadow-xs transition-all cursor-pointer"
                >
                  <HelpCircle className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400 shrink-0" />
                  <span>
                    {language === 'fr'
                      ? 'Instructions pour récupérer vos fichiers CSV'
                      : 'Instructions for collecting your CSV files'}
                  </span>
                </button>
                <button
                  onClick={() => setIsImportModalOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <FileDropzone
              onLoadFiles={handleLoadFiles}
              onLoadCsv={handleLoadCsv}
              onClearSession={handleClearSession}
              loadedFiles={session?.files || []}
              totalAps={session?.accessPoints.length || 0}
              totalRecords={session?.totalRecords || session?.rawRecords?.length || session?.accessPoints.reduce((sum, ap) => sum + ap.observationCount, 0) || 0}
              headerInfo={session?.header}
              isInitialModal={false}
              isAddCsvModal={true}
              analysisMode={analysisMode}
              onChangeAnalysisMode={handleSwitchAnalysisMode}
              isProcessing={isProcessing}
            />

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setIsImportModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-700 text-xs font-semibold"
              >
                {t('modal.close')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Network Detail Inspector Modal */}
      {inspectingAp && (
        <NetworkDetailModal
          ap={inspectingAp}
          onClose={() => setInspectingAp(null)}
          isWigleDevice={isWigleDevice || analysisMode === 'BT'}
          onFocusMap={(ap) => {
            setSelectedAp(ap);
            const mapEl = document.getElementById('wigle-map-section');
            if (mapEl) {
              mapEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
            } else {
              window.scrollTo({ top: 400, behavior: 'smooth' });
            }
          }}
        />
      )}

      {/* OUI Database Manager Modal */}
      {isOuiModalOpen && (
        <OuiManagerModal
          customOuiMap={customOuiMap}
          onUpdateCustomOuiMap={handleUpdateCustomOuiMap}
          onClose={() => setIsOuiModalOpen(false)}
        />
      )}

      {/* CSV Collection Instructions Modal */}
      <InstructionsModal
        isOpen={isInstructionsModalOpen}
        onClose={() => setIsInstructionsModalOpen(false)}
      />

      {/* Mode Switching Loading Modal */}
      {isSwitchingMode && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-7 max-w-sm w-full shadow-2xl flex flex-col items-center text-center space-y-4 animate-scaleUp">
            <div className={`p-3.5 rounded-2xl border shadow-sm ${
              targetSwitchMode === 'BT'
                ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400'
                : 'bg-cyan-50 dark:bg-cyan-950/60 border-cyan-200 dark:border-cyan-800 text-cyan-600 dark:text-cyan-400'
            }`}>
              <Loader2 className="w-7 h-7 animate-spin" />
            </div>
            <div className="space-y-1">
              <h4 className="text-base font-bold text-slate-900 dark:text-white">
                {targetSwitchMode === 'BT'
                  ? (language === 'fr' ? 'Bascule vers le mode Bluetooth...' : 'Switching to Bluetooth mode...')
                  : (language === 'fr' ? 'Bascule vers le mode WiFi...' : 'Switching to WiFi mode...')}
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {targetSwitchMode === 'BT'
                  ? (language === 'fr' ? 'Veuillez patienter quelques instants.' : 'Please wait a few seconds.')
                  : (language === 'fr' ? 'Veuillez patienter quelques instants.' : 'Please wait a few seconds.')}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* File Processing Screen / Modal Overlay with Real-Time Progress Feedback */}
      {isProcessing && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 max-w-md w-full shadow-2xl flex flex-col items-center text-center space-y-4 animate-scaleUp">
            <div className="p-4 rounded-2xl bg-cyan-50 dark:bg-cyan-950/60 border border-cyan-200 dark:border-cyan-800 text-cyan-600 dark:text-cyan-400 shadow-sm">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
            <div className="w-full space-y-2">
              <h3 className="text-lg font-black text-slate-900 dark:text-white">
                {progressInfo && (progressInfo.percent ?? 0) >= 99
                  ? language === 'fr'
                    ? 'Import terminé. Indexation en cours...'
                    : 'Import complete. Indexing networks...'
                  : language === 'fr'
                  ? processingFileCount > 1
                    ? 'Traitement des fichiers en cours...'
                    : 'Traitement du fichier en cours...'
                  : processingFileCount > 1
                  ? 'Processing files...'
                  : 'Processing file...'}
              </h3>
              {currentProcessingFileName && (
                <p className="text-xs font-semibold text-cyan-600 dark:text-cyan-400 truncate max-w-[280px] mx-auto font-sans">
                  {currentProcessingFileName}
                </p>
              )}
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {progressInfo && (progressInfo.percent ?? 0) >= 99
                  ? language === 'fr'
                    ? 'Veuillez patienter encore quelques secondes.'
                    : 'Please wait a few more seconds.'
                  : language === 'fr'
                  ? 'Veuillez patienter. La durée de traitement varie selon la taille du fichier.'
                  : 'Please wait. Processing time varies depending on the file size.'}
              </p>

              {/* Real-Time Progress Bar */}
              {progressInfo && (
                <div className="pt-3 space-y-2 w-full text-left">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="text-slate-600 dark:text-slate-300 font-sans">
                      {progressInfo.rowsParsed.toLocaleString()} {language === 'fr' ? 'lignes analysées' : 'scanned rows'}
                    </span>
                    <span className="text-cyan-600 dark:text-cyan-400 font-bold font-sans">
                      {progressInfo.uniqueApsCount.toLocaleString()}{' '}
                      {analysisMode === 'BT'
                        ? language === 'fr'
                          ? progressInfo.uniqueApsCount > 1
                            ? 'périphériques Bluetooth'
                            : 'périphérique Bluetooth'
                          : progressInfo.uniqueApsCount > 1
                          ? 'Bluetooth devices'
                          : 'Bluetooth device'
                        : language === 'fr'
                        ? progressInfo.uniqueApsCount > 1
                          ? 'réseaux uniques'
                          : 'réseau unique'
                        : progressInfo.uniqueApsCount > 1
                        ? 'unique APs'
                        : 'unique AP'}
                    </span>
                  </div>

                  <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden border border-slate-200 dark:border-slate-700">
                    <div
                      className="h-full bg-gradient-to-r from-indigo-500 to-cyan-500 transition-all duration-300 ease-out"
                      style={{ width: `${Math.max(2, Math.min(100, progressInfo.percent ?? 0))}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-900 bg-white dark:bg-slate-950 py-6 text-center text-xs text-slate-500 dark:text-slate-400 transition-colors">
        <div className="max-w-4xl mx-auto px-4 space-y-2 text-center">
          {language === 'fr' ? (
            <>
              <p>
                Cet outil a été conçu exclusivement à des fins pédagogiques, d'analyse et de recherche en sécurité réseau.<br />
                Il n'incite en aucun cas à la connexion à des réseaux non ou mal sécurisés, pratique totalement contraire à l'éthique du wardriving.
              </p>
              <p>Ce projet a été réalisé par un développeur indépendant n'ayant aucune affiliation avec l'équipe de WiGLE.net.</p>
            </>
          ) : (
            <>
              <p>
                This tool was developed solely for educational, analytical, and network security research purposes.<br />
                It in no way encourages connecting to unsecured or poorly secured networks, practices that are entirely contrary to proper wardriving ethics.
              </p>
              <p>This project was created by an independent developer with no affiliation to the WiGLE.net team.</p>
            </>
          )}
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <AppContent />
      </LanguageProvider>
    </ThemeProvider>
  );
}
