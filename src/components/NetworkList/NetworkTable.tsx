import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ProcessedAccessPoint, FilterState, SecurityCategory } from '../../types/wigle';
import {
  Search,
  SlidersHorizontal,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  MapPin,
  Lock,
  Unlock,
  Radio,
  Info,
  ChevronLeft,
  ChevronRight,
  Filter,
  FilterX,
  ChevronDown,
  ChevronUp,
  Layers,
  Clock,
  Navigation,
  Calendar,
  RotateCcw,
  History,
  Loader2,
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { analyzeNetworkHistory, parseTimestampToMs } from '../../utils/historyUtils';
import { classifySecurity } from '../../utils/csvParser';
import { NetworkHistoryModal } from './NetworkHistoryModal';
import { getWigleSignalTier } from '../../utils/wigleSignalColors';
import { formatToEuropeanDate } from '../../utils/statsUtils';

function extractDateKey(timestamp?: string | null): string {
  if (!timestamp) return '';
  const ms = parseTimestampToMs(timestamp);
  if (ms <= 0) return '';
  const d = new Date(ms);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Reusable cached Collator for 30x faster SSID alphabetization without Intl recreation
const ssidCollator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });

interface StaticFiltersCache {
  channelOptions: {
    band24: { ch: string; freq: number; count: number }[];
    band5: { ch: string; freq: number; count: number }[];
    band6: { ch: string; freq: number; count: number }[];
    total24: number;
    total5: number;
    total6: number;
  };
  availableDates: string[];
  vendorData: {
    hasUnassignedVendor: boolean;
    unassignedCount: number;
    namedVendorsWithCount: { name: string; count: number }[];
  };
  ouiData: { oui: string; count: number; vendor: string }[];
}

const staticFiltersCache = new WeakMap<ProcessedAccessPoint[], StaticFiltersCache>();

const TruncatedSsid: React.FC<{ ssid: string }> = ({ ssid }) => {
  const [isTruncated, setIsTruncated] = useState(false);
  const textRef = useRef<HTMLSpanElement>(null);

  const checkTruncation = () => {
    if (textRef.current) {
      setIsTruncated(textRef.current.scrollWidth > textRef.current.clientWidth);
    }
  };

  return (
    <span
      ref={textRef}
      onMouseEnter={checkTruncation}
      title={isTruncated ? ssid : undefined}
      className="font-semibold text-slate-900 dark:text-white truncate max-w-[120px] lg:max-w-[170px] inline-block"
    >
      {ssid}
    </span>
  );
};

interface NetworkTableProps {
  accessPoints: ProcessedAccessPoint[];
  allAccessPoints?: ProcessedAccessPoint[];
  selectedAp: ProcessedAccessPoint | null;
  onSelectAp: (ap: ProcessedAccessPoint) => void;
  onInspectAp: (ap: ProcessedAccessPoint) => void;
  onOpenOuiManager: () => void;
  filters: FilterState;
  onUpdateFilters: (updater: (prev: FilterState) => FilterState) => void;
  onResetFilters: () => void;
  isWigleDevice?: boolean;
}

type SortField =
  | 'ssid'
  | 'mac'
  | 'vendor'
  | 'authMode'
  | 'bestRssi'
  | 'channel'
  | 'band'
  | 'frequency'
  | 'firstSeen'
  | 'observationCount';
type SortOrder = 'asc' | 'desc';

export type SubTableSortField =
  | 'index'
  | 'timestamp'
  | 'rssi'
  | 'ssid'
  | 'channel'
  | 'lat'
  | 'lon'
  | 'alt'
  | 'source';

export const NetworkTable: React.FC<NetworkTableProps> = ({
  accessPoints,
  allAccessPoints,
  selectedAp,
  onSelectAp,
  onInspectAp,
  filters,
  onUpdateFilters,
  onResetFilters,
  isWigleDevice = false,
}) => {
  const { t, language } = useLanguage();
  const sessionAps = allAccessPoints || accessPoints;
  const [sortField, setSortField] = useState<SortField>('ssid');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [subTableSortField, setSubTableSortField] = useState<SubTableSortField>('timestamp');
  const [subTableSortOrder, setSubTableSortOrder] = useState<SortOrder>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(100);
  // Filters are open by default
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(true);
  const [expandedMacs, setExpandedMacs] = useState<Set<string>>(new Set());
  const [historyModalAp, setHistoryModalAp] = useState<ProcessedAccessPoint | null>(null);
  const [historyModalType, setHistoryModalType] = useState<'SSID' | 'SECURITY'>('SSID');

  // Immediate local state for responsive, lag-free search input typing
  const [searchInputValue, setSearchInputValue] = useState(filters.searchQuery);
  const [isSearching, setIsSearching] = useState(false);

  // Sync local search input if filters.searchQuery changes externally (e.g. filter reset)
  useEffect(() => {
    setSearchInputValue(filters.searchQuery);
  }, [filters.searchQuery]);

  // Explicit search execution with visual loading overlay
  const handleExecuteSearch = (targetQuery?: string) => {
    const query = targetQuery !== undefined ? targetQuery : searchInputValue;
    setIsSearching(true);
    // Request animation frames so the browser renders and paints the modal overlay before the heavy filtering runs
    requestAnimationFrame(() => {
      setTimeout(() => {
        onUpdateFilters((prev) => ({ ...prev, searchQuery: query }));
        setCurrentPage(1);
        setTimeout(() => {
          setIsSearching(false);
        }, 80);
      }, 50);
    });
  };

  const renderSortIndicator = (field: SortField) => {
    if (sortField !== field) return null;
    return sortOrder === 'asc' ? (
      <ArrowUp className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400 shrink-0 font-bold" />
    ) : (
      <ArrowDown className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400 shrink-0 font-bold" />
    );
  };

  const handleSubTableSort = (field: SubTableSortField) => {
    if (subTableSortField === field) {
      setSubTableSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSubTableSortField(field);
      setSubTableSortOrder('asc');
    }
  };

  const renderSubTableSortIndicator = (field: SubTableSortField) => {
    if (subTableSortField !== field) {
      return <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60 shrink-0" />;
    }
    return subTableSortOrder === 'asc' ? (
      <ArrowUp className="w-3 h-3 text-cyan-600 dark:text-cyan-400 shrink-0 font-bold" />
    ) : (
      <ArrowDown className="w-3 h-3 text-cyan-600 dark:text-cyan-400 shrink-0 font-bold" />
    );
  };

  const toggleExpand = (mac: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setExpandedMacs((prev) => {
      const next = new Set(prev);
      if (next.has(mac)) {
        next.delete(mac);
      } else {
        next.add(mac);
      }
      return next;
    });
  };

  // Unified single-pass memoized static filters (Channels, Dates, Vendors, OUIs)
  const { channelOptions, availableDates, hasUnassignedVendor, unassignedCount, namedVendorsWithCount, availableOuisWithCount } = useMemo(() => {
    let cached = staticFiltersCache.get(sessionAps);
    if (!cached) {
      const map24 = new Map<string, { ch: string; freq: number; count: number }>();
      const map5 = new Map<string, { ch: string; freq: number; count: number }>();
      const map6 = new Map<string, { ch: string; freq: number; count: number }>();
      const dateSet = new Set<string>();
      const vendorMap = new Map<string, number>();
      let unassigned = 0;
      const ouiMap = new Map<string, { count: number; vendor: string }>();

      for (let i = 0; i < sessionAps.length; i++) {
        const ap = sessionAps[i];

        // 1. Channels & Bands
        const chStr = String(ap.channel || '1');
        if (chStr !== '0' && chStr !== '') {
          const chNum = parseInt(chStr, 10);
          if (ap.band === '6 GHz' || (ap.frequency && ap.frequency >= 5925) || chNum > 196) {
            const freq = ap.frequency || (chNum ? 5950 + chNum * 5 : 5955);
            const ex = map6.get(chStr) || { ch: chStr, freq, count: 0 };
            ex.count++;
            map6.set(chStr, ex);
          } else if (
            ap.band === '5 GHz' ||
            (chNum >= 32 && chNum <= 177) ||
            (ap.frequency && ap.frequency >= 4900 && ap.frequency < 5925)
          ) {
            const freq = ap.frequency || (chNum ? 5000 + chNum * 5 : 5180);
            const ex = map5.get(chStr) || { ch: chStr, freq, count: 0 };
            ex.count++;
            map5.set(chStr, ex);
          } else {
            const freq = ap.frequency || (chNum === 14 ? 2484 : 2407 + chNum * 5);
            const ex = map24.get(chStr) || { ch: chStr, freq, count: 0 };
            ex.count++;
            map24.set(chStr, ex);
          }
        }

        // 2. Dates
        const dKey = extractDateKey(ap.firstSeen);
        if (dKey) dateSet.add(dKey);
        for (let j = 0; j < ap.observations.length; j++) {
          const oKey = extractDateKey(ap.observations[j].timestamp);
          if (oKey) dateSet.add(oKey);
        }

        // 3. Vendors
        if (!ap.vendor || ap.vendor === '[Unassigned by IEEE]' || ap.vendor === 'Unknown') {
          unassigned++;
        } else {
          vendorMap.set(ap.vendor, (vendorMap.get(ap.vendor) || 0) + 1);
        }

        // 4. OUIs
        if (ap.oui) {
          const rawVendor = ap.vendor && ap.vendor !== 'Unknown' && ap.vendor !== '[Unassigned by IEEE]' ? ap.vendor : 'Non assigné';
          const exOui = ouiMap.get(ap.oui);
          if (exOui) {
            exOui.count += 1;
            if (exOui.vendor === 'Non assigné' && rawVendor !== 'Non assigné') {
              exOui.vendor = rawVendor;
            }
          } else {
            ouiMap.set(ap.oui, { count: 1, vendor: rawVendor });
          }
        }
      }

      const sortChFn = (a: { ch: string }, b: { ch: string }) => {
        const numA = parseInt(a.ch, 10);
        const numB = parseInt(b.ch, 10);
        if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
        return a.ch < b.ch ? -1 : a.ch > b.ch ? 1 : 0;
      };

      const band24 = Array.from(map24.values()).sort(sortChFn);
      const band5 = Array.from(map5.values()).sort(sortChFn);
      const band6 = Array.from(map6.values()).sort(sortChFn);

      const named = Array.from(vendorMap.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));

      const ouis = Array.from(ouiMap.entries())
        .map(([oui, { count, vendor }]) => ({ oui, count, vendor }))
        .sort((a, b) => (a.oui < b.oui ? -1 : a.oui > b.oui ? 1 : 0));

      cached = {
        channelOptions: {
          band24,
          band5,
          band6,
          total24: band24.reduce((acc, v) => acc + v.count, 0),
          total5: band5.reduce((acc, v) => acc + v.count, 0),
          total6: band6.reduce((acc, v) => acc + v.count, 0),
        },
        availableDates: Array.from(dateSet).sort(),
        vendorData: {
          hasUnassignedVendor: unassigned > 0,
          unassignedCount: unassigned,
          namedVendorsWithCount: named,
        },
        ouiData: ouis,
      };
      staticFiltersCache.set(sessionAps, cached);
    }

    return {
      channelOptions: cached.channelOptions,
      availableDates: cached.availableDates,
      hasUnassignedVendor: cached.vendorData.hasUnassignedVendor,
      unassignedCount: cached.vendorData.unassignedCount,
      namedVendorsWithCount: cached.vendorData.namedVendorsWithCount,
      availableOuisWithCount: cached.ouiData.map((o) => ({
        ...o,
        vendor: o.vendor === 'Non assigné' && language !== 'fr' ? 'Unassigned' : o.vendor,
      })),
    };
  }, [sessionAps, language]);

  // Dynamic cipher algorithms for the selected security type (except WEP)
  const selectedSecType = filters.securityFilter.length === 1 ? filters.securityFilter[0] : null;
  const isEligibleForCipherFilter = Boolean(
    selectedSecType && selectedSecType !== 'ALL' && selectedSecType !== 'WEP'
  );

  const availableAlgorithmsForSelectedSec = useMemo(() => {
    if (!isEligibleForCipherFilter || !selectedSecType) return [];
    const countMap = new Map<string, number>();

    sessionAps
      .filter((ap) => ap.security.type === selectedSecType)
      .forEach((ap) => {
        const algos = new Set<string>();
        const rawAuth = (ap.authMode || '').toUpperCase();
        const isWpa3Enterprise192 =
          rawAuth.includes('SUITE-B') ||
          rawAuth.includes('EAP/SHA384') ||
          rawAuth.includes('EAP-SHA384') ||
          rawAuth.includes('SHA384') ||
          ap.security.type === 'WPA3_ENTERPRISE';

        if (rawAuth.includes('TKIP')) algos.add('TKIP');
        if (rawAuth.includes('CCMP-256') || (rawAuth.includes('CCMP') && rawAuth.includes('256'))) algos.add('CCMP-256');
        else if (rawAuth.includes('CCMP') || rawAuth.includes('AES')) algos.add('CCMP');

        if (rawAuth.includes('GCMP-256') || (isWpa3Enterprise192 && rawAuth.includes('GCMP'))) algos.add('GCMP-256');
        else if (rawAuth.includes('GCMP-128') || (rawAuth.includes('GCMP') && !rawAuth.includes('256') && !isWpa3Enterprise192)) algos.add('GCMP-128');

        if (rawAuth.includes('AES') && !rawAuth.includes('CCMP') && !rawAuth.includes('GCMP')) algos.add('AES');
        if (rawAuth.includes('OWE')) algos.add('OWE');
        if (rawAuth.includes('SAE')) algos.add('SAE');

        if (ap.security.ciphers && ap.security.ciphers.length > 0) {
          ap.security.ciphers.forEach((c) => {
            const upper = c.toUpperCase();
            if (upper.includes('TKIP')) algos.add('TKIP');

            if (upper.includes('CCMP-256') || upper.includes('256')) {
              algos.add('CCMP-256');
            } else if (upper.includes('CCMP') || upper.includes('AES')) {
              algos.add('CCMP');
            }

            if (upper.includes('GCMP-256') || upper.includes('256') || (isWpa3Enterprise192 && upper.includes('GCMP'))) {
              algos.add('GCMP-256');
            } else if (upper.includes('GCMP-128') || (upper.includes('GCMP') && !upper.includes('256') && !isWpa3Enterprise192)) {
              algos.add('GCMP-128');
            }
          });
        }

        if (algos.size === 0 && ap.security.cipherLabel) {
          const upperLabel = ap.security.cipherLabel.toUpperCase();
          if (upperLabel.includes('GCMP') && (upperLabel.includes('256') || isWpa3Enterprise192)) algos.add('GCMP-256');
          else if (upperLabel.includes('GCMP')) algos.add('GCMP-128');
          else if (upperLabel.includes('CCMP') && upperLabel.includes('256')) algos.add('CCMP-256');
          else if (upperLabel.includes('CCMP') || upperLabel.includes('AES')) algos.add('CCMP');
          else algos.add(ap.security.cipherLabel);
        }

        algos.forEach((algo) => {
          countMap.set(algo, (countMap.get(algo) || 0) + 1);
        });
      });

    return Array.from(countMap.entries())
      .map(([algo, count]) => ({ algo, count }))
      .sort((a, b) => b.count - a.count);
  }, [sessionAps, selectedSecType, isEligibleForCipherFilter]);

  // Filter Access Points: Search strictly restricted to SSID, BSSID/MAC, OUI
  const filteredAps = useMemo(() => {
    return accessPoints.filter((ap) => {
      // 1. Search Query (STRICTLY by SSID, BSSID/MAC, or OUI prefix)
      if (filters.searchQuery) {
        const q = filters.searchQuery.toLowerCase().trim();
        const matchSsid = ap.ssid.toLowerCase().includes(q);
        const matchMac = ap.mac.toLowerCase().includes(q);
        const matchOui = ap.oui.toLowerCase().includes(q);
        if (!matchSsid && !matchMac && !matchOui) return false;
      }

      // 2. Direct Encryption / Security Filter
      if (filters.securityFilter.length > 0 && !filters.securityFilter.includes('ALL')) {
        if (!filters.securityFilter.includes(ap.security.type)) return false;
      }

      // 2b. Dynamic Cipher Algorithm Filter (when active security filter is not WEP and cipher filter toggle is enabled)
      if (
        filters.isCipherFilterActive &&
        filters.cipherAlgorithmFilter &&
        filters.cipherAlgorithmFilter !== 'ALL' &&
        isEligibleForCipherFilter
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

      // 3. WiFi Channel / Band (Unified Filter)
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

      // 4. WPS Filter (Show / Hide WPS Enabled Networks)
      if (filters.wpsFilter === 'WPS_ONLY') {
        const hasWps = ap.hasWps || (ap.authMode || '').toUpperCase().includes('WPS');
        if (!hasWps) return false;
      } else if (filters.wpsFilter === 'NO_WPS') {
        const hasWps = ap.hasWps || (ap.authMode || '').toUpperCase().includes('WPS');
        if (hasWps) return false;
      }

      // 5. Date / Day Filter
      if (filters.dateFilter && filters.dateFilter !== 'ALL') {
        const apDateKey = extractDateKey(ap.firstSeen);
        const hasDateInObs = apDateKey === filters.dateFilter || ap.observations.some((obs) =>
          extractDateKey(obs.timestamp) === filters.dateFilter
        );
        if (!hasDateInObs) return false;
      }

      // 6. Geographic Location Filter (from map search / point selection)
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

      // 7. RSSI Range
      if (ap.bestRssi < filters.minRssi || ap.bestRssi > filters.maxRssi) return false;

      // 8. Hardware Vendor Filter
      if (filters.vendorFilter && filters.vendorFilter !== 'ALL') {
        if (filters.vendorFilter === '[Unassigned by IEEE]') {
          if (ap.vendor && ap.vendor !== '[Unassigned by IEEE]' && ap.vendor !== 'Unknown') return false;
        } else if (ap.vendor !== filters.vendorFilter) {
          return false;
        }
      }

      // 9. OUI Prefix Filter
      if (filters.ouiFilter && filters.ouiFilter !== 'ALL') {
        if (ap.oui !== filters.ouiFilter) return false;
      }

      // 10. Modified Networks Only Filter (O(1) pre-computed flag)
      if (filters.onlyModifiedNetworks) {
        if (!(ap.isModified ?? (ap.hasSsidChanged || ap.hasSecurityChanged))) return false;
      }

      return true;
    });
  }, [accessPoints, filters]);

  // Sort Access Points (Optimized with cached Collator and fast string comparisons)
  const sortedAps = useMemo(() => {
    return [...filteredAps].sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'ssid': {
          const sA = a.ssid || '';
          const sB = b.ssid || '';
          if (!sA && !sB) comparison = 0;
          else if (!sA) comparison = 1;
          else if (!sB) comparison = -1;
          else comparison = ssidCollator.compare(sA, sB);
          break;
        }
        case 'mac':
          comparison = a.mac < b.mac ? -1 : a.mac > b.mac ? 1 : 0;
          break;
        case 'vendor':
          comparison = a.vendor < b.vendor ? -1 : a.vendor > b.vendor ? 1 : 0;
          break;
        case 'authMode':
          comparison = a.authMode < b.authMode ? -1 : a.authMode > b.authMode ? 1 : 0;
          break;
        case 'bestRssi':
          // Arrow UP ('asc') -> Best signal first (-30 dBm before -100 dBm)
          // Arrow DOWN ('desc') -> Weakest signal first (-100 dBm before -30 dBm)
          comparison = b.bestRssi - a.bestRssi;
          break;
        case 'channel': {
          const chA = typeof a.channel === 'number' ? a.channel : parseInt(String(a.channel), 10) || 0;
          const chB = typeof b.channel === 'number' ? b.channel : parseInt(String(b.channel), 10) || 0;
          comparison = chA - chB;
          break;
        }
        case 'band':
          comparison = a.band < b.band ? -1 : a.band > b.band ? 1 : 0;
          break;
        case 'frequency':
          comparison = (a.frequency || 0) - (b.frequency || 0);
          break;
        case 'firstSeen':
          comparison = parseTimestampToMs(a.firstSeen) - parseTimestampToMs(b.firstSeen);
          break;
        case 'observationCount':
          comparison = a.observationCount - b.observationCount;
          break;
        default:
          comparison = 0;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [filteredAps, sortField, sortOrder]);

  // Pagination
  const totalItems = sortedAps.length;
  const totalPages = Math.ceil(totalItems / rowsPerPage) || 1;
  const paginatedAps = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return sortedAps.slice(start, start + rowsPerPage);
  }, [sortedAps, currentPage, rowsPerPage]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
    setCurrentPage(1);
  };

  // WiGLE for Android 7-tier RSSI colors:
  // > -50 dBm (Vert pur), -50 to -59 (Vert clair), -60 to -69 (Vert-Jaune), -70 to -79 (Jaune), -80 to -89 (Orange), -90 to -99 (Rouge-Orange), <= -100 (Rouge pur)
  const getRssiBadge = (rssi: number) => {
    const tier = getWigleSignalTier(rssi);
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold border tracking-tight font-sans ${tier.badgeClasses}`}>
        {rssi}{language === 'fr' ? '\u00A0dBm' : ' dBm'}
      </span>
    );
  };

  const renderSecurityBadge = (sec: SecurityCategory, rawAuth: string) => {
    const rawTitle = (rawAuth && rawAuth.trim() !== '') ? rawAuth : (sec.label ? `[${sec.label}]` : '[]');
    if (sec.type === 'OPEN' || !sec.isSecure) {
      return (
        <span
          title={rawTitle}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-semibold bg-rose-50 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border border-rose-400 dark:border-rose-600 shadow-xs whitespace-nowrap cursor-default"
        >
          <Unlock className="w-3.5 h-3.5 stroke-[2] text-rose-600 dark:text-rose-400 shrink-0" />
          <span title={rawTitle}>OPEN</span>
        </span>
      );
    }
    if (sec.type === 'WPA3') {
      return (
        <span
          title={rawTitle}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 border border-purple-300 dark:border-purple-700 shadow-xs whitespace-nowrap cursor-default"
        >
          <Lock className="w-3.5 h-3.5 stroke-[2.5] text-purple-600 dark:text-purple-400 shrink-0" />
          <span title={rawTitle}>WPA3</span>
        </span>
      );
    }
    if (sec.type === 'WPA3_ENTERPRISE') {
      return (
        <span
          title={rawTitle}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-700 shadow-xs whitespace-nowrap cursor-default"
        >
          <Lock className="w-3.5 h-3.5 stroke-[2.5] text-indigo-600 dark:text-indigo-400 shrink-0" />
          <span title={rawTitle}>WPA3 Enterprise</span>
        </span>
      );
    }
    if (sec.type === 'WPA2_WPA3') {
      return (
        <span
          title={rawTitle}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-fuchsia-100 dark:bg-fuchsia-950 text-fuchsia-800 dark:text-fuchsia-300 border border-fuchsia-300 dark:border-fuchsia-700 shadow-xs whitespace-nowrap cursor-default"
        >
          <Lock className="w-3.5 h-3.5 stroke-[2.5] text-fuchsia-600 dark:text-fuchsia-400 shrink-0" />
          <span title={rawTitle}>WPA2/WPA3</span>
        </span>
      );
    }
    if (sec.type === 'ENTERPRISE') {
      return (
        <span
          title={rawTitle}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-cyan-100 dark:bg-cyan-950 text-cyan-800 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-700 shadow-xs whitespace-nowrap cursor-default"
        >
          <Lock className="w-3.5 h-3.5 stroke-[2.5] text-cyan-600 dark:text-cyan-400 shrink-0" />
          <span title={rawTitle}>WPA2 Enterprise</span>
        </span>
      );
    }
    if (sec.type === 'WPA1_ENTERPRISE') {
      return (
        <span
          title={rawTitle}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-sky-100 dark:bg-sky-950 text-sky-800 dark:text-sky-300 border border-sky-300 dark:border-sky-700 shadow-xs whitespace-nowrap cursor-default"
        >
          <Lock className="w-3.5 h-3.5 stroke-[2.5] text-sky-600 dark:text-sky-400 shrink-0" />
          <span>WPA1 Enterprise</span>
        </span>
      );
    }
    if (sec.type === 'WPA_WPA2') {
      return (
        <span
          title={rawTitle}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-sky-100 dark:bg-sky-950 text-sky-800 dark:text-sky-300 border border-sky-300 dark:border-sky-700 shadow-xs whitespace-nowrap cursor-default"
        >
          <Lock className="w-3.5 h-3.5 stroke-[2.5] text-sky-600 dark:text-sky-400 shrink-0" />
          <span>WPA1/WPA2</span>
        </span>
      );
    }
    if (sec.type === 'WEP') {
      return (
        <span
          title={rawTitle}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border border-rose-400 dark:border-rose-600 shadow-xs whitespace-nowrap cursor-default"
        >
          <Lock className="w-3.5 h-3.5 stroke-[2.5] text-rose-600 dark:text-rose-400 shrink-0" />
          <span title={rawTitle}>WEP</span>
        </span>
      );
    }
    if (sec.type === 'WPA') {
      return (
        <span
          title={rawTitle}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-yellow-100 dark:bg-yellow-950 text-yellow-800 dark:text-yellow-300 border border-yellow-300 dark:border-yellow-700 shadow-xs whitespace-nowrap cursor-default"
        >
          <Lock className="w-3.5 h-3.5 stroke-[2.5] text-yellow-600 dark:text-yellow-400 shrink-0" />
          <span title={rawTitle}>WPA1 (PSK)</span>
        </span>
      );
    }
    return (
      <span
        title={rawTitle}
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 border border-blue-300 dark:border-blue-700 shadow-xs whitespace-nowrap cursor-default"
      >
        <Lock className="w-3.5 h-3.5 stroke-[2.5] text-blue-600 dark:text-blue-400 shrink-0" />
        <span title={rawTitle}>WPA2 (PSK)</span>
      </span>
    );
  };

  const getSecurityBadge = (ap: ProcessedAccessPoint) => {
    const rawStr = ap.authMode || (ap.observations && ap.observations.length > 0 ? ap.observations[0].authMode : '') || '';
    return renderSecurityBadge(ap.security, rawStr);
  };

  const getBandBadge = (band: string) => {
    if (band === '6 GHz') {
      return (
        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-300 border border-teal-300 dark:border-teal-700">
          6 GHz
        </span>
      );
    }
    if (band === '5 GHz') {
      return (
        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 border border-purple-300 dark:border-purple-700">
          5 GHz
        </span>
      );
    }
    return (
      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 border border-blue-300 dark:border-blue-700">
        2.4 GHz
      </span>
    );
  };

  const hasActiveFilters =
    filters.searchQuery !== '' ||
    filters.securityFilter.length > 0 ||
    filters.channelFilter !== 'ALL' ||
    filters.dateFilter !== 'ALL' ||
    filters.wpsFilter !== 'ALL' ||
    filters.minRssi !== -100 ||
    filters.vendorFilter !== 'ALL' ||
    filters.ouiFilter !== 'ALL' ||
    filters.locationFilter !== null ||
    Boolean(filters.onlyModifiedNetworks);

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm dark:shadow-xl p-4 sm:p-6 space-y-4 transition-colors">
      {/* Search Bar & Quick Toggles */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search Bar Strictly for SSID, BSSID/MAC, OUI with Search Button */}
        <div className="flex items-center gap-2 flex-1">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchInputValue}
              onChange={(e) => {
                setSearchInputValue(e.target.value);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleExecuteSearch();
                }
              }}
              placeholder={
                language === 'fr'
                  ? 'Effectuer une recherche par SSID, BSSID / MAC, ou préfixe OUI...'
                  : 'Search by SSID, BSSID / MAC, or OUI prefix...'
              }
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl pl-10 pr-10 py-2.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-cyan-500 font-sans transition-colors"
            />
            {searchInputValue && (
              <button
                type="button"
                onClick={() => {
                  setSearchInputValue('');
                  handleExecuteSearch('');
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                title={language === 'fr' ? 'Réinitialiser la recherche' : 'Clear search'}
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Search Button */}
          <button
            type="button"
            onClick={() => handleExecuteSearch()}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 active:bg-cyan-700 text-white font-semibold text-xs transition-colors shadow-sm cursor-pointer shrink-0"
            title={language === 'fr' ? 'Lancer la recherche' : 'Execute search'}
          >
            <Search className="w-3.5 h-3.5" />
            <span>{language === 'fr' ? 'Rechercher' : 'Search'}</span>
          </button>
        </div>

        {/* Filter Toggle Button */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
              showAdvancedFilters
                ? 'bg-cyan-50 dark:bg-cyan-950/60 border-cyan-400 dark:border-cyan-700 text-cyan-800 dark:text-cyan-300'
                : 'bg-slate-50 dark:bg-slate-950 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-400'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>{language === 'fr' ? 'Filtres' : 'Filters'}</span>
            {hasActiveFilters && (
              <span className="w-2 h-2 rounded-full bg-cyan-500"></span>
            )}
          </button>
        </div>
      </div>

      {/* Active Geographic Location Filter Indicator */}
      {filters.locationFilter && (
        <div className="bg-cyan-50 dark:bg-cyan-950/50 border border-cyan-300 dark:border-cyan-800 rounded-xl p-2.5 flex items-center justify-between text-xs text-cyan-900 dark:text-cyan-200">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-cyan-600 dark:text-cyan-400 shrink-0" />
            <span>
              {language === 'fr' ? 'Filtré sur le point GPS\u00A0:' : 'Filtered to Map Location:'}{' '}
              <strong>{filters.locationFilter.key}</strong>
            </span>
          </div>
          <button
            onClick={() => onUpdateFilters((prev) => ({ ...prev, locationFilter: null }))}
            className="flex items-center gap-1 text-[11px] font-bold text-cyan-700 dark:text-cyan-300 hover:underline px-2 py-1 rounded bg-cyan-200/50 dark:bg-cyan-900/50 cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            {language === 'fr' ? 'Afficher tous les emplacements' : 'Show All Locations'}
          </button>
        </div>
      )}

      {/* Primary Filters Panel (Open by default) */}
      {showAdvancedFilters && (
        <div className="bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-4 animate-fadeIn">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1.15fr_1fr] gap-3.5">
            {/* 1. Direct Encryption Filter */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1">
                <Lock className="w-3.5 h-3.5 text-indigo-500" />
                <span>{language === 'fr' ? 'Sécurité / Chiffrement' : 'Security / Encryption'}</span>
              </label>
              <select
                value={filters.securityFilter.length === 1 ? filters.securityFilter[0] : 'ALL'}
                onChange={(e) => {
                  const val = e.target.value;
                  onUpdateFilters((prev) => ({
                    ...prev,
                    securityFilter: val === 'ALL' ? [] : [val],
                  }));
                  setCurrentPage(1);
                }}
                className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:border-cyan-500 font-medium"
              >
                <option value="ALL">
                  {isWigleDevice
                    ? language === 'fr'
                      ? 'Tous les protocoles de sécurité'
                      : 'All Security Protocols'
                    : language === 'fr'
                    ? 'Tous les protocoles de sécurité'
                    : 'All Security Protocols'}
                </option>
                <option value="OPEN">{language === 'fr' ? 'Ouvert (Non chiffré + OWE)' : 'Open (Unencrypted + OWE)'}</option>
                <option value="WEP">WEP</option>
                <option value="WPA">WPA1 (PSK)</option>
                {!isWigleDevice && <option value="WPA_WPA2">{language === 'fr' ? 'WPA1 / WPA2 (Mixte)' : 'WPA1 / WPA2 (Mixed)'}</option>}
                {!isWigleDevice && <option value="WPA1_ENTERPRISE">{language === 'fr' ? 'WPA1 Entreprise' : 'WPA1 Enterprise'}</option>}
                <option value="WPA2">WPA2 (PSK)</option>
                {!isWigleDevice && <option value="WPA2_WPA3">{language === 'fr' ? 'WPA2 / WPA3 (Transition)' : 'WPA2 / WPA3 (Transition)'}</option>}
                {!isWigleDevice && <option value="ENTERPRISE">{language === 'fr' ? 'WPA2 Entreprise' : 'WPA2 Enterprise'}</option>}
                <option value="WPA3">WPA3 (SAE)</option>
                {!isWigleDevice && <option value="WPA3_ENTERPRISE">{language === 'fr' ? 'WPA3 Entreprise' : 'WPA3 Enterprise'}</option>}
              </select>

              {/* Dynamic Cipher Algorithm Filter Toggle & Select (Hidden for WEP or All) */}
              {isEligibleForCipherFilter && availableAlgorithmsForSelectedSec.length > 0 && (
                <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-800 space-y-1.5 animate-fadeIn">
                  <label className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300 font-semibold cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={Boolean(filters.isCipherFilterActive)}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        onUpdateFilters((prev) => ({
                          ...prev,
                          isCipherFilterActive: checked,
                          cipherAlgorithmFilter: checked ? prev.cipherAlgorithmFilter || 'ALL' : 'ALL',
                        }));
                        setCurrentPage(1);
                      }}
                      className="accent-cyan-500 rounded"
                    />
                    <span>{language === 'fr' ? 'Filtrer par algorithme de chiffrement (ex. AES-CCMP)' : 'Filter by cipher algorithm (e.g. AES-CCMP)'}</span>
                  </label>

                  {filters.isCipherFilterActive && (
                    <select
                      value={filters.cipherAlgorithmFilter || 'ALL'}
                      onChange={(e) => {
                        onUpdateFilters((prev) => ({
                          ...prev,
                          cipherAlgorithmFilter: e.target.value,
                        }));
                        setCurrentPage(1);
                      }}
                      className="w-full bg-white dark:bg-slate-900 border border-cyan-400 dark:border-cyan-600 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200 font-medium animate-fadeIn"
                    >
                      <option value="ALL">
                        {language === 'fr' ? 'Tous les algorithmes' : 'All algorithms / ciphers'}
                      </option>
                      {availableAlgorithmsForSelectedSec.map(({ algo, count }) => (
                        <option key={algo} value={algo}>
                          {algo} ({count.toLocaleString()} {language === 'fr' ? (count > 1 ? 'réseaux' : 'réseau') : (count > 1 ? 'APs' : 'AP')})
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}
            </div>

            {/* 2. WiFi Channel & Band Filter (Unified by Band with Frequency in MHz) */}
            <div>
              <label className={`block text-xs font-semibold mb-1.5 flex items-center gap-1 ${isWigleDevice ? 'text-slate-400 dark:text-slate-600' : 'text-slate-700 dark:text-slate-300'}`}>
                <Radio className={`w-3.5 h-3.5 ${isWigleDevice ? 'text-slate-400' : 'text-cyan-500'}`} />
                <span>{language === 'fr' ? 'Canal / Bande WiFi' : 'WiFi Channel / Band'}</span>
              </label>
              <select
                disabled={isWigleDevice}
                value={isWigleDevice ? 'ALL' : filters.channelFilter}
                onChange={(e) => {
                  onUpdateFilters((prev) => ({ ...prev, channelFilter: e.target.value }));
                  setCurrentPage(1);
                }}
                className={`w-full border rounded-lg px-2.5 py-1.5 text-xs font-medium font-sans ${
                  isWigleDevice
                    ? 'opacity-50 cursor-not-allowed bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-800'
                    : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:border-cyan-500'
                }`}
                title={isWigleDevice ? (language === 'fr' ? 'Filtre par canal non disponible pour ce fichier' : 'Channel filter unavailable for this file') : undefined}
              >
                <option value="ALL">
                  {language === 'fr'
                    ? `Tous les canaux / Toutes les bandes (${sessionAps.length.toLocaleString()} ${sessionAps.length > 1 ? 'réseaux' : 'réseau'})`
                    : `All Channels & Bands (${sessionAps.length.toLocaleString()} ${sessionAps.length > 1 ? 'APs' : 'AP'})`}
                </option>

                {/* Quick Band Direct Filters */}
                <optgroup label={language === 'fr' ? '── ⚡ Filtrer par bande complète ──' : '── ⚡ Filter by Full Band ──'}>
                  <option value="BAND_2_4">
                    {language === 'fr'
                      ? `Toute la bande 2,4\u00A0GHz (${channelOptions.total24.toLocaleString()} ${channelOptions.total24 > 1 ? 'réseaux' : 'réseau'})`
                      : `All 2.4 GHz Band (${channelOptions.total24.toLocaleString()} ${channelOptions.total24 > 1 ? 'APs' : 'AP'})`}
                  </option>
                  <option value="BAND_5">
                    {language === 'fr'
                      ? `Toute la bande 5\u00A0GHz (${channelOptions.total5.toLocaleString()} ${channelOptions.total5 > 1 ? 'réseaux' : 'réseau'})`
                      : `All 5 GHz Band (${channelOptions.total5.toLocaleString()} ${channelOptions.total5 > 1 ? 'APs' : 'AP'})`}
                  </option>
                  {channelOptions.total6 > 0 && (
                    <option value="BAND_6">
                      {language === 'fr'
                        ? `Toute la bande 6\u00A0GHz (${channelOptions.total6.toLocaleString()} ${channelOptions.total6 > 1 ? 'réseaux' : 'réseau'})`
                        : `All 6 GHz Band (${channelOptions.total6.toLocaleString()} ${channelOptions.total6 > 1 ? 'APs' : 'AP'})`}
                    </option>
                  )}
                </optgroup>

                {/* 2.4 GHz Channels */}
                {channelOptions.band24.length > 0 && (
                  <optgroup label={language === 'fr' ? '── Canaux 2,4\u00A0GHz (2412 - 2484\u00A0MHz) ──' : '── 2.4 GHz Channels (2412 - 2484 MHz) ──'}>
                    {channelOptions.band24.map((c) => (
                      <option key={`2G_${c.ch}`} value={`2G:${c.ch}`}>
                        {language === 'fr' ? 'Canal' : 'Ch.'} {c.ch} ({c.freq}{language === 'fr' ? '\u00A0MHz' : ' MHz'}) — {c.count.toLocaleString()} {language === 'fr' ? (c.count > 1 ? 'réseaux' : 'réseau') : (c.count > 1 ? 'APs' : 'AP')}
                      </option>
                    ))}
                  </optgroup>
                )}

                {/* 5 GHz Channels */}
                {channelOptions.band5.length > 0 && (
                  <optgroup label={language === 'fr' ? '── Canaux 5\u00A0GHz (5180 - 5885\u00A0MHz) ──' : '── 5 GHz Channels (5180 - 5885 MHz) ──'}>
                    {channelOptions.band5.map((c) => (
                      <option key={`5G_${c.ch}`} value={`5G:${c.ch}`}>
                        {language === 'fr' ? 'Canal' : 'Ch.'} {c.ch} ({c.freq}{language === 'fr' ? '\u00A0MHz' : ' MHz'}) — {c.count.toLocaleString()} {language === 'fr' ? (c.count > 1 ? 'réseaux' : 'réseau') : (c.count > 1 ? 'APs' : 'AP')}
                      </option>
                    ))}
                  </optgroup>
                )}

                {/* 6 GHz Channels */}
                {channelOptions.band6.length > 0 && (
                  <optgroup label={language === 'fr' ? '── Canaux 6\u00A0GHz (5955 - 7115\u00A0MHz / WiFi 6E/7) ──' : '── 6 GHz Channels (5955 - 7115 MHz / WiFi 6E/7) ──'}>
                    {channelOptions.band6.map((c) => (
                      <option key={`6G_${c.ch}`} value={`6G:${c.ch}`}>
                        {language === 'fr' ? 'Canal' : 'Ch.'} {c.ch} ({c.freq}{language === 'fr' ? '\u00A0MHz' : ' MHz'}) — {c.count.toLocaleString()} {language === 'fr' ? (c.count > 1 ? 'réseaux' : 'réseau') : (c.count > 1 ? 'APs' : 'AP')}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>

            {/* 3. WPS Activation Filter (Show/Hide WPS) */}
            <div>
              <label className={`block text-xs font-semibold mb-1.5 flex items-center gap-1 ${isWigleDevice ? 'text-slate-400 dark:text-slate-600' : 'text-slate-700 dark:text-slate-300'}`}>
                <span>{language === 'fr' ? 'Activation WPS' : 'WPS Activation'}</span>
              </label>
              <select
                disabled={isWigleDevice}
                value={isWigleDevice ? 'ALL' : filters.wpsFilter}
                onChange={(e) => {
                  onUpdateFilters((prev) => ({
                    ...prev,
                    wpsFilter: e.target.value as 'ALL' | 'HIDE_BADGES' | 'WPS_ONLY' | 'NO_WPS',
                  }));
                  setCurrentPage(1);
                }}
                className={`w-full border rounded-lg px-2.5 py-1.5 text-xs font-medium font-sans ${
                  isWigleDevice
                    ? 'opacity-50 cursor-not-allowed bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-800'
                    : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:border-cyan-500'
                }`}
                title={isWigleDevice ? (language === 'fr' ? 'Filtre WPS non disponible pour les exports WiGLE' : 'WPS filter unavailable for WiGLE exports') : undefined}
              >
                <option value="ALL">
                  {language === 'fr' ? 'Afficher les réseaux avec et sans WPS (Indicateur actif)' : 'Show networks with and without WPS (Indicator enabled)'}
                </option>
                <option value="HIDE_BADGES">
                  {language === 'fr' ? 'Afficher les réseaux avec et sans WPS (Indicateur désactivé)' : 'Show networks with and without WPS (Indicator disabled)'}
                </option>
                <option value="WPS_ONLY">
                  {language === 'fr' ? 'Afficher uniquement les réseaux avec WPS' : 'Show only networks with WPS'}
                </option>
                <option value="NO_WPS">
                  {language === 'fr' ? 'Afficher uniquement les réseaux sans WPS' : 'Show only networks without WPS'}
                </option>
              </select>
            </div>

            {/* 4. Date / Day Filter (if multiple dates available) */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-teal-500" />
                <span>{language === 'fr' ? 'Filtrer les résultats pour une date spécifique\u00A0:' : 'Filter the results to a specific date:'}</span>
              </label>
              <select
                value={filters.dateFilter}
                onChange={(e) => {
                  onUpdateFilters((prev) => ({ ...prev, dateFilter: e.target.value }));
                  setCurrentPage(1);
                }}
                className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:border-cyan-500 font-medium font-sans"
              >
                <option value="ALL">
                  {language === 'fr'
                    ? `Toutes les dates (${availableDates.length > 0 ? availableDates.length : '1'})`
                    : `All Dates (${availableDates.length > 0 ? availableDates.length : '1'})`}
                </option>
                {availableDates.map((date) => (
                  <option key={date} value={date}>
                    {formatToEuropeanDate(date)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Secondary Filter Row: Vendor, OUI Prefix & Signal Slider */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-2 border-t border-slate-200 dark:border-slate-800/60">
            {/* Vendor Filter */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                {language === 'fr' ? 'Filtrage par fabricant' : 'Filter by manufacturer'}
              </label>
              <select
                value={filters.vendorFilter}
                onChange={(e) => {
                  onUpdateFilters((prev) => ({ ...prev, vendorFilter: e.target.value }));
                  setCurrentPage(1);
                }}
                className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:border-cyan-500 font-sans font-medium"
              >
                <option value="ALL">
                  {language === 'fr'
                    ? `Afficher tous les fabricants (${sessionAps.length.toLocaleString()} ${sessionAps.length > 1 ? 'réseaux' : 'réseau'})`
                    : `Show all manufacturers (${sessionAps.length.toLocaleString()} ${sessionAps.length > 1 ? 'APs' : 'AP'})`}
                </option>
                {hasUnassignedVendor && (
                  <option value="[Unassigned by IEEE]">
                    {language === 'fr' ? "[Non assigné par l'IEEE]" : '[Unassigned by IEEE]'} ({unassignedCount.toLocaleString()} {language === 'fr' ? (unassignedCount > 1 ? 'réseaux' : 'réseau') : (unassignedCount > 1 ? 'APs' : 'AP')})
                  </option>
                )}
                <option disabled className="text-slate-400">
                  ────────────────────────────
                </option>
                <optgroup label={language === 'fr' ? '── Fabricants enregistrés à l\'IEEE ──' : '─ IEEE-registered Manufacturers ──'}>
                  {namedVendorsWithCount.map(({ name, count }) => (
                    <option key={name} value={name}>
                      {name} ({count.toLocaleString()} {language === 'fr' ? (count > 1 ? 'réseaux' : 'réseau') : (count > 1 ? 'APs' : 'AP')})
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>

            {/* OUI Prefix Filter */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                {language === 'fr' ? 'Filtrage par préfixe OUI' : 'Filter by OUI prefix'}
              </label>
              <select
                value={filters.ouiFilter}
                onChange={(e) => {
                  onUpdateFilters((prev) => ({ ...prev, ouiFilter: e.target.value }));
                  setCurrentPage(1);
                }}
                className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:border-cyan-500 font-sans font-medium"
              >
                <option value="ALL">
                  {language === 'fr'
                    ? `Afficher tous les préfixes (${availableOuisWithCount.length.toLocaleString()})`
                    : `Show all prefixes (${availableOuisWithCount.length.toLocaleString()})`}
                </option>
                {availableOuisWithCount.map(({ oui, count, vendor }) => (
                  <option key={oui} value={oui}>
                    {oui} ({vendor}) — {count.toLocaleString()} {language === 'fr' ? (count > 1 ? 'réseaux' : 'réseau') : (count > 1 ? 'APs' : 'AP')}
                  </option>
                ))}
              </select>
            </div>

            {/* Min RSSI Signal Slider & Reset */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {language === 'fr' ? 'Signal RSSI Min.' : 'Min. RSSI Signal'}
                </label>
                <span className="text-xs font-sans text-cyan-600 dark:text-cyan-400 font-bold">
                  {filters.minRssi}{language === 'fr' ? '\u00A0dBm' : ' dBm'}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="relative flex items-center flex-1 h-6 select-none">
                  {/* Continuous Full Track */}
                  <div className="absolute left-0 right-0 h-1.5 bg-slate-300 dark:bg-slate-800 rounded-full pointer-events-none" />

                  {/* Active Cyan Fill Track */}
                  {filters.minRssi > -100 && (
                    <div
                      className="absolute left-0 h-1.5 bg-cyan-500 rounded-full pointer-events-none"
                      style={{
                        width: `calc(8px + ${((filters.minRssi - (-100)) / 70)} * (100% - 16px))`,
                      }}
                    />
                  )}

                  {/* Visible Thumb Handle positioned smoothly on the track */}
                  <div
                    className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-white dark:bg-slate-100 border-2 border-cyan-500 shadow-sm pointer-events-none"
                    style={{
                      left: `calc(8px + ${((filters.minRssi - (-100)) / 70)} * (100% - 16px))`,
                    }}
                  />

                  {/* Accessible Native Range Input */}
                  <input
                    type="range"
                    min="-100"
                    max="-30"
                    step="1"
                    value={filters.minRssi}
                    onChange={(e) => {
                      onUpdateFilters((prev) => ({
                        ...prev,
                        minRssi: parseInt(e.target.value, 10),
                      }));
                      setCurrentPage(1);
                    }}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 m-0 p-0"
                  />
                </div>

                {hasActiveFilters && (
                  <button
                    onClick={onResetFilters}
                    className="flex items-center gap-1 text-xs text-rose-600 dark:text-rose-400 hover:underline font-semibold whitespace-nowrap cursor-pointer shrink-0"
                  >
                    <FilterX className="w-3.5 h-3.5" />
                    {language === 'fr' ? 'Réinitialiser' : 'Reset'}
                  </button>
                )}
              </div>
            </div>

            {/* Modified Networks Only Toggle Filter */}
            <div className="flex items-center gap-2 pt-2 border-t border-slate-200/80 dark:border-slate-800/80 col-span-full">
              <label className="inline-flex items-center gap-2.5 cursor-pointer select-none text-xs font-semibold text-slate-800 dark:text-slate-200 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors">
                <input
                  type="checkbox"
                  checked={Boolean(filters.onlyModifiedNetworks)}
                  onChange={(e) => {
                    onUpdateFilters((prev) => ({
                      ...prev,
                      onlyModifiedNetworks: e.target.checked,
                    }));
                    setCurrentPage(1);
                  }}
                  className="w-4 h-4 text-cyan-600 rounded border-slate-300 dark:border-slate-700 focus:ring-cyan-500 cursor-pointer accent-cyan-600"
                />
                <History className="w-4 h-4 text-amber-500 shrink-0" />
                <span>
                  {language === 'fr'
                    ? 'Afficher uniquement les réseaux modifiés au fil du temps (Nouveau SSID ou changement de chiffrement)'
                    : 'Show only networks modified over time (New SSID or encryption change)'}
                </span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Results Header Info & Pagination Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400 pb-1 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <span>
            {language === 'fr' ? 'Affichage de ' : 'Showing '}
            <strong className="text-cyan-600 dark:text-cyan-400 font-sans font-bold">
              {totalItems > 0 ? (Math.min(totalItems, (currentPage - 1) * rowsPerPage + 1)).toLocaleString() : 0}
            </strong>{' '}
            {language === 'fr' ? 'à ' : 'to '}
            <strong className="text-cyan-600 dark:text-cyan-400 font-sans font-bold">
              {(Math.min(currentPage * rowsPerPage, totalItems)).toLocaleString()}
            </strong>{' '}
            {language === 'fr' ? 'sur ' : 'of '}
            <strong className="text-slate-900 dark:text-white font-sans font-bold">
              {totalItems.toLocaleString()}
            </strong>{' '}
            {language === 'fr' ? 'réseaux' : 'networks'}
          </span>
          {selectedAp && (
            <span className="hidden md:inline px-2 py-0.5 rounded bg-cyan-100 dark:bg-cyan-950 border border-cyan-300 dark:border-cyan-800 text-cyan-800 dark:text-cyan-300 text-[11px]">
              {language === 'fr' ? 'Sélectionné\u00A0:' : 'Selected:'} {selectedAp.ssid || selectedAp.mac}
            </span>
          )}
        </div>

        {/* Rows per page & Pagination Controls */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span>{language === 'fr' ? 'Lignes\u00A0:' : 'Rows:'}</span>
            <select
              value={rowsPerPage}
              onChange={(e) => {
                setRowsPerPage(parseInt(e.target.value, 10));
                setCurrentPage(1);
              }}
              className="bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 text-xs text-slate-800 dark:text-slate-200"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
              <option value={250}>250</option>
              <option value={500}>500</option>
              <option value={1000}>1000</option>
              <option value={2000}>2000</option>
            </select>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2 font-sans font-bold">
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="p-1.5 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Unified Network Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900">
        <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300 border-collapse">
          <thead className="bg-slate-100/90 dark:bg-slate-950/80 backdrop-blur-md text-slate-700 dark:text-slate-300 uppercase font-bold text-[10.5px] border-b border-slate-200 dark:border-slate-800">
            <tr>
              <th className="w-6 px-1 py-2.5 text-center" title={language === 'fr' ? 'Déplier toutes les observations' : 'Expand all scan detections'}>
                <Layers className="w-3.5 h-3.5 mx-auto text-slate-400" />
              </th>
              <th
                onClick={() => handleSort('ssid')}
                className="px-2 py-2.5 cursor-pointer hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors"
              >
                <div className="flex items-center gap-1">
                  <span>{t('table.colSsid')}</span>
                  {renderSortIndicator('ssid')}
                </div>
              </th>
              <th
                onClick={() => handleSort('mac')}
                className="px-1.5 py-2.5 cursor-pointer hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors whitespace-nowrap"
              >
                <div className="flex items-center gap-1">
                  <span>{t('table.colMac')}</span>
                  {renderSortIndicator('mac')}
                </div>
              </th>
              <th
                onClick={() => handleSort('vendor')}
                className="px-1.5 py-2.5 cursor-pointer hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors"
              >
                <div className="flex items-center gap-1">
                  <span>{t('table.colVendor')}</span>
                  {renderSortIndicator('vendor')}
                </div>
              </th>
              <th
                onClick={() => handleSort('authMode')}
                className="px-1.5 py-2.5 cursor-pointer hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors"
              >
                <div className="flex items-center gap-1">
                  <span>{t('table.colSecurity')}</span>
                  {renderSortIndicator('authMode')}
                </div>
              </th>
              {!isWigleDevice && (
                <th
                  onClick={() => handleSort('channel')}
                  className="px-1.5 py-2.5 cursor-pointer hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors whitespace-nowrap text-center"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>{t('table.colChannel')}</span>
                    {renderSortIndicator('channel')}
                  </div>
                </th>
              )}
              <th
                onClick={() => handleSort('bestRssi')}
                className="px-1.5 py-2.5 cursor-pointer hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors whitespace-nowrap text-center"
              >
                <div className="flex items-center justify-center gap-1">
                  <span>{t('table.colSignal')}</span>
                  {renderSortIndicator('bestRssi')}
                </div>
              </th>
              <th
                onClick={() => handleSort('firstSeen')}
                className="px-1.5 py-2.5 cursor-pointer hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors whitespace-nowrap text-center"
              >
                <div className="flex items-center justify-center gap-1">
                  <span>{t('table.colFirstSeen')}</span>
                  {renderSortIndicator('firstSeen')}
                </div>
              </th>
              <th
                onClick={() => handleSort('observationCount')}
                className="px-1.5 py-2.5 cursor-pointer hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors text-center whitespace-nowrap"
              >
                <div className="flex items-center justify-center gap-1">
                  <span>{t('table.colDetections')}</span>
                  {renderSortIndicator('observationCount')}
                </div>
              </th>
              <th className="px-2 py-2.5 text-center whitespace-nowrap">
                {t('table.colActions')}
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 font-medium">
            {paginatedAps.length === 0 ? (
              <tr>
                <td colSpan={isWigleDevice ? 9 : 10} className="px-4 py-12 text-center text-slate-500 dark:text-slate-400">
                  <div className="flex flex-col items-center justify-center space-y-2 max-w-lg mx-auto">
                    {filters.onlyModifiedNetworks ? (
                      <History className="w-8 h-8 text-cyan-600 dark:text-cyan-400 mb-1" />
                    ) : (
                      <Filter className="w-8 h-8 text-slate-400 dark:text-slate-500 mb-1" />
                    )}
                    <p className="text-sm font-bold text-slate-900 dark:text-white">
                      {filters.onlyModifiedNetworks
                        ? (language === 'fr' ? 'Aucun réseau modifié au fil du temps' : 'No networks modified over time')
                        : (language === 'fr' ? 'Aucun réseau ne correspond à vos critères' : 'No networks match your criteria')}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                      {filters.onlyModifiedNetworks
                        ? (language === 'fr'
                            ? 'Aucun changement de SSID ni de protocole de chiffrement n\'a été détecté entre les différentes captures.'
                            : 'No SSID or encryption changes were detected across the different scan captures.')
                        : (language === 'fr'
                            ? 'Aucun réseau ne correspond à votre recherche ou à vos filtres actifs.'
                            : 'No networks match your active search query or filters.')}
                    </p>
                    {filters.onlyModifiedNetworks && (
                      <div className="pt-2">
                        <button
                          type="button"
                          onClick={() => onUpdateFilters((prev) => ({ ...prev, onlyModifiedNetworks: false }))}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-cyan-50 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300 hover:bg-cyan-100 dark:hover:bg-cyan-900/60 border border-cyan-200 dark:border-cyan-800 transition-colors cursor-pointer"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>
                            {language === 'fr'
                              ? 'Désactiver le filtre des réseaux modifiés'
                              : 'Disable modified networks filter'}
                          </span>
                        </button>
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              paginatedAps.map((ap) => {
                const isSelected = selectedAp?.mac === ap.mac;
                const isExpanded = expandedMacs.has(ap.mac);
                const hasMultipleDetections = ap.observationCount > 1;
                const hasWps =
                  ap.hasWps || (ap.authMode || '').toUpperCase().includes('WPS');
                const showWpsBadge = filters.wpsFilter !== 'HIDE_BADGES';
                // WiGLE clean simplified capability string
                const cleanCaps = (ap.authMode || '').replace(/(\[\w+)\-.*?\]/g, '$1]');
                const isModifiedAp = ap.isModified ?? (ap.hasSsidChanged !== undefined ? Boolean(ap.hasSsidChanged || ap.hasSecurityChanged) : (hasMultipleDetections ? Boolean(analyzeNetworkHistory(ap).hasSsidChanged || analyzeNetworkHistory(ap).hasSecurityChanged) : false));
                const history = isModifiedAp ? analyzeNetworkHistory(ap) : null;

                return (
                  <React.Fragment key={ap.mac}>
                    <tr
                      onClick={() => {
                        if (hasMultipleDetections) {
                          toggleExpand(ap.mac);
                        }
                      }}
                      className={`hover:bg-slate-50 dark:hover:bg-slate-800/60 ${
                        hasMultipleDetections ? 'cursor-pointer' : ''
                      } transition-colors ${
                        isSelected
                          ? 'bg-cyan-50/80 dark:bg-cyan-950/40 border-l-4 border-l-cyan-500'
                          : ''
                      } ${isExpanded ? 'bg-slate-50/50 dark:bg-slate-900/80' : ''}`}
                    >
                      {/* Accordion Expand Toggle Button (Arrow hidden if single detection) */}
                      <td
                        className="w-6 px-1 py-2 text-center"
                        onClick={(e) => {
                          if (hasMultipleDetections) {
                            toggleExpand(ap.mac, e);
                          }
                        }}
                      >
                        {hasMultipleDetections ? (
                          <button
                            type="button"
                            className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-cyan-600 dark:text-cyan-400 font-bold transition-colors"
                            title={
                              isExpanded
                                ? (language === 'fr' ? "Replier l'historique des détections" : 'Collapse scan history')
                                : (language === 'fr' ? `Déplier les ${ap.observationCount} détections` : `Expand all ${ap.observationCount} detections`)
                            }
                          >
                            {isExpanded ? (
                              <ChevronUp className="w-3.5 h-3.5" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5" />
                            )}
                          </button>
                        ) : (
                          <span className="w-3.5 h-3.5 inline-block" />
                        )}
                      </td>

                      {/* SSID with change history indicator */}
                      <td className="px-2 py-2">
                        <div className="flex items-center gap-1.5">
                          <Radio className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400 shrink-0" />
                          {ap.ssid ? (
                            <TruncatedSsid ssid={ap.ssid} />
                          ) : (
                            <span className="text-slate-400 italic text-[11px]">
                              &lt;{language === 'fr' ? 'SSID Masqué' : 'Hidden SSID'}&gt;
                            </span>
                          )}
                          {history && history.hasSsidChanged && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setHistoryModalAp(ap);
                                setHistoryModalType('SSID');
                              }}
                              title={
                                language === 'fr'
                                  ? `Changement de SSID détecté (${history.ssidTimeline.length} noms constatés) ! Cliquez pour voir l'historique.`
                                  : `SSID change detected (${history.ssidTimeline.length} names recorded)! Click to view history.`
                              }
                              className="p-1 rounded bg-amber-100 hover:bg-amber-200 dark:bg-amber-950/80 dark:hover:bg-amber-900 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700/80 transition-all cursor-pointer shrink-0 shadow-2xs"
                            >
                              <History className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </td>

                      {/* BSSID / MAC (clean single line font-sans matching Channel) */}
                      <td className="px-1.5 py-2 font-sans font-bold text-xs tracking-tight text-slate-800 dark:text-slate-200 whitespace-nowrap">
                        {ap.mac}
                      </td>

                      {/* Vendor */}
                      <td className="px-1.5 py-2">
                        <span
                          className={`truncate block max-w-[110px] lg:max-w-[150px] ${
                            ap.vendor === '[Unassigned by IEEE]'
                              ? 'text-slate-400 dark:text-slate-500 italic'
                              : 'text-slate-800 dark:text-slate-200'
                          }`}
                          title={ap.vendor}
                        >
                          {ap.vendor === '[Unassigned by IEEE]' ? t('table.unassigned') : ap.vendor}
                        </span>
                      </td>

                      {/* Security & WPS with change history indicator */}
                      <td className="px-1.5 py-2">
                        <div
                          className="flex flex-col gap-0.5 items-start cursor-default"
                          title={ap.authMode || (ap.observations && ap.observations.length > 0 ? ap.observations[0].authMode : '') || ap.security.label || '[]'}
                        >
                          <div
                            className="flex items-center gap-1"
                            title={ap.authMode || (ap.observations && ap.observations.length > 0 ? ap.observations[0].authMode : '') || ap.security.label || '[]'}
                          >
                            {getSecurityBadge(ap)}
                            {history && history.hasSecurityChanged && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setHistoryModalAp(ap);
                                  setHistoryModalType('SECURITY');
                                }}
                                title={
                                  language === 'fr'
                                    ? `Changement de chiffrement détecté (${history.securityTimeline.length} modes) ! Cliquez pour voir l'historique.`
                                    : `Encryption change detected (${history.securityTimeline.length} modes)! Click to view history.`
                                }
                                className="p-1 rounded bg-purple-100 hover:bg-purple-200 dark:bg-purple-950/80 dark:hover:bg-purple-900 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-700/80 transition-all cursor-pointer shrink-0 shadow-2xs"
                              >
                                <History className="w-3 h-3" />
                              </button>
                            )}
                            {hasWps && showWpsBadge && (!ap.isWigleOnly || ap.hasCompleteDetails) && (
                              <span
                                className="inline-flex items-center px-1 py-0.2 rounded text-[9px] font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700/60 shadow-2xs"
                                title={`WPS (Wi-Fi Protected Setup) • ${ap.authMode || ''}`}
                              >
                                WPS
                              </span>
                            )}
                          </div>
                          {(() => {
                            const rawMode = (ap.authMode || '').toUpperCase();
                            const isOweTrans =
                              rawMode.includes('OWE-TRANS') ||
                              rawMode.includes('OWE_TRANS') ||
                              rawMode.includes('OWE-TRANSITION') ||
                              rawMode.includes('OWE_TRANSITION') ||
                              (rawMode.includes('OWE') && (rawMode.includes('TRANSITION') || rawMode.includes('TRANS'))) ||
                              ap.security.label.includes('OWE Transition');
                            const isOwe = rawMode.includes('OWE') || ap.security.label.includes('OWE');

                            if (isOweTrans) {
                              return (
                                <span
                                  className="text-[11px] font-semibold text-purple-800 dark:text-purple-200 bg-purple-100/80 dark:bg-purple-950/90 px-2 py-0.5 rounded-md border border-purple-300 dark:border-purple-700 shadow-2xs whitespace-nowrap inline-block"
                                  title={ap.authMode || '[]'}
                                >
                                  OWE Transition (WPA3 Enhanced Open)
                                </span>
                              );
                            }

                            if (isOwe) {
                              return (
                                <span
                                  className="text-[11px] font-semibold text-purple-800 dark:text-purple-200 bg-purple-100/80 dark:bg-purple-950/90 px-2 py-0.5 rounded-md border border-purple-300 dark:border-purple-700 shadow-2xs whitespace-nowrap inline-block"
                                  title={ap.authMode || '[]'}
                                >
                                  OWE (WPA3 Enhanced Open)
                                </span>
                              );
                            }

                            if (ap.security.type === 'OPEN') {
                              return null; // [ESS] is not a cipher: do not show anything as cipher for open networks
                            }

                            if (!isWigleDevice && ap.security.cipherLabel) {
                              if (ap.isWigleOnly && !ap.hasCompleteDetails) {
                                return null;
                              }
                              return (
                                <span
                                  className="text-[9px] font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800/80 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700/60 whitespace-nowrap inline-block"
                                  title={ap.authMode || '[]'}
                                >
                                  {ap.security.cipherLabel}
                                </span>
                              );
                            }

                            return null;
                          })()}
                        </div>
                      </td>

                      {/* Channel & Band */}
                      {!isWigleDevice && (
                        <td className="px-1.5 py-2 whitespace-nowrap text-center">
                          {ap.isWigleOnly || !ap.channel || ap.channel === '0' || ap.channel === '' ? (
                            <span className="text-slate-400 dark:text-slate-500 font-sans font-medium text-xs">—</span>
                          ) : (
                            <div className="flex flex-col items-center justify-center gap-1">
                              <span className="text-slate-800 dark:text-slate-200 font-bold font-sans text-xs leading-tight">
                                {language === 'fr' ? 'Canal' : 'Ch.'} {ap.channel}
                              </span>
                              <div className="leading-tight">{getBandBadge(ap.band)}</div>
                            </div>
                          )}
                        </td>
                      )}

                      {/* Best RSSI */}
                      <td className="px-1.5 py-2 whitespace-nowrap text-center">
                        {getRssiBadge(ap.bestRssi)}
                      </td>

                      {/* First Seen */}
                      <td className="px-1.5 py-2 text-slate-600 dark:text-slate-300 text-[11px] whitespace-nowrap font-sans font-medium text-center">
                        {formatToEuropeanDate(ap.firstSeen)}
                      </td>

                      {/* Detections / Observations Count with Expand Trigger */}
                      <td
                        className="px-1.5 py-2 text-center whitespace-nowrap select-none"
                        onClick={(e) => {
                          if (hasMultipleDetections) {
                            toggleExpand(ap.mac, e);
                          }
                        }}
                      >
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            isModifiedAp
                              ? 'bg-orange-100 dark:bg-orange-950/80 text-orange-800 dark:text-orange-200 border border-orange-400 dark:border-orange-600 shadow-2xs'
                              : hasMultipleDetections
                              ? 'bg-cyan-100 dark:bg-cyan-900/60 text-cyan-800 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-700/60'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                          }`}
                          title={
                            isModifiedAp
                              ? language === 'fr'
                                ? `Changement de SSID ou de chiffrement détecté (${ap.observationCount} ${ap.observationCount > 1 ? 'détections' : 'détection'})`
                                : `SSID or encryption change detected (${ap.observationCount} ${ap.observationCount > 1 ? 'detections' : 'detection'} recorded)`
                              : hasMultipleDetections
                              ? (language === 'fr' ? `${ap.observationCount} détections enregistrées` : `${ap.observationCount} detections recorded`)
                              : (language === 'fr' ? '1 seule détection enregistrée' : 'Single detection recorded')
                          }
                        >
                          <Layers className={`w-3 h-3 ${isModifiedAp ? 'text-orange-600 dark:text-orange-400 stroke-[2.5]' : ''}`} />
                          <span>{ap.observationCount}x</span>
                        </span>
                      </td>

                      {/* Actions (Prominent & immediately visible without horizontal scrolling) */}
                      <td
                        className="px-1.5 py-2 text-center whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (selectedAp?.mac === ap.mac) {
                                onSelectAp(null as any);
                              } else {
                                onSelectAp(ap);
                                const mapEl = document.getElementById('wigle-map-section');
                                if (mapEl) {
                                  mapEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                } else {
                                  window.scrollTo({ top: 400, behavior: 'smooth' });
                                }
                              }
                            }}
                            title={language === 'fr' ? 'Centrer sur la carte' : 'Center on Map'}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-cyan-600 hover:bg-cyan-700 text-white dark:bg-cyan-500 dark:text-slate-950 dark:hover:bg-cyan-400 transition-all font-bold text-[11px] shadow-xs cursor-pointer"
                          >
                            <MapPin className="w-3 h-3 shrink-0" />
                            <span>{t('table.btnMap')}</span>
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onInspectAp(ap);
                            }}
                            title={language === 'fr' ? 'Inspecter les détails du réseau' : 'Inspect Network Details'}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white dark:bg-indigo-500 dark:text-white dark:hover:bg-indigo-400 transition-all font-bold text-[11px] shadow-xs cursor-pointer"
                          >
                            <Info className="w-3 h-3 shrink-0" />
                            <span>{t('table.btnDetails')}</span>
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* Expandable Sub-panel: All Scans / Observations for this Access Point */}
                    {isExpanded && (
                      <tr className="bg-slate-50/80 dark:bg-slate-950/80 border-t border-b border-cyan-500/20">
                        <td colSpan={isWigleDevice ? 9 : 10} className="p-3 sm:p-4">
                          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-3 shadow-inner space-y-2">
                            <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 pb-1.5 border-b border-slate-200 dark:border-slate-800">
                              <span className="flex items-center gap-1.5 text-cyan-600 dark:text-cyan-400">
                                <Clock className="w-3.5 h-3.5" />
                                {language === 'fr'
                                  ? `Toutes les détections (${ap.observationCount} détections enregistrées)`
                                  : `All detections (${ap.observationCount} detections recorded)`}
                              </span>
                            </div>

                            <div className="max-h-[350px] overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-800 custom-scrollbar">
                              <table className="w-full text-left text-xs">
                                <thead className="bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10 select-none">
                                  <tr>
                                    <th
                                      onClick={() => handleSubTableSort('index')}
                                      className="px-3 py-2 cursor-pointer hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors"
                                    >
                                      <div className="flex items-center gap-1">
                                        <span>#</span>
                                        {renderSubTableSortIndicator('index')}
                                      </div>
                                    </th>
                                    <th
                                      onClick={() => handleSubTableSort('timestamp')}
                                      className="px-3 py-2 cursor-pointer hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors"
                                    >
                                      <div className="flex items-center gap-1">
                                        <span>{language === 'fr' ? 'Horodatage' : 'Observation Timestamp'}</span>
                                        {renderSubTableSortIndicator('timestamp')}
                                      </div>
                                    </th>
                                    <th
                                      onClick={() => handleSubTableSort('rssi')}
                                      className="px-3 py-2 cursor-pointer hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors"
                                    >
                                      <div className="flex items-center gap-1">
                                        <span>{language === 'fr' ? 'Signal (RSSI)' : 'Signal (RSSI)'}</span>
                                        {renderSubTableSortIndicator('rssi')}
                                      </div>
                                    </th>
                                    <th
                                      onClick={() => handleSubTableSort('ssid')}
                                      className="px-3 py-2 cursor-pointer hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors"
                                    >
                                      <div className="flex items-center gap-1">
                                        <span>{language === 'fr' ? 'SSID & Chiffrement' : 'SSID & Encryption'}</span>
                                        {renderSubTableSortIndicator('ssid')}
                                      </div>
                                    </th>
                                    {!isWigleDevice && (
                                      <th
                                        onClick={() => handleSubTableSort('channel')}
                                        className="px-3 py-2 cursor-pointer hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors"
                                      >
                                        <div className="flex items-center gap-1">
                                          <span>{language === 'fr' ? 'Canal / Fréquence' : 'Channel / Frequency'}</span>
                                          {renderSubTableSortIndicator('channel')}
                                        </div>
                                      </th>
                                    )}
                                    <th
                                      onClick={() => handleSubTableSort('lat')}
                                      className="px-3 py-2 cursor-pointer hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors"
                                    >
                                      <div className="flex items-center gap-1">
                                        <span>{language === 'fr' ? 'Latitude' : 'Latitude'}</span>
                                        {renderSubTableSortIndicator('lat')}
                                      </div>
                                    </th>
                                    <th
                                      onClick={() => handleSubTableSort('lon')}
                                      className="px-3 py-2 cursor-pointer hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors"
                                    >
                                      <div className="flex items-center gap-1">
                                        <span>{language === 'fr' ? 'Longitude' : 'Longitude'}</span>
                                        {renderSubTableSortIndicator('lon')}
                                      </div>
                                    </th>
                                    <th
                                      onClick={() => handleSubTableSort('alt')}
                                      className="px-3 py-2 cursor-pointer hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors"
                                    >
                                      <div className="flex items-center gap-1">
                                        <span>{language === 'fr' ? 'Altitude' : 'Altitude'}</span>
                                        {renderSubTableSortIndicator('alt')}
                                      </div>
                                    </th>
                                    <th
                                      onClick={() => handleSubTableSort('source')}
                                      className="px-3 py-2 cursor-pointer hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors"
                                    >
                                      <div className="flex items-center gap-1">
                                        <span>{language === 'fr' ? 'Fichier source' : 'Source File'}</span>
                                        {renderSubTableSortIndicator('source')}
                                      </div>
                                    </th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-sans font-medium text-[11px]">
                                  {(() => {
                                    const indexedObs = ap.observations.map((obs, origIdx) => ({ obs, origIdx }));
                                    const sorted = [...indexedObs].sort((a, b) => {
                                      let valA: any;
                                      let valB: any;
                                      switch (subTableSortField) {
                                        case 'index':
                                          valA = a.origIdx;
                                          valB = b.origIdx;
                                          break;
                                        case 'timestamp':
                                          valA = parseTimestampToMs(a.obs.timestamp);
                                          valB = parseTimestampToMs(b.obs.timestamp);
                                          break;
                                        case 'rssi':
                                          // Arrow UP ('asc') -> Best signal first (-30 dBm before -100 dBm)
                                          // Arrow DOWN ('desc') -> Weakest signal first (-100 dBm before -30 dBm)
                                          valA = -a.obs.rssi;
                                          valB = -b.obs.rssi;
                                          break;
                                        case 'ssid':
                                          valA = (a.obs.ssid || ap.ssid || '').toLowerCase();
                                          valB = (b.obs.ssid || ap.ssid || '').toLowerCase();
                                          break;
                                        case 'channel':
                                          valA = a.obs.channel || ap.channel || 0;
                                          valB = b.obs.channel || ap.channel || 0;
                                          break;
                                        case 'lat':
                                          valA = a.obs.latitude || 0;
                                          valB = b.obs.latitude || 0;
                                          break;
                                        case 'lon':
                                          valA = a.obs.longitude || 0;
                                          valB = b.obs.longitude || 0;
                                          break;
                                        case 'alt':
                                          valA = a.obs.altitude || 0;
                                          valB = b.obs.altitude || 0;
                                          break;
                                        case 'source':
                                          valA = (a.obs.sourceFile || '').toLowerCase();
                                          valB = (b.obs.sourceFile || '').toLowerCase();
                                          break;
                                        default:
                                          valA = a.origIdx;
                                          valB = b.origIdx;
                                      }
                                      if (valA < valB) return subTableSortOrder === 'asc' ? -1 : 1;
                                      if (valA > valB) return subTableSortOrder === 'asc' ? 1 : -1;
                                      return 0;
                                    });

                                    return sorted.map(({ obs, origIdx }) => {
                                      const obsSsid = obs.ssid !== undefined && obs.ssid !== null ? obs.ssid : ap.ssid;
                                      const obsAuth = obs.authMode !== undefined && obs.authMode !== null ? obs.authMode : ap.authMode;
                                      const obsSec = classifySecurity(obsAuth);

                                      return (
                                        <tr
                                          key={`${ap.mac}-obs-${origIdx}`}
                                          className="hover:bg-slate-50 dark:hover:bg-slate-800/40"
                                        >
                                          <td className="px-3 py-2 font-bold text-slate-400">
                                            #{origIdx + 1}
                                          </td>
                                          <td className="px-3 py-2 text-slate-800 dark:text-slate-200 whitespace-nowrap">
                                            {formatToEuropeanDate(obs.timestamp)}
                                          </td>
                                          <td className="px-3 py-2 font-bold whitespace-nowrap">
                                            {getRssiBadge(obs.rssi)}
                                          </td>
                                          {/* SSID and Encryption right below it */}
                                          <td className="px-3 py-2 min-w-[130px]">
                                            <div
                                              className="font-semibold text-slate-900 dark:text-slate-100 truncate max-w-[170px]"
                                              title={obsSsid || (language === 'fr' ? '<SSID Masqué>' : '<Hidden SSID>')}
                                            >
                                              {obsSsid ? (
                                                obsSsid
                                              ) : (
                                                <i className="text-slate-400 font-normal">
                                                  &lt;{language === 'fr' ? 'SSID Masqué' : 'Hidden SSID'}&gt;
                                                </i>
                                              )}
                                            </div>
                                            <div className="flex flex-col gap-0.5 items-start mt-1 cursor-default" title={obsAuth || '[]'}>
                                              <div className="flex items-center gap-1 flex-wrap">
                                                {renderSecurityBadge(obsSec, obsAuth)}
                                                {showWpsBadge && obsAuth && obsAuth.toUpperCase().includes('WPS') && (
                                                  <span
                                                    className="inline-flex items-center px-1 py-0.2 rounded text-[9px] font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700/60 shadow-2xs"
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
                                          </td>
                                          {!isWigleDevice && (
                                            <td className="px-3 py-2 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                                              {obs.isFromWigleFile || !obs.channel || obs.channel === '0' || obs.channel === '' ? (
                                                <span className="text-slate-400 dark:text-slate-500 font-sans font-medium text-xs">—</span>
                                              ) : (
                                                <>
                                                  {language === 'fr' ? 'Canal' : 'Ch.'} {obs.channel || ap.channel}{' '}
                                                  {obs.frequency ? `(${obs.frequency}${language === 'fr' ? '\u00A0MHz' : ' MHz'})` : ''}
                                                </>
                                              )}
                                            </td>
                                          )}
                                          <td className="px-3 py-2 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                                            {obs.latitude !== 0 ? obs.latitude.toFixed(6) : 'None'}
                                          </td>
                                          <td className="px-3 py-2 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                                            {obs.longitude !== 0 ? obs.longitude.toFixed(6) : 'None'}
                                          </td>
                                          <td className="px-3 py-2 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                                            {obs.altitude !== undefined
                                              ? `${obs.altitude.toFixed(1)} m`
                                              : '-'}
                                          </td>
                                          <td
                                            className="px-3 py-2 text-slate-500 truncate max-w-[120px]"
                                            title={obs.sourceFile || 'Import'}
                                          >
                                            {obs.sourceFile || 'Import'}
                                          </td>
                                        </tr>
                                      );
                                    });
                                  })()}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Bottom Pagination Controls (Without Rows dropdown as requested) */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400 px-1 py-1">
        <div>
          <span>
            {language === 'fr' ? 'Affichage de ' : 'Showing '}
            <strong className="text-cyan-600 dark:text-cyan-400 font-sans font-bold">
              {totalItems > 0 ? (Math.min(totalItems, (currentPage - 1) * rowsPerPage + 1)).toLocaleString() : 0}
            </strong>{' '}
            {language === 'fr' ? 'à ' : 'to '}
            <strong className="text-cyan-600 dark:text-cyan-400 font-sans font-bold">
              {(Math.min(currentPage * rowsPerPage, totalItems)).toLocaleString()}
            </strong>{' '}
            {language === 'fr' ? 'sur ' : 'of '}
            <strong className="text-slate-900 dark:text-white font-sans font-bold">{totalItems.toLocaleString()}</strong>{' '}
            {language === 'fr' ? 'réseaux' : 'networks'}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage <= 1}
            className="p-1.5 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
            title={language === 'fr' ? 'Page précédente' : 'Previous page'}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="px-2 font-sans font-bold text-slate-800 dark:text-slate-200">
            {currentPage} / {totalPages || 1}
          </span>
          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage >= totalPages}
            className="p-1.5 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
            title={language === 'fr' ? 'Page suivante' : 'Next page'}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Network Evolution & Change History Modal */}
      <NetworkHistoryModal
        isOpen={!!historyModalAp}
        onClose={() => setHistoryModalAp(null)}
        ap={historyModalAp}
        initialType={historyModalType}
      />

      {/* Search in Progress Screen / Modal Overlay (Mounted directly to document.body via Portal) */}
      {isSearching && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 max-w-md w-full shadow-2xl flex flex-col items-center text-center space-y-4 animate-scaleUp">
            <div className="p-4 rounded-2xl bg-cyan-50 dark:bg-cyan-950/60 border border-cyan-200 dark:border-cyan-800 text-cyan-600 dark:text-cyan-400">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white">
                {language === 'fr'
                  ? 'Recherche en cours. Veuillez patienter...'
                  : 'Search in progress. Please wait...'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {language === 'fr'
                  ? 'Le temps de chargement varie selon le nombre de lignes dans le fichier.'
                  : 'The loading time varies depending on the number of entries in the file.'}
              </p>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
