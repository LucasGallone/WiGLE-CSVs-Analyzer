import { internString } from './csvParser';

export interface BluetoothCategoryInfo {
  id: string;
  nameEn: string;
  nameFr: string;
  group: 'audio' | 'computer' | 'phone' | 'peripheral' | 'wearable' | 'health' | 'toy' | 'vehicle' | 'misc' | 'uncategorized';
  color: string;
  iconName: string;
}

// Full code mappings matching WiGLE's BluetoothReceiver.java
export const BT_DEVICE_TYPE_LEGEND: Record<number, string> = {
  0: 'Misc',
  1076: 'Camcorder',
  1056: 'Car Audio',
  1032: 'Handsfree',
  1028: 'Headphones',
  1064: 'HiFi',
  1048: 'Speaker',
  1040: 'Mic',
  1052: 'Portable Audio',
  1060: 'Settop',
  1024: 'A/V',
  1068: 'VCR',
  1072: 'Camera',
  1088: 'Videoconf',
  1084: 'Display/Speaker',
  1092: 'AV Toy',
  1080: 'Monitor',
  260: 'Desktop',
  272: 'PDA',
  268: 'Laptop',
  276: 'Palm',
  264: 'Server',
  256: 'Computer',
  280: 'Wearable Computer',
  2308: 'Blood Pressure',
  2332: 'Health Display',
  2320: 'Glucose',
  2324: 'PulseOxy',
  2316: 'Pulse',
  2312: 'Thermometer',
  2304: 'Health',
  2328: 'Scale',
  1344: 'Keyboard',
  1472: 'Keyboard+p',
  1280: 'Keyboard !p',
  1408: 'Pointer',
  516: 'Cellphone',
  520: 'Cordless Phone',
  532: 'ISDN',
  528: 'Modem/GW',
  524: 'Smartphone',
  512: 'Phone',
  2064: 'Controller',
  2060: 'Doll',
  2056: 'Game',
  2052: 'Robot',
  2048: 'Toy',
  2068: 'Vehicle',
  1812: 'Glasses',
  1808: 'Helmet',
  1804: 'Jacket',
  1800: 'Pager',
  1792: 'Wearable',
  1796: 'Watch',
  7936: 'Uncategorized',
};

// Bluetooth Category details (Labels FR/EN, Colors, Groups, Icons)
export const BT_CATEGORY_MAP: Record<string, BluetoothCategoryInfo> = {
  'Car Audio': { id: 'car_audio', nameEn: 'Car Audio / Handsfree', nameFr: 'Système Audio Véhicule / Mains-libres', group: 'vehicle', color: '#f59e0b', iconName: 'Car' },
  'Handsfree': { id: 'handsfree', nameEn: 'Handsfree Kit', nameFr: 'Kit Mains-libres', group: 'audio', color: '#f59e0b', iconName: 'Headphones' },
  'Headphones': { id: 'headphones', nameEn: 'Headphones / Earbuds', nameFr: 'Casque / Écouteurs', group: 'audio', color: '#3b82f6', iconName: 'Headphones' },
  'Speaker': { id: 'speaker', nameEn: 'Audio Speaker', nameFr: 'Enceinte Audio', group: 'audio', color: '#06b6d4', iconName: 'Volume2' },
  'HiFi': { id: 'hifi', nameEn: 'HiFi Audio System', nameFr: 'Système Audio Hi-Fi', group: 'audio', color: '#06b6d4', iconName: 'Music' },
  'Portable Audio': { id: 'portable_audio', nameEn: 'Portable Audio Device', nameFr: 'Lecteur Audio Portable', group: 'audio', color: '#0ea5e9', iconName: 'Music' },
  'Mic': { id: 'mic', nameEn: 'Microphone', nameFr: 'Microphone', group: 'audio', color: '#8b5cf6', iconName: 'Mic' },
  'Camcorder': { id: 'camcorder', nameEn: 'Camcorder', nameFr: 'Caméscope', group: 'audio', color: '#a855f7', iconName: 'Video' },
  'Camera': { id: 'camera', nameEn: 'Camera', nameFr: 'Appareil Photo', group: 'audio', color: '#a855f7', iconName: 'Camera' },
  'Settop': { id: 'settop', nameEn: 'Set-top Box / TV', nameFr: 'Box TV / Multimédia', group: 'audio', color: '#6366f1', iconName: 'Tv' },
  'A/V': { id: 'av', nameEn: 'Audio / Video Device', nameFr: 'Appareil Audio / Vidéo', group: 'audio', color: '#3b82f6', iconName: 'Tv' },
  'Display/Speaker': { id: 'display', nameEn: 'Display', nameFr: 'Écran', group: 'audio', color: '#6366f1', iconName: 'Tv' },
  'Display': { id: 'display', nameEn: 'Display', nameFr: 'Écran', group: 'audio', color: '#6366f1', iconName: 'Tv' },
  'Videoconf': { id: 'videoconf', nameEn: 'Video Conferencing', nameFr: 'Visioconférence', group: 'audio', color: '#8b5cf6', iconName: 'Video' },
  'Monitor': { id: 'monitor', nameEn: 'Monitor', nameFr: 'Écran / Moniteur', group: 'audio', color: '#6366f1', iconName: 'Tv' },
  'Smartphone': { id: 'smartphone', nameEn: 'Smartphone', nameFr: 'Smartphone', group: 'phone', color: '#10b981', iconName: 'Smartphone' },
  'Cellphone': { id: 'cellphone', nameEn: 'Mobile Phone', nameFr: 'Téléphone portable', group: 'phone', color: '#10b981', iconName: 'Smartphone' },
  'Phone': { id: 'phone', nameEn: 'Phone Device', nameFr: 'Téléphone', group: 'phone', color: '#10b981', iconName: 'Smartphone' },
  'Cordless Phone': { id: 'cordless_phone', nameEn: 'Cordless Phone', nameFr: 'Téléphone sans fil', group: 'phone', color: '#10b981', iconName: 'Phone' },
  'Modem/GW': { id: 'modem_gw', nameEn: 'Modem / Gateway', nameFr: 'Modem / Passerelle', group: 'phone', color: '#059669', iconName: 'Radio' },
  'Laptop': { id: 'laptop', nameEn: 'Laptop Computer', nameFr: 'Ordinateur Portable', group: 'computer', color: '#6366f1', iconName: 'Laptop' },
  'Desktop': { id: 'desktop', nameEn: 'Desktop Computer', nameFr: 'Ordinateur de Bureau', group: 'computer', color: '#6366f1', iconName: 'Monitor' },
  'Computer': { id: 'computer', nameEn: 'Computer', nameFr: 'Ordinateur', group: 'computer', color: '#6366f1', iconName: 'Laptop' },
  'Server': { id: 'server', nameEn: 'Server', nameFr: 'Serveur', group: 'computer', color: '#4f46e5', iconName: 'Server' },
  'PDA': { id: 'pda', nameEn: 'PDA / Pocket PC', nameFr: 'PDA / PC de poche', group: 'computer', color: '#6366f1', iconName: 'Tablet' },
  'Keyboard': { id: 'keyboard', nameEn: 'Keyboard', nameFr: 'Clavier', group: 'peripheral', color: '#ec4899', iconName: 'Keyboard' },
  'Keyboard+p': { id: 'keyboard_pointer', nameEn: 'Keyboard & Trackpad/Mouse', nameFr: 'Clavier et Pavé tactile/Souris', group: 'peripheral', color: '#ec4899', iconName: 'Keyboard' },
  'Keyboard !p': { id: 'keyboard_no_pointer', nameEn: 'Keyboard (without Pointer)', nameFr: 'Clavier (sans pointeur)', group: 'peripheral', color: '#ec4899', iconName: 'Keyboard' },
  'Pointer': { id: 'pointer', nameEn: 'Mouse / Pointer', nameFr: 'Souris / Pointeur', group: 'peripheral', color: '#f43f5e', iconName: 'Mouse' },
  'Watch': { id: 'watch', nameEn: 'Smartwatch / Wristwatch', nameFr: 'Montre connectée', group: 'wearable', color: '#8b5cf6', iconName: 'Watch' },
  'Wearable': { id: 'wearable', nameEn: 'Wearable Accessory', nameFr: 'Accessoire connecté', group: 'wearable', color: '#8b5cf6', iconName: 'Watch' },
  'Glasses': { id: 'glasses', nameEn: 'Smart Glasses', nameFr: 'Lunettes connectées', group: 'wearable', color: '#8b5cf6', iconName: 'Glasses' },
  'Helmet': { id: 'helmet', nameEn: 'Smart Helmet', nameFr: 'Casque Moto/Vélo', group: 'wearable', color: '#8b5cf6', iconName: 'Shield' },
  'Jacket': { id: 'jacket', nameEn: 'Smart Clothing', nameFr: 'Vêtement connecté', group: 'wearable', color: '#8b5cf6', iconName: 'Shirt' },
  'Health': { id: 'health', nameEn: 'Health Sensor', nameFr: 'Capteur médical', group: 'health', color: '#ef4444', iconName: 'Heart' },
  'Pulse': { id: 'pulse', nameEn: 'Heart Rate Monitor', nameFr: 'Capteur de fréquence cardiaque', group: 'health', color: '#ef4444', iconName: 'Heart' },
  'PulseOxy': { id: 'pulse_oxy', nameEn: 'Pulse Oximeter', nameFr: 'Oxymètre de Pouls', group: 'health', color: '#ef4444', iconName: 'Activity' },
  'Blood Pressure': { id: 'blood_pressure', nameEn: 'Blood Pressure Monitor', nameFr: 'Tensiomètre', group: 'health', color: '#ef4444', iconName: 'Activity' },
  'Thermometer': { id: 'thermometer', nameEn: 'Thermometer', nameFr: 'Thermomètre', group: 'health', color: '#ef4444', iconName: 'Thermometer' },
  'Glucose': { id: 'glucose', nameEn: 'Glucose Monitor', nameFr: 'Lecteur de glycémie', group: 'health', color: '#ef4444', iconName: 'Activity' },
  'Scale': { id: 'scale', nameEn: 'Smart Scale', nameFr: 'Pèse-personne', group: 'health', color: '#ef4444', iconName: 'Scale' },
  'Controller': { id: 'controller', nameEn: 'Game Controller', nameFr: 'Manette de jeu', group: 'toy', color: '#14b8a6', iconName: 'Gamepad2' },
  'Game': { id: 'game', nameEn: 'Gaming Console / Toy', nameFr: 'Console de jeu / Jouet', group: 'toy', color: '#14b8a6', iconName: 'Gamepad2' },
  'Toy': { id: 'toy', nameEn: 'Smart Toy', nameFr: 'Jouet', group: 'toy', color: '#14b8a6', iconName: 'Toy' },
  'Robot': { id: 'robot', nameEn: 'Robot', nameFr: 'Robot', group: 'toy', color: '#14b8a6', iconName: 'Bot' },
  'Vehicle': { id: 'vehicle', nameEn: 'Vehicle Device', nameFr: 'Véhicule', group: 'vehicle', color: '#f59e0b', iconName: 'Car' },
  'Misc': { id: 'misc', nameEn: 'Miscellaneous', nameFr: 'Divers', group: 'misc', color: '#64748b', iconName: 'Bluetooth' },
  'Uncategorized': { id: 'uncategorized', nameEn: 'Uncategorized Device', nameFr: 'Non Catégorisé', group: 'uncategorized', color: '#94a3b8', iconName: 'HelpCircle' },
  'Uncategorized Device': { id: 'uncategorized', nameEn: 'Uncategorized Device', nameFr: 'Non Catégorisé', group: 'uncategorized', color: '#94a3b8', iconName: 'HelpCircle' },
};

// Top Bluetooth SIG Company Identifiers (Company ID to Official Name)
export const BT_SIG_COMPANY_IDS: Record<number, string> = {
  0: 'Ericsson Technology Licensing',
  1: 'Nokia Mobile Phones',
  2: 'Intel Corp.',
  3: 'IBM Corp.',
  4: 'Toshiba Corp.',
  5: '3Com',
  6: 'Microsoft',
  7: 'Lucent',
  8: 'Motorola',
  9: 'Infineon Technologies AG',
  10: 'Qualcomm Technologies, Inc.',
  13: 'Texas Instruments Inc.',
  15: 'Broadcom Corporation',
  19: 'Atmel / Microchip Technology',
  29: 'Qualcomm / CSR (Cambridge Silicon Radio)',
  47: 'Belkin International, Inc.',
  55: 'Bang & Olufsen A/S',
  60: 'Signify Netherlands B.V. (Philips)',
  74: 'Garmin International, Inc.',
  76: 'Apple, Inc.',
  89: 'Nordic Semiconductor ASA',
  114: 'TomTom International BV',
  117: 'Samsung Electronics Co. Ltd.',
  159: 'Parrot Automotive',
  205: 'Huawei Technologies Co., Ltd.',
  224: 'Google LLC',
  258: 'Bose Corporation',
  270: 'Fitbit, LLC',
  287: 'LG Electronics',
  301: 'Sony Mobile Communications Inc.',
  343: 'Xiaomi Inc.',
  356: 'GoPro, Inc.',
  388: 'Anker Innovations Limited',
  399: 'Amazon.com Services LLC',
  413: 'Tile, Inc.',
  485: 'Sennheiser electronic GmbH & Co. KG',
  585: 'Tesla Motors, Inc.',
  737: 'Sonos, Inc.',
  874: 'Meta Platforms Technologies, LLC',
  1063: 'Logitech Europe S.A.',
};

/**
 * Resolves the Company Name from a Bluetooth SIG Manufacturer ID (mfgId).
 */
export function resolveBtCompany(mfgIdStr: string | number | undefined | null): string {
  if (!mfgIdStr && mfgIdStr !== 0) return '';
  const num = typeof mfgIdStr === 'number' ? mfgIdStr : parseInt(String(mfgIdStr).trim(), 10);
  if (isNaN(num)) return '';
  return BT_SIG_COMPANY_IDS[num] || `Company ID: ${num} (0x${num.toString(16).toUpperCase().padStart(4, '0')})`;
}

/**
 * Resolves Bluetooth Category and Metadata from WiGLE AuthMode string or numeric device class code.
 */
export function resolveBtCategory(
  authMode: string | undefined | null,
  frequencyOrChannel?: number | string | null
): BluetoothCategoryInfo {
  const cleanAuth = (authMode || '').trim();

  // 1. Direct match on known categories in authMode (e.g. "Misc;10", "Keyboard", "Car Audio")
  for (const [key, info] of Object.entries(BT_CATEGORY_MAP)) {
    if (cleanAuth === key || cleanAuth.startsWith(`${key};`) || cleanAuth.toLowerCase() === key.toLowerCase()) {
      return info;
    }
  }

  // Check substring matches
  const upper = cleanAuth.toUpperCase();
  if (upper.includes('CAR AUDIO') || upper.includes('CAR_AUDIO')) return BT_CATEGORY_MAP['Car Audio'];
  if (upper.includes('HEADPHONE') || upper.includes('EARBUD') || upper.includes('AIRPOD')) return BT_CATEGORY_MAP['Headphones'];
  if (upper.includes('SPEAKER')) return BT_CATEGORY_MAP['Speaker'];
  if (upper.includes('HANDSFREE')) return BT_CATEGORY_MAP['Handsfree'];
  if (upper.includes('HIFI')) return BT_CATEGORY_MAP['HiFi'];
  if (upper.includes('SMARTPHONE')) return BT_CATEGORY_MAP['Smartphone'];
  if (upper.includes('CELLPHONE')) return BT_CATEGORY_MAP['Cellphone'];
  if (upper.includes('PHONE')) return BT_CATEGORY_MAP['Phone'];
  if (upper.includes('KEYBOARD')) return BT_CATEGORY_MAP['Keyboard'];
  if (upper.includes('POINTER') || upper.includes('MOUSE')) return BT_CATEGORY_MAP['Pointer'];
  if (upper.includes('WATCH')) return BT_CATEGORY_MAP['Watch'];
  if (upper.includes('WEARABLE')) return BT_CATEGORY_MAP['Wearable'];
  if (upper.includes('LAPTOP')) return BT_CATEGORY_MAP['Laptop'];
  if (upper.includes('DESKTOP')) return BT_CATEGORY_MAP['Desktop'];
  if (upper.includes('COMPUTER')) return BT_CATEGORY_MAP['Computer'];
  if (upper.includes('HEALTH') || upper.includes('PULSE') || upper.includes('GLUCOSE') || upper.includes('SCALE')) return BT_CATEGORY_MAP['Health'];
  if (upper.includes('CONTROLLER') || upper.includes('GAME') || upper.includes('TOY')) return BT_CATEGORY_MAP['Toy'];
  if (upper.includes('VEHICLE')) return BT_CATEGORY_MAP['Vehicle'];
  if (upper.includes('MISC')) return BT_CATEGORY_MAP['Misc'];
  if (upper.includes('UNCATEGORIZED')) return BT_CATEGORY_MAP['Uncategorized'];

  // 2. Fallback to device class number from frequency / channel (e.g. 7936, 1344, 1028, 524)
  if (frequencyOrChannel) {
    const num = typeof frequencyOrChannel === 'number' ? frequencyOrChannel : parseInt(String(frequencyOrChannel).trim(), 10);
    if (!isNaN(num) && BT_DEVICE_TYPE_LEGEND[num]) {
      const typeName = BT_DEVICE_TYPE_LEGEND[num];
      if (BT_CATEGORY_MAP[typeName]) {
        return BT_CATEGORY_MAP[typeName];
      }
    }
  }

  // Default fallback
  return BT_CATEGORY_MAP['Uncategorized'];
}

/**
 * Analyzes BD_ADDR to determine Public vs Random / Private address type
 * according to Bluetooth Core Specification Vol 6 Part B Sec 1.3.2.
 */
export function getBtAddressType(mac: string): {
  type: 'PUBLIC' | 'STATIC_RANDOM' | 'RESOLVABLE_PRIVATE' | 'NON_RESOLVABLE_PRIVATE';
  labelEn: string;
  labelFr: string;
} {
  if (!mac || mac.length < 2) {
    return { type: 'PUBLIC', labelEn: 'Public Address', labelFr: 'Adresse Publique' };
  }

  try {
    const firstOctetHex = mac.replace(/[:-]/g, '').substring(0, 2);
    const firstByte = parseInt(firstOctetHex, 16);
    const top2 = (firstByte >> 6) & 0x03;

    if (top2 === 0b11) {
      return {
        type: 'STATIC_RANDOM',
        labelEn: 'Static Random Address',
        labelFr: 'Adresse Aléatoire Statique',
      };
    } else if (top2 === 0b01) {
      return {
        type: 'RESOLVABLE_PRIVATE',
        labelEn: 'Resolvable Private Address (RPA / Anti-Tracking)',
        labelFr: 'Adresse Privée Résoluble (RPA / Anti-Pistage)',
      };
    } else if (top2 === 0b00) {
      return {
        type: 'NON_RESOLVABLE_PRIVATE',
        labelEn: 'Non-Resolvable Private Address',
        labelFr: 'Adresse Privée Non-Résoluble',
      };
    } else {
      return {
        type: 'PUBLIC',
        labelEn: 'Public IEEE Address',
        labelFr: 'Adresse Publique IEEE',
      };
    }
  } catch {
    return { type: 'PUBLIC', labelEn: 'Public Address', labelFr: 'Adresse Publique' };
  }
}

/**
 * Backward compatibility alias for category resolution
 */
export const getBluetoothCategoryInfo = resolveBtCategory;
