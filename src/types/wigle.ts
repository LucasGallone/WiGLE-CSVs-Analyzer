export interface WigleRawRecord {
  mac: string;
  ssid: string;
  authMode: string;
  firstSeen: string;
  channel: number | string;
  frequency?: number;
  rssi: number;
  latitude: number;
  longitude: number;
  altitudeMeters?: number;
  accuracyMeters?: number;
  rcois?: string;
  mfgId?: string;
  type: string;
  sourceFile?: string;
  rawRowIndex?: number;
}

export interface WigleHeaderInfo {
  format?: string;
  appRelease?: string;
  model?: string;
  release?: string;
  device?: string;
  display?: string;
  brand?: string;
  board?: string;
  star?: string;
  body?: string;
  subBody?: string;
  totalRows?: number;
  rawLine?: string;
}

export type WigleCsvHeader = WigleHeaderInfo;

export type WifiBand = '2.4 GHz' | '5 GHz' | '6 GHz' | '60 GHz' | 'Unknown';

export type SecurityType =
  | 'OPEN'
  | 'WEP'
  | 'WPA'
  | 'WPA_WPA2'
  | 'WPA2'
  | 'WPA2_WPA3'
  | 'WPA3'
  | 'ENTERPRISE'
  | 'WPA3_ENTERPRISE'
  | 'WPA1_ENTERPRISE'
  | 'UNKNOWN';

export interface SecurityCategory {
  type: SecurityType;
  label: string;
  color: string;
  isSecure: boolean;
  ciphers?: string[];
  cipherLabel?: string;
  keyManagement?: string[];
  protocols?: string[];
  details?: string;
  technicalAnalysis?: string;
  technicalAnalysisFr?: string;
  technicalPointsEn?: string[];
  technicalPointsFr?: string[];
  pmfStatus?: 'REQUIRED' | 'CAPABLE' | 'NONE';
  fastRoaming?: boolean;
  securityRating?: 'MAXIMUM' | 'HIGH' | 'STANDARD' | 'WEAK' | 'INSECURE';
}

export interface AccessPointObservation {
  timestamp: string;
  rssi: number;
  latitude: number;
  longitude: number;
  altitude?: number;
  accuracy?: number;
  frequency?: number;
  channel?: number | string;
  sourceFile?: string;
  ssid?: string;
  authMode?: string;
  isFromWigleFile?: boolean;
}

export interface ProcessedAccessPoint {
  mac: string; // BSSID normalized uppercase XX:XX:XX:XX:XX:XX
  oui: string; // First 3 octets XX:XX:XX
  vendor: string; // Official IEEE registered vendor
  ssid: string;
  isSSIDHidden: boolean;
  hasWps?: boolean; // WPS activated flag
  authMode: string;
  security: SecurityCategory;
  channel: number | string;
  frequency?: number; // MHz (e.g. 2462, 5500, 5975)
  band: '2.4 GHz' | '5 GHz' | '6 GHz' | '60 GHz' | 'Unknown';
  firstSeen: string;
  lastSeen: string;
  bestRssi: number;
  latestRssi: number;
  latitude: number; // Position at best or latest observation
  longitude: number;
  altitudeMeters?: number;
  accuracyMeters?: number;
  rcois?: string;
  mfgId?: string;
  type: string;
  observationCount: number;
  observations: AccessPointObservation[];
  sourceFiles: string[];
  isWigleOnly?: boolean;
  hasCompleteDetails?: boolean;
  isModified?: boolean;
  hasSsidChanged?: boolean;
  hasSecurityChanged?: boolean;
}

export interface FileMetadata {
  fileName: string;
  header: WigleHeaderInfo;
  isWigleDevice: boolean;
}

export interface ScanSessionData {
  header?: WigleHeaderInfo;
  files: string[];
  filesMetadata?: Record<string, FileMetadata>;
  rawRecords: WigleRawRecord[];
  totalRecords?: number;
  accessPoints: ProcessedAccessPoint[];
  loadedAt: string;
  geoBounds?: {
    minLat: number;
    maxLat: number;
    minLng: number;
    maxLng: number;
    centerLat: number;
    centerLng: number;
  };
}

export interface LocationGroup {
  locationKey: string;
  latitude: number;
  longitude: number;
  accessPoints: ProcessedAccessPoint[];
  count: number;
}

export interface FilterState {
  searchQuery: string; // Restricted strictly to SSID, BSSID / MAC, OUI
  securityFilter: string[]; // Direct encryption filtering: 'ALL' or ['OPEN', 'WEP', 'WPA', 'WPA2', 'WPA3', 'ENTERPRISE']
  minRssi: number;
  maxRssi: number;
  vendorFilter: string;
  ouiFilter: string;
  channelFilter: string; // 'ALL', 'BAND_2_4', 'BAND_5', 'BAND_6', or specific channel '1', '6', '36', etc.
  bandFilter: string;
  dateFilter: string; // 'ALL' or 'YYYY-MM-DD'
  locationFilter: { lat: number; lng: number; key: string; radiusMeters?: number; macs?: string[] } | null;
  wpsFilter: 'ALL' | 'WPS_ONLY' | 'NO_WPS' | 'HIDE_BADGES'; // Option to show/hide WPS / filter WPS
  cipherAlgorithmFilter?: string; // Dynamic cipher algorithm filter (e.g. 'TKIP', 'CCMP', 'GCMP-256')
  isCipherFilterActive?: boolean; // Toggle to activate/deactivate algorithm filtering
  onlyOpenNetworks: boolean;
  onlyWpa3: boolean;
  onlyModifiedNetworks?: boolean;
}
