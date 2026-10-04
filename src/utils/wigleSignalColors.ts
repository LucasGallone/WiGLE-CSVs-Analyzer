export interface WigleSignalTier {
  tier: number;
  labelFr: string;
  labelEn: string;
  hex: string;
  borderHex: string;
  rgb: [number, number, number];
  badgeClasses: string;
  textClass: string;
}

/**
 * Spécifications des couleurs selon les valeurs dBm :
 * 1. Plus fort que -50 dBm (> -50 dBm) : Vert très foncé
 * 2. De -50 à -59 dBm : Vert foncé
 * 3. De -60 à -69 dBm : Vert
 * 4. De -70 à -79 dBm : Jaune/Orange
 * 5. De -80 à -89 dBm : Rouge
 * 6. De -90 à -99 dBm : Rouge foncé
 * 7. Moins de -100 dBm (≤ -100 dBm) : Rouge très foncé
 */
export function getWigleSignalTier(rssi: number): WigleSignalTier {
  if (rssi > -50) {
    return {
      tier: 1,
      labelFr: 'Excellent',
      labelEn: 'Excellent',
      hex: '#059669', // Vert émeraude franc (emerald-600)
      borderHex: '#047857',
      rgb: [5, 150, 105],
      badgeClasses:
        'bg-emerald-600 dark:bg-emerald-700 text-white border-emerald-700 dark:border-emerald-600 font-extrabold shadow-xs',
      textClass: 'text-emerald-600 dark:text-emerald-400',
    };
  }

  if (rssi >= -59) {
    return {
      tier: 2,
      labelFr: 'Très bon',
      labelEn: 'Very Good',
      hex: '#15803d', // Vert foncé (green-700)
      borderHex: '#166534',
      rgb: [21, 128, 61],
      badgeClasses:
        'bg-green-100 dark:bg-green-950/80 text-green-900 dark:text-green-300 border-green-600 dark:border-green-600 font-bold',
      textClass: 'text-green-700 dark:text-green-400',
    };
  }

  if (rssi >= -69) {
    return {
      tier: 3,
      labelFr: 'Bon',
      labelEn: 'Good',
      hex: '#22c55e', // Vert (green-500)
      borderHex: '#16a34a',
      rgb: [34, 197, 94],
      badgeClasses:
        'bg-green-50 dark:bg-green-950/50 text-green-800 dark:text-green-300 border-green-400 dark:border-green-500 font-bold',
      textClass: 'text-green-600 dark:text-green-400',
    };
  }

  if (rssi >= -79) {
    return {
      tier: 4,
      labelFr: 'Moyen',
      labelEn: 'Fair',
      hex: '#f59e0b', // Jaune/Orange (amber-500)
      borderHex: '#d97706',
      rgb: [245, 158, 11],
      badgeClasses:
        'bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-300 border-amber-400 dark:border-amber-600 font-bold',
      textClass: 'text-amber-600 dark:text-amber-400',
    };
  }

  if (rssi >= -89) {
    return {
      tier: 5,
      labelFr: 'Faible',
      labelEn: 'Weak',
      hex: '#ef4444', // Rouge (red-500)
      borderHex: '#dc2626',
      rgb: [239, 68, 68],
      badgeClasses:
        'bg-red-100 dark:bg-red-950/80 text-red-800 dark:text-red-300 border-red-400 dark:border-red-600 font-bold',
      textClass: 'text-red-600 dark:text-red-400',
    };
  }

  if (rssi >= -99) {
    return {
      tier: 6,
      labelFr: 'Très faible',
      labelEn: 'Very Weak',
      hex: '#b91c1c', // Rouge foncé (red-700)
      borderHex: '#991b1b',
      rgb: [185, 28, 28],
      badgeClasses:
        'bg-red-200 dark:bg-red-950 text-red-900 dark:text-red-200 border-red-600 dark:border-red-700 font-bold',
      textClass: 'text-red-700 dark:text-red-300',
    };
  }

  // Moins de -100 dBm (≤ -100 dBm) : Rouge très foncé
  return {
    tier: 7,
    labelFr: 'Extrêmement faible',
    labelEn: 'Extremely Weak',
    hex: '#7f1d1d', // Rouge très foncé (red-900)
    borderHex: '#450a0a',
    rgb: [127, 29, 29],
    badgeClasses:
      'bg-red-300/80 dark:bg-red-950 text-red-950 dark:text-red-100 border-red-800 dark:border-red-800 font-extrabold',
    textClass: 'text-red-900 dark:text-red-200',
  };
}
