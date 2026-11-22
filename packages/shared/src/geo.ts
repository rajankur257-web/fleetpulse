export interface Coordinates {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_KM = 6371;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function validateCoordinates(coords: Coordinates, label: string): void {
  if (
    typeof coords.lat !== 'number' ||
    typeof coords.lng !== 'number' ||
    !Number.isFinite(coords.lat) ||
    !Number.isFinite(coords.lng)
  ) {
    throw new TypeError(`Invalid ${label}: coordinates must be finite numbers.`);
  }

  if (coords.lat < -90 || coords.lat > 90) {
    throw new RangeError(
      `Invalid ${label}: Latitude must be between -90 and 90 degrees. Received: ${coords.lat}`,
    );
  }

  if (coords.lng < -180 || coords.lng > 180) {
    throw new RangeError(
      `Invalid ${label}: Longitude must be between -180 and 180 degrees. Received: ${coords.lng}`,
    );
  }
}

/**
 * Calculates the great-circle distance between two geographic coordinates on Earth
 * using the Haversine formula with a mean Earth radius of 6371 kilometers.
 *
 * @param a Origin coordinate { lat, lng }
 * @param b Destination coordinate { lat, lng }
 * @returns Distance in kilometers
 */
export function haversineKm(a: Coordinates, b: Coordinates): number {
  validateCoordinates(a, 'origin coordinate');
  validateCoordinates(b, 'destination coordinate');

  // Exact same point short-circuit
  if (a.lat === b.lat && a.lng === b.lng) {
    return 0;
  }

  // Same pole short-circuit (all longitudes meet at the pole)
  if (Math.abs(a.lat) === 90 && Math.abs(b.lat) === 90 && Math.sign(a.lat) === Math.sign(b.lat)) {
    return 0;
  }

  const lat1Rad = toRadians(a.lat);
  const lat2Rad = toRadians(b.lat);
  const dLatRad = toRadians(b.lat - a.lat);

  // Normalize delta longitude across the International Date Line (-180 to 180)
  let dLng = b.lng - a.lng;
  while (dLng > 180) dLng -= 360;
  while (dLng < -180) dLng += 360;
  const dLngRad = toRadians(dLng);

  const sinHalfLat = Math.sin(dLatRad / 2);
  const sinHalfLng = Math.sin(dLngRad / 2);

  const sinSquare =
    sinHalfLat * sinHalfLat +
    Math.cos(lat1Rad) * Math.cos(lat2Rad) * sinHalfLng * sinHalfLng;

  // Clamp sinSquare within [0, 1] to avoid NaN from floating point inaccuracies
  const clamped = Math.max(0, Math.min(1, sinSquare));
  const angularDistance = 2 * Math.atan2(Math.sqrt(clamped), Math.sqrt(1 - clamped));

  return EARTH_RADIUS_KM * angularDistance;
}

/**
 * Estimates travel duration in minutes based on distance and average speed.
 *
 * @param distanceKm Distance in kilometers
 * @param avgSpeedKmh Average speed in km/h (default: 30 km/h)
 * @returns Estimated minutes (rounded)
 */
export function etaMinutes(distanceKm: number, avgSpeedKmh = 30): number {
  if (distanceKm < 0 || !Number.isFinite(distanceKm)) {
    throw new RangeError(`Distance cannot be negative or non-finite. Received: ${distanceKm}`);
  }

  if (avgSpeedKmh <= 0 || !Number.isFinite(avgSpeedKmh)) {
    throw new RangeError(`Average speed must be greater than zero. Received: ${avgSpeedKmh}`);
  }

  if (distanceKm === 0) {
    return 0;
  }

  return Math.round((distanceKm / avgSpeedKmh) * 60);
}
