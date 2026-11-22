import { Socket } from 'socket.io-client';

export const BENGALURU_BOUNDS = {
  MIN_LAT: 12.834,
  MAX_LAT: 13.144,
  MIN_LNG: 77.46,
  MAX_LNG: 77.744,
};

export interface Hotspot {
  name: string;
  lat: number;
  lng: number;
  weight: number;
}

export const BENGALURU_HOTSPOTS: readonly Hotspot[] = [
  { name: 'Koramangala', lat: 12.9352, lng: 77.6245, weight: 1.5 },
  { name: 'Indiranagar', lat: 12.9784, lng: 77.6408, weight: 1.5 },
  { name: 'Whitefield', lat: 12.9698, lng: 77.75, weight: 1.2 },
  { name: 'HSR Layout', lat: 12.9121, lng: 77.6446, weight: 1.2 },
  { name: 'Electronic City', lat: 12.8452, lng: 77.6602, weight: 1.0 },
  { name: 'MG Road', lat: 12.9756, lng: 77.6066, weight: 1.4 },
  { name: 'Bellandur', lat: 12.9304, lng: 77.6784, weight: 1.3 },
  { name: 'Malleshwaram', lat: 13.0031, lng: 77.5643, weight: 1.0 },
  { name: 'Jayanagar', lat: 12.9308, lng: 77.5838, weight: 1.0 },
  { name: 'Hebbal', lat: 13.0358, lng: 77.597, weight: 1.1 },
];

export interface ActiveSimTrip {
  requestId: string;
  pickupLat: number;
  pickupLng: number;
  dropLat: number;
  dropLng: number;
  phase: 'to_pickup' | 'to_dropoff';
}

export interface SimDriverAgent {
  id: string;
  name: string;
  phone: string;
  lat: number;
  lng: number;
  heading: number; // 0 - 360 degrees
  speedKmh: number; // 20 - 50 km/h
  status: 'available' | 'busy' | 'offline';
  socket?: Socket;
  currentTrip?: ActiveSimTrip | null;
  lastMovedAt: number;
}

export interface SimulatorConfig {
  driverCount: number;
  speedMultiplier: number;
  requestRatePerMinute: number;
  acceptProbability: number;
  seed?: number;
  durationSeconds?: number;
  apiUrl?: string;
  socketUrl?: string;
}

export interface SimulatorStats {
  running: boolean;
  driverCount: number;
  speedMultiplier: number;
  elapsedSeconds: number;
  requestsCreated: number;
  requestsAssigned: number;
  requestsCompleted: number;
  requestsExpired: number;
  requestsCancelled: number;
  doubleAssignmentsDetected: number;
  availableDrivers: number;
  busyDrivers: number;
}
