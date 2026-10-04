import { ProcessedAccessPoint } from '../types/wigle';
import { classifySecurity } from './csvParser';

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
 * Analyzes the scan history of an Access Point to detect if its SSID or Security/Encryption changed over time.
 * Note: Channel changes are intentionally ignored as WiFi channels can change automatically.
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

  // Sort observations chronologically by timestamp (ascending)
  const sorted = [...ap.observations].sort((a, b) => {
    if (!a.timestamp) return -1;
    if (!b.timestamp) return 1;
    return a.timestamp.localeCompare(b.timestamp);
  });

  // 1. Analyze SSID changes
  const ssidMap = new Map<string, { firstSeen: string; lastSeen: string; count: number }>();

  for (const obs of sorted) {
    const rawSsid = (obs.ssid !== undefined && obs.ssid !== null ? obs.ssid : ap.ssid) || '';
    // Skip empty probe drops if at least one named SSID exists
    if (!rawSsid && ap.ssid) continue;

    const key = rawSsid;
    const existing = ssidMap.get(key);
    if (existing) {
      existing.count += 1;
      if (obs.timestamp && (!existing.lastSeen || obs.timestamp > existing.lastSeen)) {
        existing.lastSeen = obs.timestamp;
      }
      if (obs.timestamp && (!existing.firstSeen || obs.timestamp < existing.firstSeen)) {
        existing.firstSeen = obs.timestamp;
      }
    } else {
      ssidMap.set(key, {
        firstSeen: obs.timestamp || ap.firstSeen || '',
        lastSeen: obs.timestamp || ap.lastSeen || '',
        count: 1,
      });
    }
  }

  // Fallback if all were empty but ap has an SSID
  if (ssidMap.size === 0 && ap.ssid) {
    ssidMap.set(ap.ssid, {
      firstSeen: ap.firstSeen,
      lastSeen: ap.lastSeen,
      count: ap.observationCount,
    });
  }

  const ssidTimeline: SsidChangeItem[] = Array.from(ssidMap.entries())
    .map(([ssid, data]) => ({
      ssid,
      firstSeen: data.firstSeen,
      lastSeen: data.lastSeen,
      count: data.count,
    }))
    .sort((a, b) => (a.firstSeen || '').localeCompare(b.firstSeen || ''));

  const hasSsidChanged = ssidTimeline.length > 1;

  // 2. Analyze Security / Encryption changes
  const secMap = new Map<
    string,
    {
      authMode: string;
      securityType: string;
      cipherLabel?: string;
      hasWps?: boolean;
      color: string;
      firstSeen: string;
      lastSeen: string;
      count: number;
    }
  >();

  for (const obs of sorted) {
    const rawAuth = (obs.authMode !== undefined && obs.authMode !== null ? obs.authMode : ap.authMode) || '';
    const sec = classifySecurity(rawAuth);
    const hasWps = rawAuth.toUpperCase().includes('WPS');
    const key = `${sec.label}_${sec.cipherLabel || ''}_${hasWps}`;
    const existing = secMap.get(key);
    if (existing) {
      existing.count += 1;
      if (obs.timestamp && (!existing.lastSeen || obs.timestamp > existing.lastSeen)) {
        existing.lastSeen = obs.timestamp;
      }
      if (obs.timestamp && (!existing.firstSeen || obs.timestamp < existing.firstSeen)) {
        existing.firstSeen = obs.timestamp;
      }
    } else {
      secMap.set(key, {
        authMode: rawAuth,
        securityType: sec.type,
        cipherLabel: sec.cipherLabel,
        hasWps,
        color: sec.color,
        firstSeen: obs.timestamp || ap.firstSeen || '',
        lastSeen: obs.timestamp || ap.lastSeen || '',
        count: 1,
      });
    }
  }

  const securityTimeline: SecurityChangeItem[] = Array.from(secMap.entries())
    .map(([key, data]) => {
      const sec = classifySecurity(data.authMode);
      return {
        securityLabel: sec.label,
        cipherLabel: data.cipherLabel,
        hasWps: data.hasWps,
        authMode: data.authMode,
        securityType: data.securityType,
        color: data.color,
        firstSeen: data.firstSeen,
        lastSeen: data.lastSeen,
        count: data.count,
      };
    })
    .sort((a, b) => (a.firstSeen || '').localeCompare(b.firstSeen || ''));

  const hasSecurityChanged = securityTimeline.length > 1;

  return {
    hasSsidChanged,
    ssidTimeline,
    hasSecurityChanged,
    securityTimeline,
  };
}
