// Official IEEE Standards OUI Database (https://standards-oui.ieee.org/oui/oui.txt)
// Contains official vendor registrations strictly adhering to official IEEE standards.

import ieeeDataRaw from './ieeeOuiDatabase.json';

export interface OuiEntry {
  prefix: string; // "XX:XX:XX"
  vendor: string;
  isCustom?: boolean;
}

export const IEEE_OUI_URL = 'https://standards-oui.ieee.org/oui/oui.txt';

// The official IEEE OUI database loaded directly from official dataset
export const OFFICIAL_IEEE_DATABASE: Record<string, string> = ieeeDataRaw as Record<string, string>;

const STORAGE_KEY_CUSTOM_OUI = 'wigle_custom_oui_db_v3';
const STORAGE_KEY_SYNCED_IEEE = 'wigle_synced_ieee_db_v3';

/**
 * Normalizes a MAC string to standard uppercase OUI prefix: "XX:XX:XX"
 * Supports formats like "00:06:91", "00-06-91", "000691", "ac:84:c9"
 * Also pads single hex digit octets like "ec:49:e:..." -> "EC:49:0E"
 */
export function normalizeOuiPrefix(macOrOui: string): string {
  if (!macOrOui) return '';
  const trimmed = macOrOui.trim();

  // If separated by colons or hyphens or dots, pad each part to 2 hex characters
  if (trimmed.includes(':') || trimmed.includes('-') || trimmed.includes('.')) {
    const parts = trimmed.split(/[:\-.]/).filter(Boolean);
    if (parts.length >= 3) {
      const p1 = parts[0].padStart(2, '0').toUpperCase();
      const p2 = parts[1].padStart(2, '0').toUpperCase();
      const p3 = parts[2].padStart(2, '0').toUpperCase();
      if (/^[0-9A-F]{2}$/.test(p1) && /^[0-9A-F]{2}$/.test(p2) && /^[0-9A-F]{2}$/.test(p3)) {
        return `${p1}:${p2}:${p3}`;
      }
    }
  }

  // Fallback to pure hex string
  const clean = trimmed.replace(/[^0-9a-fA-F]/g, '').toUpperCase();
  if (clean.length < 6) return '';
  const octet1 = clean.substring(0, 2);
  const octet2 = clean.substring(2, 4);
  const octet3 = clean.substring(4, 6);
  return `${octet1}:${octet2}:${octet3}`;
}

/**
 * Normalizes a full MAC address to XX:XX:XX:XX:XX:XX
 * Handles unpadded octets like "ec:49:e:12:05:9b" -> "EC:49:0E:12:05:9B"
 */
export function normalizeMac(mac: string): string {
  if (!mac) return '';
  const trimmed = mac.trim();

  if (trimmed.includes(':') || trimmed.includes('-') || trimmed.includes('.')) {
    const parts = trimmed.split(/[:\-.]/).filter(Boolean);
    if (parts.length === 6) {
      return parts.map((p) => p.padStart(2, '0').toUpperCase()).join(':');
    }
  }

  const clean = trimmed.replace(/[^0-9a-fA-F]/g, '').toUpperCase();
  if (clean.length === 12) {
    return clean.match(/.{1,2}/g)?.join(':') || mac.toUpperCase();
  }
  return mac.toUpperCase().trim();
}

let _cachedSyncedIeee: Record<string, string> | null | undefined = undefined;
let _cachedCustomOui: Record<string, string> | undefined = undefined;

/**
 * Load custom user OUIs from localStorage (cached in memory)
 */
export function loadCustomOuiDatabase(): Record<string, string> {
  if (_cachedCustomOui !== undefined) return _cachedCustomOui;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CUSTOM_OUI);
    if (!raw) {
      _cachedCustomOui = {};
      return _cachedCustomOui;
    }
    _cachedCustomOui = JSON.parse(raw);
    return _cachedCustomOui!;
  } catch (e) {
    console.error('Failed to parse custom OUI db from localStorage', e);
    _cachedCustomOui = {};
    return _cachedCustomOui;
  }
}

/**
 * Save custom user OUIs to localStorage
 */
export function saveCustomOuiDatabase(customMap: Record<string, string>): void {
  _cachedCustomOui = customMap;
  try {
    localStorage.setItem(STORAGE_KEY_CUSTOM_OUI, JSON.stringify(customMap));
  } catch (e) {
    console.error('Failed to save custom OUI db to localStorage', e);
  }
}

/**
 * Load locally cached synced IEEE database if user did a live update (cached in memory)
 */
export function loadSyncedIeeeDatabase(): Record<string, string> | null {
  if (_cachedSyncedIeee !== undefined) return _cachedSyncedIeee;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SYNCED_IEEE);
    if (!raw) {
      _cachedSyncedIeee = null;
      return null;
    }
    _cachedSyncedIeee = JSON.parse(raw);
    return _cachedSyncedIeee ?? null;
  } catch (e) {
    _cachedSyncedIeee = null;
    return null;
  }
}

/**
 * Save live synced IEEE database
 */
export function saveSyncedIeeeDatabase(db: Record<string, string>): void {
  _cachedSyncedIeee = db;
  try {
    localStorage.setItem(STORAGE_KEY_SYNCED_IEEE, JSON.stringify(db));
  } catch (e) {
    console.warn('Could not cache synced IEEE db to localStorage', e);
  }
}

const _resolveCache = new Map<string, { vendor: string; oui: string; isRandomized: boolean; isCustom: boolean; isIeee: boolean }>();

export function clearOuiResolveCache(): void {
  _resolveCache.clear();
}

/**
 * Resolves the vendor name for a given MAC or OUI prefix strictly using official IEEE data.
 * Order of precedence:
 * 1. User Imported Official OUI Database (e.g. from official oui.txt uploaded by user)
 * 2. Synced IEEE database (if updated live from standards-oui.ieee.org)
 * 3. Built-in Official IEEE standards database
 * 4. Randomized / Locally Administered MAC detection
 */
export function resolveVendor(
  macOrOui: string,
  customDb?: Record<string, string>
): { vendor: string; oui: string; isRandomized: boolean; isCustom: boolean; isIeee: boolean } {
  if (!macOrOui) {
    return { vendor: 'Unknown', oui: '', isRandomized: false, isCustom: false, isIeee: false };
  }

  // Fast cache key
  const cacheKey = customDb ? `${macOrOui}_custom` : macOrOui;
  const cached = _resolveCache.get(cacheKey);
  if (cached) return cached;

  const oui = normalizeOuiPrefix(macOrOui);
  if (!oui) {
    const res = { vendor: 'Unknown', oui: '', isRandomized: false, isCustom: false, isIeee: false };
    _resolveCache.set(cacheKey, res);
    return res;
  }

  // Check locally administered / randomized MAC (bit 1 of 1st byte is 1 => 2,6,A,E in 2nd hex digit)
  const firstByte = parseInt(oui.substring(0, 2), 16);
  const isRandomized = (firstByte & 0x02) !== 0;

  // 1. Check user imported/custom DB
  const custom = customDb || loadCustomOuiDatabase();
  if (custom && custom[oui]) {
    const res = {
      vendor: custom[oui],
      oui,
      isRandomized,
      isCustom: true,
      isIeee: true,
    };
    if (_resolveCache.size < 50000) _resolveCache.set(cacheKey, res);
    return res;
  }

  // 2. Check synced IEEE DB (if user ran an online sync)
  const syncedIeee = loadSyncedIeeeDatabase();
  if (syncedIeee && syncedIeee[oui]) {
    const res = {
      vendor: syncedIeee[oui],
      oui,
      isRandomized: false,
      isCustom: false,
      isIeee: true,
    };
    if (_resolveCache.size < 50000) _resolveCache.set(cacheKey, res);
    return res;
  }

  // 3. Check built-in official IEEE Database
  if (OFFICIAL_IEEE_DATABASE[oui]) {
    const res = {
      vendor: OFFICIAL_IEEE_DATABASE[oui],
      oui,
      isRandomized: false,
      isCustom: false,
      isIeee: true,
    };
    if (_resolveCache.size < 50000) _resolveCache.set(cacheKey, res);
    return res;
  }

  // 4. Fallback for unregistered or unassigned addresses
  const res = {
    vendor: '[Unassigned by IEEE]',
    oui,
    isRandomized,
    isCustom: false,
    isIeee: false,
  };
  if (_resolveCache.size < 50000) _resolveCache.set(cacheKey, res);
  return res;
}

/**
 * Parse an uploaded OUI list or text.
 * Fully supports official IEEE oui.txt format:
 *   00-00-0C   (hex)		Cisco Systems, Inc
 *   00000C     (base 16)		Cisco Systems, Inc
 *   AC-84-C9   (hex)		Sagemcom Broadband SAS
 *   00:06:91,Sagemcom Broadband SAS
 *   JSON format {"00:06:91": "Sagemcom Broadband SAS"}
 */
export function parseCustomOuiText(text: string): {
  entries: Record<string, string>;
  count: number;
  errors: number;
} {
  const result: Record<string, string> = {};
  let errors = 0;

  const trimmed = text.trim();

  // JSON dictionary detection
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed);
      for (const [key, val] of Object.entries(parsed)) {
        const prefix = normalizeOuiPrefix(key);
        if (prefix && typeof val === 'string' && val.trim().length > 0) {
          result[prefix] = val.trim();
        }
      }
      return { entries: result, count: Object.keys(result).length, errors: 0 };
    } catch {
      // Fallback
    }
  }

  const lines = text.split(/\r?\n/);
  // IEEE hex regex: "AC-84-C9   (hex)\t\tSagemcom Broadband SAS" or "AC:84:C9 (hex) Sagemcom"
  const ieeeHexRegex = /^([0-9A-Fa-f]{2}[-:][0-9A-Fa-f]{2}[-:][0-9A-Fa-f]{2})\s+\(hex\)\s+(.+)$/;
  // IEEE base16 regex: "AC84C9     (base 16)\t\tSagemcom Broadband SAS"
  const ieeeBase16Regex = /^([0-9A-Fa-f]{6})\s+\(base\s*16\)\s+(.+)$/;

  for (const line of lines) {
    const cleanLine = line.trim();
    if (!cleanLine || cleanLine.startsWith('#') || cleanLine.startsWith('//') || cleanLine.startsWith('OUI/MA-L')) {
      continue;
    }

    // 1. Try IEEE hex match
    const matchHex = cleanLine.match(ieeeHexRegex);
    if (matchHex) {
      const prefix = normalizeOuiPrefix(matchHex[1]);
      const vendor = matchHex[2].trim();
      if (prefix && vendor) {
        result[prefix] = vendor;
        continue;
      }
    }

    // 2. Try IEEE base 16 match
    const matchBase16 = cleanLine.match(ieeeBase16Regex);
    if (matchBase16) {
      const prefix = normalizeOuiPrefix(matchBase16[1]);
      const vendor = matchBase16[2].trim();
      if (prefix && vendor) {
        result[prefix] = vendor;
        continue;
      }
    }

    // 3. Try CSV / semicolon / tab separated formats
    let prefix = '';
    let vendor = '';

    if (cleanLine.includes(',')) {
      const parts = cleanLine.split(',');
      prefix = normalizeOuiPrefix(parts[0]);
      vendor = parts.slice(1).join(',').replace(/^["']|["']$/g, '').trim();
    } else if (cleanLine.includes(';')) {
      const parts = cleanLine.split(';');
      prefix = normalizeOuiPrefix(parts[0]);
      vendor = parts.slice(1).join(';').replace(/^["']|["']$/g, '').trim();
    } else if (cleanLine.includes('\t')) {
      const parts = cleanLine.split('\t');
      prefix = normalizeOuiPrefix(parts[0]);
      vendor = parts.slice(1).join(' ').trim();
    } else {
      // Regex match first 6-17 chars as hex/mac, rest as vendor
      const match = cleanLine.match(/^([0-9a-fA-F:.-]{6,17})[\s|=]+(.+)$/);
      if (match) {
        prefix = normalizeOuiPrefix(match[1]);
        vendor = match[2].replace(/#.*$/, '').trim();
      }
    }

    if (prefix && vendor) {
      result[prefix] = vendor;
    } else {
      errors++;
    }
  }

  return {
    entries: result,
    count: Object.keys(result).length,
    errors,
  };
}

/**
 * Fetch and sync the latest IEEE OUI database from the official IEEE endpoint
 */
export async function syncFromOfficialIeee(): Promise<{
  success: boolean;
  count: number;
  message: string;
  entries?: Record<string, string>;
}> {
  try {
    let text = '';
    const endpoints = [
      IEEE_OUI_URL,
      `https://corsproxy.io/?${encodeURIComponent(IEEE_OUI_URL)}`,
      `https://api.allorigins.win/raw?url=${encodeURIComponent(IEEE_OUI_URL)}`,
    ];

    for (const url of endpoints) {
      try {
        const res = await fetch(url, { method: 'GET', mode: 'cors' });
        if (res.ok) {
          text = await res.text();
          if (text && text.includes('(hex)')) {
            break;
          }
        }
      } catch {
        // continue to next endpoint
      }
    }

    if (!text || !text.includes('(hex)')) {
      const count = Object.keys(OFFICIAL_IEEE_DATABASE).length;
      return {
        success: true,
        count,
        message: `Built-in official IEEE database active (${count.toLocaleString()} entries).`,
        entries: OFFICIAL_IEEE_DATABASE,
      };
    }

    const { entries, count } = parseCustomOuiText(text);
    if (count > 0) {
      saveSyncedIeeeDatabase(entries);
      return {
        success: true,
        count,
        message: `${count.toLocaleString()} official IEEE vendors downloaded and synced successfully from standards-oui.ieee.org!`,
        entries,
      };
    }

    return {
      success: false,
      count: 0,
      message: 'Could not parse the IEEE file received.',
    };
  } catch {
    const count = Object.keys(OFFICIAL_IEEE_DATABASE).length;
    return {
      success: true,
      count,
      message: `Built-in official IEEE database active (${count.toLocaleString()} entries).`,
      entries: OFFICIAL_IEEE_DATABASE,
    };
  }
}
