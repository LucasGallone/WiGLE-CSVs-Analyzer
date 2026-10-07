import Papa from 'papaparse';
import { resolveVendor } from '../data/ouiDatabase';
import {
  parseWigleHeader,
  isWigleModel,
  classifySecurity,
  frequencyOrChannelToBand,
  channelToFrequency,
  normalizeMac,
  internString,
  addObservationCompacted,
  compactObs,
  synchronizeLatestApObservations,
} from '../utils/csvParser';
import { ProcessedAccessPoint, AccessPointObservation, WigleCsvHeader, WifiBand } from '../types/wigle';

self.onmessage = async (e: MessageEvent) => {
  const { file, csvText, fileName, customOuiMap } = e.data;

  try {
    let header: WigleCsvHeader = { rawLine: '' };
    let colMap: Record<string, number> = {
      MAC: 0,
      SSID: 1,
      AUTHMODE: 2,
      FIRSTSEEN: 3,
      CHANNEL: 4,
      FREQUENCY: 5,
      RSSI: 6,
      CURRENTLATITUDE: 7,
      CURRENTLONGITUDE: 8,
      ALTITUDEMETERS: 9,
      ACCURACYMETERS: 10,
      TYPE: 11,
      RCOIS: 12,
      MFGID: 13,
    };
    let isHeaderProcessed = false;
    let isColMapDetermined = false;
    let isWigleFile = false;
    const apMap = new Map<string, ProcessedAccessPoint>();
    let rowsParsed = 0;
    let totalRowsCount = 0;
    let lastProgressUpdate = 0;
    let maxPercentSeen = 0;
    const parseTarget = file || csvText || '';
    const fileSize = file?.size || (typeof csvText === 'string' ? csvText.length : 1);

    Papa.parse<string[]>(parseTarget, {
      skipEmptyLines: 'greedy',
      dynamicTyping: false,
      fastMode: true,
      chunkSize: 1024 * 1024 * 8, // 8MB streaming chunks for maximum throughput in Web Worker
      chunk: (results) => {
        const data = results.data;

        for (let i = 0; i < data.length; i++) {
          const cols = data[i];
          if (!cols || cols.length === 0) continue;

          // Check if first line is a WiGLE metadata header or column names header
          if (!isHeaderProcessed) {
            const rawLine = cols.join(',');
            const lineUpper = cols.map((c) => String(c || '').toUpperCase().trim()).join(',');
            const isColHeaderRow =
              lineUpper.includes('MAC') ||
              lineUpper.includes('BSSID') ||
              lineUpper.includes('NETID') ||
              lineUpper.includes('SSID');

            if (!isColHeaderRow) {
              header = parseWigleHeader(rawLine);
              isWigleFile = isWigleModel(header);
              isHeaderProcessed = true;
              continue;
            } else {
              // First row is actually the columns header
              isHeaderProcessed = true;
              isColMapDetermined = false;
            }
          }

          // Column names detection
          if (!isColMapDetermined) {
            const rowUpper = cols.map((c) => String(c || '').toUpperCase().trim());
            const lineUpper = rowUpper.join(',');
            const isHeaderRow =
              lineUpper.includes('MAC') ||
              lineUpper.includes('BSSID') ||
              lineUpper.includes('NETID') ||
              lineUpper.includes('SSID');

            if (isHeaderRow) {
              const newMap: Record<string, number> = {};
              rowUpper.forEach((name, idx) => {
                const clean = name.replace(/["'#\uFEFF\r\n]/g, '').trim();
                newMap[clean] = idx;
                if (clean.includes('BSSID') || clean.includes('NETID') || clean === 'MAC') newMap.MAC = idx;
                if (clean === 'SSID' || clean === 'ESSID' || (clean.includes('SSID') && !clean.includes('BSSID'))) newMap.SSID = idx;
                if (clean.includes('CAPABILITIES') || clean.includes('FLAGS') || clean.includes('SECURITY') || clean.includes('AUTHMODE')) newMap.AUTHMODE = idx;
                if (clean.includes('TIME') || clean.includes('FIRSTTIME') || clean.includes('TIMESTAMP') || clean.includes('FIRSTSEEN') || clean.includes('SEEN')) newMap.FIRSTSEEN = idx;
                if (clean === 'CH' || clean.includes('CHANNEL')) newMap.CHANNEL = idx;
                if (clean.includes('FREQ')) newMap.FREQUENCY = idx;
                if (clean.includes('SIGNAL') || clean.includes('LEVEL') || clean.includes('RSSI')) newMap.RSSI = idx;
                if (clean.includes('LAT')) newMap.CURRENTLATITUDE = idx;
                if (clean.includes('LON') || clean.includes('LNG')) newMap.CURRENTLONGITUDE = idx;
                if (clean.includes('ALT')) newMap.ALTITUDEMETERS = idx;
                if (clean.includes('ACC')) newMap.ACCURACYMETERS = idx;
                if (clean === 'TYPE' || clean === 'NETWORKTYPE' || clean === 'NETTYPE' || (clean.includes('TYPE') && !clean.includes('SECURITY'))) newMap.TYPE = idx;
              });
              colMap = newMap;
              isColMapDetermined = true;
              continue;
            }
            isColMapDetermined = true;
          }

          if (cols.length < 3) continue;

          const rawMac = cols[colMap.MAC ?? 0] || '';
          if (!rawMac || rawMac.length < 5 || rawMac.startsWith('#')) continue;

          const mac = normalizeMac(rawMac);
          const ssid = (cols[colMap.SSID ?? 1] || '').trim();
          const authMode = cols[colMap.AUTHMODE ?? 2] || '';
          const firstSeen = cols[colMap.FIRSTSEEN ?? 3] || '';
          const channelRaw = (cols[colMap.CHANNEL ?? 4] || '').trim();
          const hasValidChannel = channelRaw !== '' && channelRaw !== '0';
          const channel = hasValidChannel ? channelRaw : (isWigleFile ? '' : '1');
          const freqRaw = cols[colMap.FREQUENCY ?? 5];
          const frequency = freqRaw && parseInt(freqRaw, 10) > 0 ? parseInt(freqRaw, 10) : (hasValidChannel ? channelToFrequency(channel) : undefined);
          const rssiRaw = cols[colMap.RSSI ?? 6] || '-80';
          const rssi = parseFloat(rssiRaw) || -80;
          const latRaw = cols[colMap.CURRENTLATITUDE ?? 7] || '0';
          const lngRaw = cols[colMap.CURRENTLONGITUDE ?? 8] || '0';
          const latitude = parseFloat(latRaw) || 0;
          const longitude = parseFloat(lngRaw) || 0;
          const altRaw = cols[colMap.ALTITUDEMETERS ?? 9];
          const altitudeMeters = altRaw ? parseFloat(altRaw) : undefined;
          const accRaw = cols[colMap.ACCURACYMETERS ?? 10];
          const accuracyMeters = accRaw ? parseFloat(accRaw) : undefined;

          let typeColIndex = colMap.TYPE;
          if (typeColIndex === undefined) {
            for (let cIdx = cols.length - 1; cIdx >= 0; cIdx--) {
              const val = (cols[cIdx] || '').replace(/["']/g, '').trim().toUpperCase();
              if (['WIFI', 'BLE', 'BT', 'GSM', 'LTE', 'WCDMA', 'CDMA', 'NR'].includes(val)) {
                typeColIndex = cIdx;
                break;
              }
            }
          }

          const rawType = (typeColIndex !== undefined && cols[typeColIndex] !== undefined ? cols[typeColIndex] : '')
            .replace(/["']/g, '')
            .trim()
            .toUpperCase();

          // Strictly filter out rows without WIFI as Type (empty Type is also ignored)
          if (rawType !== 'WIFI') {
            continue;
          }

          const type = 'WIFI';

          const rcois = cols[colMap.RCOIS ?? 12] || '';
          const mfgId = cols[colMap.MFGID ?? 13] || '';

          totalRowsCount++;

          const observation: AccessPointObservation = {
            timestamp: firstSeen,
            rssi,
            latitude,
            longitude,
            altitude: altitudeMeters,
            accuracy: accuracyMeters,
            sourceFile: fileName,
            channel,
            frequency,
            authMode,
            ssid,
            isFromWigleFile: isWigleFile,
          };

          const existing = apMap.get(mac);
          if (existing) {
            addObservationCompacted(existing, observation, fileName);
          } else {
            const { vendor, oui } = resolveVendor(mac, customOuiMap);
            const band = hasValidChannel ? frequencyOrChannelToBand(frequency, channel) : (isWigleFile ? 'Unknown' : frequencyOrChannelToBand(frequency, channel));
            const security = classifySecurity(authMode);
            const hasWps = (authMode || '').toUpperCase().includes('WPS');

            const ap: ProcessedAccessPoint = {
              mac,
              oui: internString(oui),
              vendor: internString(vendor),
              ssid,
              isSSIDHidden: !ssid || ssid.length === 0,
              hasWps,
              authMode: internString(authMode),
              security,
              channel: internString(channel),
              frequency,
              band: internString(band) as WifiBand,
              firstSeen,
              lastSeen: firstSeen,
              bestRssi: rssi,
              latestRssi: rssi,
              latitude,
              longitude,
              altitudeMeters,
              accuracyMeters,
              rcois: internString(rcois),
              mfgId: internString(mfgId),
              type: internString(type),
              observationCount: 1,
              observations: [],
              sourceFiles: [internString(fileName)],
              isWigleOnly: isWigleFile,
              hasCompleteDetails: !isWigleFile && hasValidChannel,
            };

            ap.observations.push(compactObs(ap, observation));
            apMap.set(mac, ap);
          }

          rowsParsed++;
        }

        const now = Date.now();
        if (now - lastProgressUpdate > 60 || rowsParsed % 10000 === 0) {
          lastProgressUpdate = now;
          const estimatedBytes = results.meta?.cursor || 0;
          const calcPct = Math.min(99, Math.round((estimatedBytes / fileSize) * 100));
          if (calcPct > maxPercentSeen) {
            maxPercentSeen = calcPct;
          }
          self.postMessage({
            type: 'PROGRESS',
            fileName,
            rowsParsed,
            uniqueApsCount: apMap.size,
            percent: maxPercentSeen,
          });
        }
      },
      complete: () => {
        header.totalRows = totalRowsCount;
        self.postMessage({
          type: 'PROGRESS',
          fileName,
          rowsParsed: totalRowsCount,
          uniqueApsCount: apMap.size,
          percent: 100,
        });
        synchronizeLatestApObservations(apMap);

        const allAps = Array.from(apMap.values());
        const CHUNK_SIZE = 5000;
        const totalChunks = Math.ceil(allAps.length / CHUNK_SIZE) || 1;

        for (let c = 0; c < totalChunks; c++) {
          const chunk = allAps.slice(c * CHUNK_SIZE, (c + 1) * CHUNK_SIZE);
          self.postMessage({
            type: 'CHUNK',
            fileName,
            chunkIndex: c,
            totalChunks,
            chunk,
          });
        }

        self.postMessage({
          type: 'COMPLETE',
          fileName,
          header,
          totalRows: totalRowsCount,
          totalAps: allAps.length,
        });
      },
      error: (err: any) => {
        self.postMessage({
          type: 'ERROR',
          error: String(err),
        });
      },
    });
  } catch (err: any) {
    self.postMessage({
      type: 'ERROR',
      error: String(err),
    });
  }
};
