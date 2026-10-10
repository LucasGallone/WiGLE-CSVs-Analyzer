import { ProcessedAccessPoint, ScanSessionData } from '../types/wigle';
import { resolveBtCategory, resolveBtCompany, getBtAddressType } from './bluetoothUtils';

export interface BtCategoryStat {
  id: string;
  labelEn: string;
  labelFr: string;
  group: string;
  count: number;
  percentage: number;
  percentageFormatted: string;
  color: string;
  iconName: string;
}

export interface BtStatsSummary {
  totalUniqueDevices: number;
  totalObservations: number;
  totalNamedDevices: number;
  totalUnnamedDevices: number;
  totalBleDevices: number;
  totalClassicBtDevices: number;
  totalUniqueVendors: number;
  averageRssi: number;
  bestRssi: number;
  worstRssi: number;
  timeRange: {
    start: string;
    end: string;
    durationMinutes: number;
  };
  categoryBreakdown: BtCategoryStat[];
  protocolBreakdown: {
    protocol: 'BLE' | 'BT';
    labelEn: string;
    labelFr: string;
    count: number;
    percentage: number;
    percentageFormatted: string;
    color: string;
  }[];
  vendorBreakdown: {
    vendor: string;
    count: number;
    percentage: number;
    percentageFormatted: string;
  }[];
  allVendorsBreakdown: {
    vendor: string;
    count: number;
    percentage: number;
    percentageFormatted: string;
  }[];
  addressTypeBreakdown: {
    type: string;
    labelEn: string;
    labelFr: string;
    count: number;
    percentage: number;
    percentageFormatted: string;
    color: string;
  }[];
  rssiBreakdown: {
    range: string;
    label: string;
    count: number;
    percentage: number;
    percentageFormatted: string;
    color: string;
  }[];
  gpsStats: {
    pointsWithGps: number;
    percentageGps: number;
    areaApproxKm2: number;
  };
}

export interface StatsSummary {
  totalUniqueAPs: number;
  totalObservations: number;
  totalUniqueSSIDs: number;
  totalHiddenSSIDs: number;
  totalWithEncryption: number;
  totalWithoutEncryption: number;
  totalUniqueVendors: number;
  totalWpsNetworks: number;
  totalOpenNetworks: number;
  totalWpa3Networks: number;
  totalWpa2Networks: number;
  totalWepNetworks: number;
  totalEnterpriseNetworks: number;
  averageRssi: number;
  bestRssi: number;
  worstRssi: number;
  timeRange: {
    start: string;
    end: string;
    durationMinutes: number;
  };
  securityBreakdown: {
    label: string;
    count: number;
    percentage: number;
    percentageFormatted: string;
    color: string;
    type: string;
    tooltipFr?: string;
    tooltipEn?: string;
    ciphers?: {
      key: string;
      labelFr: string;
      labelEn: string;
      count: number;
      percentageFormattedFr: string;
      percentageFormattedEn: string;
    }[];
  }[];
  openBreakdown: {
    unencryptedCount: number;
    unencryptedPercentage: string;
    oweCount: number;
    owePercentage: string;
    tooltipEn: string;
    tooltipFr: string;
  };
  vendorBreakdown: {
    vendor: string;
    count: number;
    percentage: number;
    percentageFormatted: string;
  }[];
  allVendorsBreakdown: {
    vendor: string;
    count: number;
    percentage: number;
    percentageFormatted: string;
  }[];
  rssiBreakdown: {
    range: string;
    label: string;
    count: number;
    percentage: number;
    percentageFormatted: string;
    color: string;
  }[];
  bandBreakdown: {
    band: string;
    count: number;
    percentage: number;
    percentageFormatted: string;
    color: string;
  }[];
  channelBreakdown: { channel: string; count: number }[];
  gpsStats: {
    pointsWithGps: number;
    percentageGps: number;
    areaApproxKm2: number;
  };
}

/**
 * Distributes percentages across an array of items such that their rounded percentages (2 decimals)
 * sum up to EXACTLY 100.00% whenever total > 0 (using Largest Remainder / Hare-Niemeyer Method).
 */
export function calculatePercentagesWithExactSum<T extends { count: number }>(
  items: T[],
  total?: number
): (T & { percentage: number; percentageFormatted: string })[] {
  if (!items || items.length === 0) {
    return [];
  }

  // Determine effective total count across non-zero items
  const actualItemsTotal = items.reduce((sum, it) => sum + (it.count > 0 ? it.count : 0), 0);
  const effectiveTotal = actualItemsTotal > 0 ? actualItemsTotal : (total && total > 0 ? total : 0);

  if (effectiveTotal <= 0) {
    return items.map((item) => ({
      ...item,
      percentage: 0,
      percentageFormatted: '0%',
    }));
  }

  const nonZeroItems = items.filter((it) => it.count > 0);
  if (nonZeroItems.length === 0) {
    return items.map((item) => ({
      ...item,
      percentage: 0,
      percentageFormatted: '0%',
    }));
  }

  // Multiply by 10000 (basis points for 2 decimal places: 100.00% = 10000 bp)
  const flooredData = items.map((item, index) => {
    if (item.count <= 0) {
      return { index, count: 0, floorVal: 0, remainder: 0 };
    }
    const basisPoints = (item.count * 10000) / effectiveTotal;
    const floorVal = Math.floor(basisPoints);
    const remainder = basisPoints - floorVal;
    return { index, count: item.count, floorVal, remainder };
  });

  const sumFloored = flooredData.reduce((acc, curr) => acc + curr.floorVal, 0);
  let diff = 10000 - sumFloored; // difference in hundredths of a percent (integer >= 0)

  // Sort by remainder descending, then count descending, then index ascending
  const sortedByRemainder = [...flooredData]
    .filter((d) => d.count > 0)
    .sort((a, b) => b.remainder - a.remainder || b.count - a.count || a.index - b.index);

  const allocatedBasisPoints = new Map<number, number>();
  sortedByRemainder.forEach((d) => {
    let add = 0;
    if (diff > 0) {
      add = 1;
      diff--;
    }
    allocatedBasisPoints.set(d.index, d.floorVal + add);
  });

  return items.map((item, idx) => {
    if (item.count <= 0) {
      return {
        ...item,
        percentage: 0,
        percentageFormatted: '0%',
      };
    }
    const bp = allocatedBasisPoints.get(idx) ?? 0;
    const finalPct = bp / 100;
    return {
      ...item,
      percentage: finalPct,
      percentageFormatted: `${finalPct.toFixed(2)}%`,
    };
  });
}

/**
 * Format individual percentages accurately with 2 decimal places (e.g. 2.93%, 100%, 0%)
 */
export function formatPercentage(count: number, total: number): string {
  if (count <= 0 || total <= 0) return '0%';
  const raw = (count / total) * 100;
  if (raw === 100) return '100%';
  return `${raw.toFixed(2)}%`;
}

// Helper to classify advanced cipher implementation per access point
function classifyApAdvancedCipher(ap: ProcessedAccessPoint, secType: string): { key: string; labelFr: string; labelEn: string } {
  const mode = (ap.authMode || '').toUpperCase();

  if (secType === 'OPEN') {
    const isOwe = mode.includes('OWE') || (ap.security?.label || '').includes('OWE');
    if (isOwe) {
      return { key: 'OWE', labelFr: 'OWE (Enhanced Open)', labelEn: 'OWE (Enhanced Open)' };
    }
    return { key: 'NONE', labelFr: 'Aucun (Absence de chiffrement)', labelEn: 'None (Unencrypted)' };
  }

  if (secType === 'WEP' || mode.includes('WEP')) {
    if (mode.includes('WEP40') || mode.includes('WEP-40')) {
      return { key: 'WEP40', labelFr: 'WEP-40 (clé 64 bits)', labelEn: 'WEP-40 (64-bit key)' };
    }
    if (mode.includes('WEP104') || mode.includes('WEP-104') || mode.includes('WEP128')) {
      return { key: 'WEP104', labelFr: 'WEP-104 (clé 128 bits)', labelEn: 'WEP-104 (128-bit key)' };
    }
    return { key: 'WEP', labelFr: 'WEP (standard)', labelEn: 'WEP (standard)' };
  }

  // GCMP ciphers
  const isWpa3Enterprise192 =
    mode.includes('SUITE-B') ||
    mode.includes('SUITE_B') ||
    mode.includes('EAP/SHA384') ||
    mode.includes('EAP-SHA384') ||
    mode.includes('SHA384') ||
    mode.includes('EAP-SUITE-B-192') ||
    secType === 'WPA3_ENTERPRISE';

  const hasGcmp256 = mode.includes('GCMP-256') || (isWpa3Enterprise192 && mode.includes('GCMP'));
  const hasGcmp128 = mode.includes('GCMP-128') || (mode.includes('GCMP') && !hasGcmp256 && !isWpa3Enterprise192);
  if (hasGcmp256 && hasGcmp128) {
    return { key: 'GCMP_DUAL', labelFr: 'GCMP (128 & 256 bits)', labelEn: 'GCMP (128 & 256-bit)' };
  }
  if (hasGcmp256) {
    return { key: 'GCMP_256', labelFr: 'GCMP (256 bits)', labelEn: 'GCMP (256-bit)' };
  }
  if (hasGcmp128) {
    return { key: 'GCMP_128', labelFr: 'GCMP (128 bits)', labelEn: 'GCMP (128-bit)' };
  }

  // CCMP / AES vs TKIP
  const hasCcmp = mode.includes('CCMP') || mode.includes('AES');
  const hasCcmp256 = mode.includes('CCMP-256') || mode.includes('AES-256');
  const hasTkip = mode.includes('TKIP');

  if (hasCcmp && hasTkip) {
    return { key: 'MIXED_CCMP_TKIP', labelFr: 'Mélange AES-CCMP + TKIP', labelEn: 'Mixed AES-CCMP + TKIP' };
  }
  if (hasCcmp) {
    if (hasCcmp256) {
      return { key: 'CCMP_256', labelFr: 'AES-CCMP (256 bits)', labelEn: 'AES-CCMP (256-bit)' };
    }
    return { key: 'CCMP_128', labelFr: 'AES-CCMP (128 bits)', labelEn: 'AES-CCMP (128-bit)' };
  }
  if (hasTkip) {
    return { key: 'TKIP', labelFr: 'TKIP (128 bits)', labelEn: 'TKIP (128-bit)' };
  }

  // Fallback to cipherLabel if present
  if (ap.security?.cipherLabel && ap.security.cipherLabel.trim() !== '') {
    return { key: ap.security.cipherLabel, labelFr: ap.security.cipherLabel, labelEn: ap.security.cipherLabel };
  }

  return { key: 'OTHER', labelFr: 'Chiffrement non spécifié', labelEn: 'Unspecified cipher' };
}

export function calculateStats(session: ScanSessionData | null, filteredAps?: ProcessedAccessPoint[]): StatsSummary | null {
  if (!session || session.accessPoints.length === 0) return null;

  const aps = filteredAps || session.accessPoints;
  if (aps.length === 0) return null;

  const totalUniqueAPs = aps.length;
  const totalObservations = aps.reduce((sum, ap) => sum + ap.observationCount, 0);

  // SSIDs
  const uniqueSsidSet = new Set(aps.map((a) => a.ssid).filter(Boolean));
  const totalUniqueSSIDs = uniqueSsidSet.size;
  const totalHiddenSSIDs = aps.filter((a) => a.isSSIDHidden).length;

  // Security (With vs Without Encryption, WEP is considered encrypted)
  const totalOpenNetworks = aps.filter((a) => a.security.type === 'OPEN').length;
  const totalWithoutEncryption = totalOpenNetworks;
  const totalWithEncryption = totalUniqueAPs - totalWithoutEncryption;

  const totalWepNetworks = aps.filter((a) => a.security.type === 'WEP').length;
  const totalWpa2Networks = aps.filter((a) => a.security.type === 'WPA2').length;
  const totalWpa3Networks = aps.filter((a) => a.security.type === 'WPA3' || a.security.type === 'WPA3_ENTERPRISE').length;
  const totalEnterpriseNetworks = aps.filter((a) => a.security.type === 'ENTERPRISE' || a.security.type === 'WPA3_ENTERPRISE' || a.security.type === 'WPA1_ENTERPRISE').length;

  // WPS networks count
  const totalWpsNetworks = aps.filter((a) => Boolean(a.hasWps || (a.authMode || '').toUpperCase().includes('WPS'))).length;

  // Vendors Count
  const uniqueVendorSet = new Set(aps.map((a) => a.vendor).filter(Boolean));
  const totalUniqueVendors = uniqueVendorSet.size;

  // RSSI
  const rssiValues = aps.map((a) => a.bestRssi).filter((r) => r > -120 && r <= 0);
  const averageRssi = rssiValues.length > 0 ? Math.round(rssiValues.reduce((a, b) => a + b, 0) / rssiValues.length) : -80;
  const bestRssi = rssiValues.length > 0 ? Math.max(...rssiValues) : -50;
  const worstRssi = rssiValues.length > 0 ? Math.min(...rssiValues) : -100;

  // Time Range
  const validDates = aps
    .map((a) => a.firstSeen)
    .filter(Boolean)
    .sort();
  const startDate = validDates.length > 0 ? validDates[0] : '';
  const endDate = validDates.length > 0 ? validDates[validDates.length - 1] : '';

  let durationMinutes = 0;
  if (startDate && endDate) {
    const d1 = new Date(startDate.replace(' ', 'T')).getTime();
    const d2 = new Date(endDate.replace(' ', 'T')).getTime();
    if (!isNaN(d1) && !isNaN(d2) && d2 >= d1) {
      durationMinutes = Math.round((d2 - d1) / (1000 * 60));
    }
  }

  // Security breakdown - All 10 explicit categories distinguished
  const standardSecTypes = ['WPA3', 'WPA3_ENTERPRISE', 'WPA2_WPA3', 'WPA2', 'WPA_WPA2', 'ENTERPRISE', 'WPA1_ENTERPRISE', 'WPA', 'WEP', 'OPEN'];
  const securityCounts: Record<string, { count: number; label: string; color: string; type: string }> = {
    WPA3: { count: 0, label: 'WPA3 (SAE)', color: '#8b5cf6', type: 'WPA3' },
    WPA3_ENTERPRISE: { count: 0, label: 'WPA3 Enterprise', color: '#6366f1', type: 'WPA3_ENTERPRISE' },
    WPA2_WPA3: { count: 0, label: 'WPA2 / WPA3 (Transition)', color: '#a855f7', type: 'WPA2_WPA3' },
    WPA2: { count: 0, label: 'WPA2 (PSK)', color: '#3b82f6', type: 'WPA2' },
    WPA_WPA2: { count: 0, label: 'WPA1 / WPA2 (Mixed)', color: '#38bdf8', type: 'WPA_WPA2' },
    ENTERPRISE: { count: 0, label: 'WPA2 Enterprise', color: '#06b6d4', type: 'ENTERPRISE' },
    WPA1_ENTERPRISE: { count: 0, label: 'WPA1 Enterprise', color: '#0284c7', type: 'WPA1_ENTERPRISE' },
    WPA: { count: 0, label: 'WPA1 (PSK)', color: '#eab308', type: 'WPA' },
    WEP: { count: 0, label: 'WEP', color: '#ef4444', type: 'WEP' },
    OPEN: { count: 0, label: 'Open (Unencrypted + OWE)', color: '#ef4444', type: 'OPEN' },
    UNKNOWN: { count: 0, label: 'Other / Unknown', color: '#94a3b8', type: 'UNKNOWN' },
  };

  let oweCount = 0;
  let unencryptedCount = 0;
  const ciphersPerSecType: Record<string, Map<string, { count: number; labelFr: string; labelEn: string }>> = {};

  aps.forEach((ap) => {
    const secType = ap.security?.type || 'UNKNOWN';
    if (secType === 'OPEN') {
      const isOwe = (ap.authMode || '').toUpperCase().includes('OWE') || (ap.security?.label || '').includes('OWE');
      if (isOwe) oweCount++;
      else unencryptedCount++;
    }

    if (securityCounts[secType]) {
      securityCounts[secType].count++;
    } else {
      securityCounts.UNKNOWN.count++;
    }

    if (!ciphersPerSecType[secType]) {
      ciphersPerSecType[secType] = new Map();
    }
    const secCipherMap = ciphersPerSecType[secType];
    const cipherInfo = classifyApAdvancedCipher(ap, secType);
    const existing = secCipherMap.get(cipherInfo.key);
    if (existing) {
      existing.count++;
    } else {
      secCipherMap.set(cipherInfo.key, { count: 1, labelFr: cipherInfo.labelFr, labelEn: cipherInfo.labelEn });
    }
  });

  const rawSecList = Object.values(securityCounts).filter(
    (s) => standardSecTypes.includes(s.type) || s.count > 0
  );
  const baseSecurityBreakdown = calculatePercentagesWithExactSum(rawSecList, totalUniqueAPs).sort(
    (a, b) => b.count - a.count
  );

  const securityBreakdown = baseSecurityBreakdown.map((item) => {
    // Pour le chiffrement WEP, aucune infobulle ne sera présente
    if (item.type === 'WEP') {
      return {
        ...item,
        tooltipFr: undefined,
        tooltipEn: undefined,
        ciphers: undefined,
      };
    }

    const secCipherMap = ciphersPerSecType[item.type];
    if (!secCipherMap || item.count === 0) {
      return {
        ...item,
        tooltipFr: undefined,
        tooltipEn: undefined,
        ciphers: undefined,
      };
    }

    const cipherEntries = Array.from(secCipherMap.entries()).sort((a, b) => b[1].count - a[1].count);
    const catTotal = item.count;

    // Seul le pourcentage de la catégorie sera affiché
    // exemple : • AES-CCMP (128-bit): 42 375 (98.5%)
    const ciphers = cipherEntries.map(([key, c]) => {
      const catPctNum = (c.count / catTotal) * 100;
      const catPctFr = catPctNum.toFixed(1).replace('.', ',') + '\u00A0%';
      const catPctEn = catPctNum.toFixed(1) + '%';
      return {
        key,
        labelFr: c.labelFr,
        labelEn: c.labelEn,
        count: c.count,
        percentageFormattedFr: catPctFr,
        percentageFormattedEn: catPctEn,
      };
    });

    const secLabelFr =
      item.type === 'ENTERPRISE'
        ? 'WPA2 Entreprise'
        : item.type === 'WPA3_ENTERPRISE'
        ? 'WPA3 Entreprise'
        : item.type === 'WPA1_ENTERPRISE'
        ? 'WPA1 Entreprise'
        : item.type === 'WPA_WPA2'
        ? 'WPA1 / WPA2 (Mixte)'
        : item.type === 'OPEN'
        ? 'Ouvert (Non chiffré + OWE)'
        : item.type === 'UNKNOWN'
        ? 'Autre / Inconnu'
        : item.label;
    const secLabelEn = item.label;

    const linesFr = ciphers.map((c) => `• ${c.labelFr} — ${c.count.toLocaleString()} (${c.percentageFormattedFr})`);
    const linesEn = ciphers.map((c) => `• ${c.labelEn} — ${c.count.toLocaleString()} (${c.percentageFormattedEn})`);

    const headerFr = `Statistiques des chiffrements détectés pour ${secLabelFr}`;
    const headerEn = `Statistics of detected ciphers for ${secLabelEn}`;

    return {
      ...item,
      tooltipFr: `${headerFr}\n${linesFr.join('\n')}`,
      tooltipEn: `${headerEn}\n${linesEn.join('\n')}`,
      ciphers,
    };
  });

  const openItemsExact = calculatePercentagesWithExactSum(
    [
      { key: 'unencrypted', count: unencryptedCount },
      { key: 'owe', count: oweCount },
      { key: 'other', count: Math.max(0, totalUniqueAPs - unencryptedCount - oweCount) },
    ],
    totalUniqueAPs
  );

  const unencryptedPct = openItemsExact.find((i) => i.key === 'unencrypted')?.percentageFormatted || '0%';
  const owePct = openItemsExact.find((i) => i.key === 'owe')?.percentageFormatted || '0%';

  const openBreakdown = {
    unencryptedCount,
    unencryptedPercentage: unencryptedPct,
    oweCount,
    owePercentage: owePct,
    tooltipEn: `Unencrypted: ${unencryptedCount} (${unencryptedPct}) • OWE (incl. Transition): ${oweCount} (${owePct})`,
    tooltipFr: `En clair : ${unencryptedCount} (${unencryptedPct}) • OWE (Transition incluse) : ${oweCount} (${owePct})`,
  };

  // Vendor breakdown (top 10 + other) and complete list
  const vendorMap = new Map<string, number>();
  aps.forEach((ap) => {
    const v = ap.vendor || 'Unknown';
    vendorMap.set(v, (vendorMap.get(v) || 0) + 1);
  });

  const sortedVendors = Array.from(vendorMap.entries()).sort((a, b) => b[1] - a[1]);
  
  const rawAllVendors = sortedVendors.map(([vendor, count]) => ({ vendor, count }));
  const allVendorsBreakdown = calculatePercentagesWithExactSum(rawAllVendors, totalUniqueAPs);

  const rawTopVendors = sortedVendors.slice(0, 11).map(([vendor, count]) => ({ vendor, count }));
  if (sortedVendors.length > 11) {
    const restCount = sortedVendors.slice(11).reduce((acc, curr) => acc + curr[1], 0);
    rawTopVendors.push({
      vendor: 'Other Vendors',
      count: restCount,
    });
  }
  const vendorBreakdown = calculatePercentagesWithExactSum(rawTopVendors, totalUniqueAPs);

  // RSSI Breakdown
  const rssiCat = {
    excellent: { range: '≥ -50 dBm', label: 'Excellent', count: 0, color: '#10b981' },
    strong: { range: '-51 to -60 dBm', label: 'Strong', count: 0, color: '#06b6d4' },
    good: { range: '-61 to -72 dBm', label: 'Good', count: 0, color: '#3b82f6' },
    fair: { range: '-73 to -82 dBm', label: 'Fair', count: 0, color: '#f59e0b' },
    weak: { range: '≤ -83 dBm', label: 'Weak', count: 0, color: '#ef4444' },
  };

  aps.forEach((ap) => {
    const r = ap.bestRssi;
    if (r >= -50) rssiCat.excellent.count++;
    else if (r >= -60) rssiCat.strong.count++;
    else if (r >= -72) rssiCat.good.count++;
    else if (r >= -82) rssiCat.fair.count++;
    else rssiCat.weak.count++;
  });

  const rawRssiList = Object.values(rssiCat);
  const rssiBreakdown = calculatePercentagesWithExactSum(rawRssiList, totalUniqueAPs);

  // Band breakdown (supporting 6 GHz)
  const bandCounts: Record<string, { count: number; color: string }> = {
    '2.4 GHz': { count: 0, color: '#3b82f6' },
    '5 GHz': { count: 0, color: '#a855f7' },
    '6 GHz': { count: 0, color: '#10b981' },
    '60 GHz': { count: 0, color: '#f59e0b' },
    'Unknown': { count: 0, color: '#64748b' },
  };

  aps.forEach((ap) => {
    const b = ap.band || 'Unknown';
    if (bandCounts[b]) bandCounts[b].count++;
    else bandCounts['Unknown'].count++;
  });

  const rawBandList = Object.entries(bandCounts)
    .filter(([_, v]) => v.count > 0)
    .map(([band, data]) => ({
      band,
      count: data.count,
      color: data.color,
    }));
  const bandBreakdown = calculatePercentagesWithExactSum(rawBandList, totalUniqueAPs);

  // Top Channels
  const channelMap = new Map<string, number>();
  aps.forEach((ap) => {
    if (ap.channel && ap.channel !== '0' && ap.channel !== 'Unknown' && ap.channel !== '') {
      const ch = String(ap.channel);
      channelMap.set(ch, (channelMap.get(ch) || 0) + 1);
    }
  });

  const channelBreakdown = Array.from(channelMap.entries())
    .map(([channel, count]) => ({ channel, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // GPS Stats
  const gpsAps = aps.filter((a) => a.latitude !== 0 && a.longitude !== 0);
  const pointsWithGps = gpsAps.length;
  const percentageGps = totalUniqueAPs > 0 ? (pointsWithGps / totalUniqueAPs) * 100 : 0;

  // Approx Area (Bounding box km2) safely computed without spread limits
  let areaApproxKm2 = 0;
  if (gpsAps.length >= 2) {
    let minLat = Infinity;
    let maxLat = -Infinity;
    let minLng = Infinity;
    let maxLng = -Infinity;

    for (let i = 0; i < gpsAps.length; i++) {
      const lat = gpsAps[i].latitude;
      const lng = gpsAps[i].longitude;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
    }

    const latDistKm = (maxLat - minLat) * 111;
    const avgLatRad = ((minLat + maxLat) / 2) * (Math.PI / 180);
    const lngDistKm = (maxLng - minLng) * (111 * Math.cos(avgLatRad));
    areaApproxKm2 = Math.round(latDistKm * lngDistKm * 100) / 100;
  }

  return {
    totalUniqueAPs,
    totalObservations,
    totalUniqueSSIDs,
    totalHiddenSSIDs,
    totalWithEncryption,
    totalWithoutEncryption,
    totalUniqueVendors,
    totalWpsNetworks,
    totalOpenNetworks,
    totalWpa3Networks,
    totalWpa2Networks,
    totalWepNetworks,
    totalEnterpriseNetworks,
    averageRssi,
    bestRssi,
    worstRssi,
    timeRange: {
      start: startDate,
      end: endDate,
      durationMinutes,
    },
    securityBreakdown,
    openBreakdown,
    vendorBreakdown,
    allVendorsBreakdown,
    rssiBreakdown,
    bandBreakdown,
    channelBreakdown,
    gpsStats: {
      pointsWithGps,
      percentageGps,
      areaApproxKm2,
    },
  };
}

/**
 * Calculates comprehensive statistics for Bluetooth (BLE and Classic BT) devices.
 */
export function calculateBtStats(
  session: ScanSessionData | null,
  filteredAps?: ProcessedAccessPoint[]
): BtStatsSummary | null {
  const aps = filteredAps || session?.accessPoints || [];
  if (!aps || aps.length === 0) return null;

  const totalUniqueDevices = aps.length;
  const totalObservations = aps.reduce((sum, ap) => sum + (ap.observationCount || 1), 0);

  let namedCount = 0;
  let unnamedCount = 0;
  let bleCount = 0;
  let classicCount = 0;
  let totalRssi = 0;
  let bestRssi = -Infinity;
  let worstRssi = Infinity;

  let minTimestamp = Infinity;
  let maxTimestamp = -Infinity;

  const vendorMap = new Map<string, number>();
  const categoryMap = new Map<string, { count: number; info: any }>();
  const addressTypeMap = new Map<string, { count: number; labelEn: string; labelFr: string; color: string }>();

  aps.forEach((ap) => {
    // Name check
    if (ap.ssid && ap.ssid.trim().length > 0) {
      namedCount++;
    } else {
      unnamedCount++;
    }

    // Protocol check
    const proto = (ap.btProtocol || (ap.type === 'BT' ? 'BT' : 'BLE')) as 'BLE' | 'BT';
    if (proto === 'BT') classicCount++;
    else bleCount++;

    // RSSI stats
    const r = ap.bestRssi || ap.latestRssi || -80;
    totalRssi += r;
    if (r > bestRssi) bestRssi = r;
    if (r < worstRssi) worstRssi = r;

    // Time range
    if (ap.firstSeen) {
      const t = Date.parse(ap.firstSeen);
      if (!isNaN(t)) {
        if (t < minTimestamp) minTimestamp = t;
        if (t > maxTimestamp) maxTimestamp = t;
      }
    }
    if (ap.lastSeen) {
      const t = Date.parse(ap.lastSeen);
      if (!isNaN(t)) {
        if (t > maxTimestamp) maxTimestamp = t;
      }
    }

    // Vendor / Manufacturer (Combines Bluetooth SIG company or IEEE vendor)
    const displayVendor = ap.btCompany || ap.vendor || 'Unknown Manufacturer';
    vendorMap.set(displayVendor, (vendorMap.get(displayVendor) || 0) + 1);

    // Category
    const catInfo = resolveBtCategory(ap.authMode || ap.btCategory, ap.frequency);
    const catKey = catInfo.nameEn;
    const existingCat = categoryMap.get(catKey);
    if (existingCat) {
      existingCat.count++;
    } else {
      categoryMap.set(catKey, { count: 1, info: catInfo });
    }

    // Address Type (Public vs Random)
    const addr = getBtAddressType(ap.mac);
    const existingAddr = addressTypeMap.get(addr.type);
    const color =
      addr.type === 'PUBLIC'
        ? '#10b981'
        : addr.type === 'RESOLVABLE_PRIVATE'
        ? '#6366f1'
        : addr.type === 'STATIC_RANDOM'
        ? '#f59e0b'
        : '#94a3b8';
    if (existingAddr) {
      existingAddr.count++;
    } else {
      addressTypeMap.set(addr.type, {
        count: 1,
        labelEn: addr.labelEn,
        labelFr: addr.labelFr,
        color,
      });
    }
  });

  const averageRssi = Math.round(totalRssi / totalUniqueDevices);
  if (bestRssi === -Infinity) bestRssi = -80;
  if (worstRssi === Infinity) worstRssi = -80;

  let startDate = '-';
  let endDate = '-';
  let durationMinutes = 0;
  if (minTimestamp !== Infinity && maxTimestamp !== -Infinity) {
    startDate = new Date(minTimestamp).toISOString();
    endDate = new Date(maxTimestamp).toISOString();
    durationMinutes = Math.max(1, Math.round((maxTimestamp - minTimestamp) / (1000 * 60)));
  }

  // Category breakdown
  const rawCatList = Array.from(categoryMap.entries()).map(([_, { count, info }]) => ({
    id: info.id,
    labelEn: info.nameEn,
    labelFr: info.nameFr,
    group: info.group,
    count,
    color: info.color,
    iconName: info.iconName,
  }));
  const categoryBreakdown = calculatePercentagesWithExactSum(rawCatList, totalUniqueDevices)
    .sort((a, b) => b.count - a.count);

  // Protocol breakdown
  const rawProtoList = [
    {
      protocol: 'BLE' as const,
      labelEn: 'Bluetooth Low Energy (BLE)',
      labelFr: 'Bluetooth Low Energy (BLE)',
      count: bleCount,
      color: '#06b6d4',
    },
    {
      protocol: 'BT' as const,
      labelEn: 'Classic Bluetooth (BR/EDR)',
      labelFr: 'Bluetooth Classique (BR/EDR)',
      count: classicCount,
      color: '#3b82f6',
    },
  ].filter((p) => p.count > 0);
  const protocolBreakdown = calculatePercentagesWithExactSum(rawProtoList, totalUniqueDevices);

  // Vendor breakdowns
  const rawVendors = Array.from(vendorMap.entries())
    .map(([vendor, count]) => ({ vendor, count }))
    .sort((a, b) => b.count - a.count);
  const totalUniqueVendors = rawVendors.length;
  const allVendorsBreakdown = calculatePercentagesWithExactSum(rawVendors, totalUniqueDevices);
  
  const rawTopVendors = rawVendors.slice(0, 11);
  if (rawVendors.length > 11) {
    const restCount = rawVendors.slice(11).reduce((acc, curr) => acc + curr.count, 0);
    rawTopVendors.push({
      vendor: 'Other manufacturers',
      count: restCount,
    });
  }
  const vendorBreakdown = calculatePercentagesWithExactSum(rawTopVendors, totalUniqueDevices);

  // Address Type breakdown
  const rawAddrList = Array.from(addressTypeMap.entries()).map(([type, data]) => ({
    type,
    labelEn: data.labelEn,
    labelFr: data.labelFr,
    count: data.count,
    color: data.color,
  }));
  const addressTypeBreakdown = calculatePercentagesWithExactSum(rawAddrList, totalUniqueDevices)
    .sort((a, b) => b.count - a.count);

  // RSSI brackets
  const rssiRanges = [
    { min: -60, max: 0, range: '>-60 dBm', label: 'Excellent Signal', color: '#10b981' },
    { min: -75, max: -61, range: '-61 to -75 dBm', label: 'Good Signal', color: '#06b6d4' },
    { min: -85, max: -76, range: '-76 to -85 dBm', label: 'Average Signal', color: '#f59e0b' },
    { min: -100, max: -86, range: '<-85 dBm', label: 'Weak Signal', color: '#ef4444' },
  ];
  const rawRssiList = rssiRanges.map((r) => {
    const count = aps.filter((ap) => {
      const sig = ap.bestRssi || ap.latestRssi || -80;
      return sig >= r.min && sig <= r.max;
    }).length;
    return {
      range: r.range,
      label: r.label,
      count,
      color: r.color,
    };
  });
  const rssiBreakdown = calculatePercentagesWithExactSum(rawRssiList, totalUniqueDevices);

  // GPS Stats
  const gpsAps = aps.filter((a) => a.latitude !== 0 && a.longitude !== 0);
  const pointsWithGps = gpsAps.length;
  const percentageGps = totalUniqueDevices > 0 ? (pointsWithGps / totalUniqueDevices) * 100 : 0;

  let areaApproxKm2 = 0;
  if (gpsAps.length >= 2) {
    let minLat = Infinity;
    let maxLat = -Infinity;
    let minLng = Infinity;
    let maxLng = -Infinity;

    for (let i = 0; i < gpsAps.length; i++) {
      const lat = gpsAps[i].latitude;
      const lng = gpsAps[i].longitude;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
    }

    const latDistKm = (maxLat - minLat) * 111;
    const avgLatRad = ((minLat + maxLat) / 2) * (Math.PI / 180);
    const lngDistKm = (maxLng - minLng) * (111 * Math.cos(avgLatRad));
    areaApproxKm2 = Math.round(latDistKm * lngDistKm * 100) / 100;
  }

  return {
    totalUniqueDevices,
    totalObservations,
    totalNamedDevices: namedCount,
    totalUnnamedDevices: unnamedCount,
    totalBleDevices: bleCount,
    totalClassicBtDevices: classicCount,
    totalUniqueVendors,
    averageRssi,
    bestRssi,
    worstRssi,
    timeRange: {
      start: startDate,
      end: endDate,
      durationMinutes,
    },
    categoryBreakdown,
    protocolBreakdown,
    vendorBreakdown,
    allVendorsBreakdown,
    addressTypeBreakdown,
    rssiBreakdown,
    gpsStats: {
      pointsWithGps,
      percentageGps,
      areaApproxKm2,
    },
  };
}

/**
 * Universally formats any timestamp (ISO YYYY-MM-DD, US MM/DD/YYYY, EU DD/MM/YYYY) into European format (DD/MM/YYYY HH:mm:ss)
 */
export function formatToEuropeanDate(dateStr?: string | null): string {
  if (!dateStr || typeof dateStr !== 'string') return '-';
  const trimmed = dateStr.trim();
  if (!trimmed) return '-';

  // 1. ISO format: YYYY-MM-DD or YYYY/MM/DD (e.g. 2026-09-18 15:08:26)
  const isoMatch = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[T\s](\d{1,2}:\d{2}(?::\d{2})?))?/);
  if (isoMatch) {
    const [, yyyy, mm, dd, time] = isoMatch;
    const padDd = dd.padStart(2, '0');
    const padMm = mm.padStart(2, '0');
    return time ? `${padDd}/${padMm}/${yyyy} ${time}` : `${padDd}/${padMm}/${yyyy}`;
  }

  // 2. US or EU slash format: MM/DD/YYYY or DD/MM/YYYY (e.g. 09/18/2026 15:08:26)
  const slashMatch = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})(?:[T\s](\d{1,2}:\d{2}(?::\d{2})?))?/);
  if (slashMatch) {
    const [, p1, p2, yyyy, time] = slashMatch;
    const num1 = parseInt(p1, 10);
    const num2 = parseInt(p2, 10);
    let day = num2;
    let month = num1;
    if (num1 > 12) {
      // Already DD/MM/YYYY
      day = num1;
      month = num2;
    }
    const padDay = String(day).padStart(2, '0');
    const padMonth = String(month).padStart(2, '0');
    return time ? `${padDay}/${padMonth}/${yyyy} ${time}` : `${padDay}/${padMonth}/${yyyy}`;
  }

  return dateStr;
}
