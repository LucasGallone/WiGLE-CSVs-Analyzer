import { ProcessedAccessPoint } from '../types/wigle';
import { classifySecurity } from './csvParser';

/**
 * Universally parses any timestamp string (ISO YYYY-MM-DD, US MM/DD/YYYY, EU DD/MM/YYYY, or Epoch ms)
 * into a reliable numeric millisecond value for accurate chronological comparisons.
 */
export function parseTimestampToMs(timestamp: string | number | undefined | null): number {
  if (!timestamp) return 0;
  if (typeof timestamp === 'number') {
    return timestamp > 1e11 ? timestamp : timestamp * 1000;
  }
  const str = String(timestamp).trim();
  if (!str) return 0;

  // Numeric epoch in seconds or milliseconds
  if (/^\d{10,13}$/.test(str)) {
    const num = parseInt(str, 10);
    return str.length === 10 ? num * 1000 : num;
  }

  // ISO format: YYYY-MM-DD or YYYY/MM/DD (e.g. 2026-09-18 15:08:26)
  const isoMatch = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[T\s](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const month = parseInt(isoMatch[2], 10) - 1;
    const day = parseInt(isoMatch[3], 10);
    const hour = isoMatch[4] ? parseInt(isoMatch[4], 10) : 0;
    const min = isoMatch[5] ? parseInt(isoMatch[5], 10) : 0;
    const sec = isoMatch[6] ? parseInt(isoMatch[6], 10) : 0;
    return new Date(year, month, day, hour, min, sec).getTime();
  }

  // Slash or dash date format: MM/DD/YYYY (US) or DD/MM/YYYY (EU)
  const slashMatch = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})(?:[T\s](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  if (slashMatch) {
    const p1 = parseInt(slashMatch[1], 10);
    const p2 = parseInt(slashMatch[2], 10);
    const year = parseInt(slashMatch[3], 10);
    const hour = slashMatch[4] ? parseInt(slashMatch[4], 10) : 0;
    const min = slashMatch[5] ? parseInt(slashMatch[5], 10) : 0;
    const sec = slashMatch[6] ? parseInt(slashMatch[6], 10) : 0;

    let month = p1 - 1;
    let day = p2;
    if (p1 > 12) {
      // Must be DD/MM/YYYY
      day = p1;
      month = p2 - 1;
    }
    return new Date(year, month, day, hour, min, sec).getTime();
  }

  const parsed = Date.parse(str);
  return isNaN(parsed) ? 0 : parsed;
}

export interface SsidChangeItem {
  ssid: string;
  firstSeen: string;
  lastSeen: string;
  count: number;
}

export interface SecurityChangeItem {
  securityLabel: string;
  cipherLabel?: string;
  hasWps?: boolean;
  authMode: string;
  securityType: string;
  color: string;
  firstSeen: string;
  lastSeen: string;
  count: number;
}

export interface NetworkHistoryAnalysis {
  hasSsidChanged: boolean;
  ssidTimeline: SsidChangeItem[];
  hasSecurityChanged: boolean;
  securityTimeline: SecurityChangeItem[];
}

/**
 * Analyzes the scan history of an Access Point by comparing the oldest capture (first seen)
 * to the most recent capture (latest seen) to detect if any SSID or Security/Encryption change occurred.
 * Note: WiFi channels are intentionally excluded as channels change dynamically.
 */
export function analyzeNetworkHistory(ap: ProcessedAccessPoint): NetworkHistoryAnalysis {
  if (!ap || !ap.observations || ap.observations.length <= 1) {
    return {
      hasSsidChanged: false,
      ssidTimeline: [],
      hasSecurityChanged: false,
      securityTimeline: [],
    };
  }

  // Sort observations strictly chronologically by parsed timestamp (ascending: oldest first, newest last)
  const sorted = [...ap.observations].sort((a, b) => {
    const tA = parseTimestampToMs(a.timestamp);
    const tB = parseTimestampToMs(b.timestamp);
    if (tA !== tB) return tA - tB;
    return (a.timestamp || '').localeCompare(b.timestamp || '');
  });

  const oldestObs = sorted[0];
  const newestObs = sorted[sorted.length - 1];

  // 1. Sequential SSID timeline with state transition tracking (handles Aller-Retour A -> B -> A)
  const ssidTimeline: SsidChangeItem[] = [];
  let currentSsidItem: SsidChangeItem | null = null;

  for (const obs of sorted) {
    const rawSsid = (obs.ssid !== undefined && obs.ssid !== null ? obs.ssid : (ap.ssid || '')).trim();
    if (!currentSsidItem || currentSsidItem.ssid !== rawSsid) {
      currentSsidItem = {
        ssid: rawSsid,
        firstSeen: obs.timestamp || ap.firstSeen || '',
        lastSeen: obs.timestamp || ap.lastSeen || '',
        count: 1,
      };
      ssidTimeline.push(currentSsidItem);
    } else {
      currentSsidItem.count += 1;
      if (obs.timestamp) {
        const obsMs = parseTimestampToMs(obs.timestamp);
        if (!currentSsidItem.firstSeen || (obsMs > 0 && parseTimestampToMs(currentSsidItem.firstSeen) > 0 ? obsMs < parseTimestampToMs(currentSsidItem.firstSeen) : obs.timestamp < currentSsidItem.firstSeen)) {
          currentSsidItem.firstSeen = obs.timestamp;
        }
        if (!currentSsidItem.lastSeen || (obsMs > 0 && parseTimestampToMs(currentSsidItem.lastSeen) > 0 ? obsMs > parseTimestampToMs(currentSsidItem.lastSeen) : obs.timestamp > currentSsidItem.lastSeen)) {
          currentSsidItem.lastSeen = obs.timestamp;
        }
      }
    }
  }

  if (ssidTimeline.length === 0 && ap.ssid) {
    ssidTimeline.push({
      ssid: ap.ssid,
      firstSeen: ap.firstSeen,
      lastSeen: ap.lastSeen,
      count: ap.observationCount,
    });
  }

  const hasSsidChanged = ssidTimeline.length > 1;

  // 2. Sequential Security / Encryption timeline with state transition tracking (handles Aller-Retour)
  // Also handles WiGLE Web exports without authentication distinction (avoids false security changes)
  const securityTimeline: SecurityChangeItem[] = [];
  let currentSecItem: (SecurityChangeItem & { rawKey: string }) | null = null;

  for (const obs of sorted) {
    const rawAuth = (obs.authMode !== undefined && obs.authMode !== null ? obs.authMode : (ap.authMode || '')).trim();
    const sec = classifySecurity(rawAuth);
    const hasWps = rawAuth.toUpperCase().includes('WPS');
    const rawKey = `${sec.type}_${sec.label}_${sec.cipherLabel || ''}_${hasWps}`;

    // Normalize comparison: if an observation comes from a WiGLE Web export that lacks auth distinction
    // (e.g. [WPA2] vs [WPA2-PSK-CCMP]), do not treat as a true security change if both share the base security protocol
    const isWigleGeneric = obs.isFromWigleFile && (rawAuth === '[WPA2]' || rawAuth === '[WPA]' || rawAuth === 'WPA2' || rawAuth === 'WPA');
    const matchesPreviousBase = currentSecItem && isWigleGeneric && (
      (rawAuth.includes('WPA2') && currentSecItem.securityType.startsWith('WPA2')) ||
      (rawAuth.includes('WPA') && !rawAuth.includes('WPA2') && currentSecItem.securityType.startsWith('WPA'))
    );

    if (matchesPreviousBase && currentSecItem) {
      currentSecItem.count += 1;
      if (obs.timestamp) {
        const obsMs = parseTimestampToMs(obs.timestamp);
        if (!currentSecItem.firstSeen || (obsMs > 0 && parseTimestampToMs(currentSecItem.firstSeen) > 0 ? obsMs < parseTimestampToMs(currentSecItem.firstSeen) : obs.timestamp < currentSecItem.firstSeen)) {
          currentSecItem.firstSeen = obs.timestamp;
        }
        if (!currentSecItem.lastSeen || (obsMs > 0 && parseTimestampToMs(currentSecItem.lastSeen) > 0 ? obsMs > parseTimestampToMs(currentSecItem.lastSeen) : obs.timestamp > currentSecItem.lastSeen)) {
          currentSecItem.lastSeen = obs.timestamp;
        }
      }
    } else if (!currentSecItem || currentSecItem.rawKey !== rawKey) {
      currentSecItem = {
        rawKey,
        securityLabel: sec.label,
        cipherLabel: sec.cipherLabel,
        hasWps,
        authMode: rawAuth,
        securityType: sec.type,
        color: sec.color,
        firstSeen: obs.timestamp || ap.firstSeen || '',
        lastSeen: obs.timestamp || ap.lastSeen || '',
        count: 1,
      };
      securityTimeline.push(currentSecItem);
    } else {
      currentSecItem.count += 1;
      if (obs.timestamp) {
        const obsMs = parseTimestampToMs(obs.timestamp);
        if (!currentSecItem.firstSeen || (obsMs > 0 && parseTimestampToMs(currentSecItem.firstSeen) > 0 ? obsMs < parseTimestampToMs(currentSecItem.firstSeen) : obs.timestamp < currentSecItem.firstSeen)) {
          currentSecItem.firstSeen = obs.timestamp;
        }
        if (!currentSecItem.lastSeen || (obsMs > 0 && parseTimestampToMs(currentSecItem.lastSeen) > 0 ? obsMs > parseTimestampToMs(currentSecItem.lastSeen) : obs.timestamp > currentSecItem.lastSeen)) {
          currentSecItem.lastSeen = obs.timestamp;
        }
      }
    }
  }

  const hasSecurityChanged = securityTimeline.length > 1;

  return {
    hasSsidChanged,
    ssidTimeline,
    hasSecurityChanged,
    securityTimeline,
  };
}

/**
 * Extracts a normalized YYYY-MM-DD date key from any timestamp string/number.
 */
export function extractDateKey(timestamp?: string | number | null): string {
  if (!timestamp) return '';
  const ms = parseTimestampToMs(timestamp);
  if (ms <= 0) return '';
  const d = new Date(ms);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Returns the best (strongest / maximum) RSSI recorded for an AP on a specific date (YYYY-MM-DD).
 * If no observation matches or dateKey is 'ALL'/empty, returns ap.bestRssi.
 */
export function getDayBestRssi(ap: ProcessedAccessPoint, dateKey?: string | null): number {
  if (!dateKey || dateKey === 'ALL') {
    return ap.bestRssi;
  }

  let dayBest = -Infinity;

  if (ap.observations && ap.observations.length > 0) {
    for (let i = 0; i < ap.observations.length; i++) {
      const obs = ap.observations[i];
      if (extractDateKey(obs.timestamp) === dateKey) {
        if (typeof obs.rssi === 'number' && !isNaN(obs.rssi) && obs.rssi > dayBest) {
          dayBest = obs.rssi;
        }
      }
    }
  }

  if (dayBest === -Infinity) {
    const firstDate = extractDateKey(ap.firstSeen);
    const lastDate = extractDateKey(ap.lastSeen);
    if (firstDate === dateKey || lastDate === dateKey) {
      return ap.bestRssi;
    }
    return ap.bestRssi;
  }

  return dayBest;
}

/**
 * Analyzes whether an Access Point has been observed across more than one distinct WiFi channel.
 * Returns the boolean status and formatted channel list.
 */
export function getApObservedChannelsInfo(ap: ProcessedAccessPoint): {
  hasMultipleChannels: boolean;
  channelsList: string;
} {
  if (!ap) {
    return { hasMultipleChannels: false, channelsList: '' };
  }

  if (ap.hasMultipleChannels && ap.observedChannels && ap.observedChannels.length > 1) {
    return {
      hasMultipleChannels: true,
      channelsList: ap.observedChannels.join(', '),
    };
  }

  // Fallback dynamic calculation if not precomputed or observation count > 1
  if (ap.observationCount <= 1 || !ap.observations || ap.observations.length <= 1) {
    return { hasMultipleChannels: false, channelsList: '' };
  }

  const chSet = new Set<string>();
  for (let i = 0; i < ap.observations.length; i++) {
    const obs = ap.observations[i];
    const ch = (obs.channel !== undefined && obs.channel !== null ? String(obs.channel) : String(ap.channel || '')).trim();
    if (ch && ch !== '0' && ch !== 'Unknown') {
      chSet.add(ch);
    }
  }

  if (chSet.size > 1) {
    const sorted = Array.from(chSet).sort((a, b) => {
      const nA = parseInt(a, 10);
      const nB = parseInt(b, 10);
      if (!isNaN(nA) && !isNaN(nB)) return nA - nB;
      return a.localeCompare(b);
    });
    return {
      hasMultipleChannels: true,
      channelsList: sorted.join(', '),
    };
  }

  return { hasMultipleChannels: false, channelsList: '' };
}

