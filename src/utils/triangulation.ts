import { ProcessedAccessPoint, AccessPointObservation } from '../types/wigle';

export interface TriangulatedPoint {
  lat: number;
  lng: number;
  rssi: number;
  weight: number;
  weightPercent: string;
  timestamp: string;
  accuracy?: number;
  distanceFromEstimatedMeters: number;
}

export interface TriangulationResult {
  hasMultiplePoints: boolean;
  pointCount: number;
  estimatedLat: number;
  estimatedLng: number;
  accuracyRadiusMeters: number;
  points: TriangulatedPoint[];
  strongestRssi: number;
  weakestRssi: number;
}

/**
 * Calculates distance in meters between two GPS coordinates using the Haversine formula.
 */
export function haversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Calculates RSSI-weighted triangulation / multilateration for an Access Point.
 * When multiple GPS readings are recorded with different RSSI signal levels,
 * closer/stronger readings receive exponential weighting (log-distance path loss inverse power).
 */
export function calculateTriangulation(ap: ProcessedAccessPoint): TriangulationResult {
  // Filter observations to valid GPS coordinates
  const validObs: AccessPointObservation[] = (ap.observations || []).filter(
    (obs) => obs.latitude !== 0 && obs.longitude !== 0 && !isNaN(obs.latitude) && !isNaN(obs.longitude)
  );

  // If observations are empty but ap has coordinates
  if (validObs.length === 0) {
    const lat = ap.latitude !== 0 ? ap.latitude : 0;
    const lng = ap.longitude !== 0 ? ap.longitude : 0;
    return {
      hasMultiplePoints: false,
      pointCount: lat !== 0 ? 1 : 0,
      estimatedLat: lat,
      estimatedLng: lng,
      accuracyRadiusMeters: ap.accuracyMeters || 15,
      points: lat !== 0 ? [
        {
          lat,
          lng,
          rssi: ap.bestRssi,
          weight: 1,
          weightPercent: '100%',
          timestamp: ap.firstSeen,
          distanceFromEstimatedMeters: 0,
        },
      ] : [],
      strongestRssi: ap.bestRssi,
      weakestRssi: ap.bestRssi,
    };
  }

  // Single valid detection
  if (validObs.length === 1) {
    const single = validObs[0];
    return {
      hasMultiplePoints: false,
      pointCount: 1,
      estimatedLat: single.latitude,
      estimatedLng: single.longitude,
      accuracyRadiusMeters: single.accuracy || ap.accuracyMeters || 15,
      points: [
        {
          lat: single.latitude,
          lng: single.longitude,
          rssi: single.rssi,
          weight: 1,
          weightPercent: '100%',
          timestamp: single.timestamp || ap.firstSeen,
          accuracy: single.accuracy,
          distanceFromEstimatedMeters: 0,
        },
      ],
      strongestRssi: single.rssi,
      weakestRssi: single.rssi,
    };
  }

  // Multiple detections: Calculate weighted centroid based on received RF power
  // Formula: weight = 10^((RSSI + 100) / 15)
  // Higher RSSI (e.g. -45 dBm) produces much higher weight than faint signals (-85 dBm)
  let totalWeight = 0;
  const rawPoints = validObs.map((obs) => {
    // Normalizing RSSI (clamped between -100 and -25)
    const clampedRssi = Math.min(-25, Math.max(-100, obs.rssi));
    const weight = Math.pow(10, (clampedRssi + 100) / 15);
    totalWeight += weight;
    return {
      obs,
      weight,
    };
  });

  let sumLat = 0;
  let sumLng = 0;

  rawPoints.forEach((p) => {
    sumLat += p.obs.latitude * p.weight;
    sumLng += p.obs.longitude * p.weight;
  });

  const estimatedLat = sumLat / (totalWeight || 1);
  const estimatedLng = sumLng / (totalWeight || 1);

  let maxDist = 0;
  let weightedDistSum = 0;
  let strongest = -120;
  let weakest = 0;

  const points: TriangulatedPoint[] = rawPoints.map((p) => {
    const dist = haversineDistanceMeters(
      estimatedLat,
      estimatedLng,
      p.obs.latitude,
      p.obs.longitude
    );
    if (dist > maxDist) maxDist = dist;
    weightedDistSum += dist * (p.weight / totalWeight);

    if (p.obs.rssi > strongest) strongest = p.obs.rssi;
    if (p.obs.rssi < weakest || weakest === 0) weakest = p.obs.rssi;

    const pct = ((p.weight / totalWeight) * 100).toFixed(1) + '%';

    return {
      lat: p.obs.latitude,
      lng: p.obs.longitude,
      rssi: p.obs.rssi,
      weight: p.weight,
      weightPercent: pct,
      timestamp: p.obs.timestamp,
      accuracy: p.obs.accuracy,
      distanceFromEstimatedMeters: dist,
    };
  });

  // Estimated radius of confidence (between weighted average distance and max distance)
  const accuracyRadiusMeters = Math.max(12, Math.min(maxDist, weightedDistSum * 1.5));

  return {
    hasMultiplePoints: true,
    pointCount: validObs.length,
    estimatedLat,
    estimatedLng,
    accuracyRadiusMeters,
    points,
    strongestRssi: strongest,
    weakestRssi: weakest,
  };
}
