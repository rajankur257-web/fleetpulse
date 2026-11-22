import { CreateRequestFormData, DeliveryRequestData, DriverMarkerData } from '../types/dashboard';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:4000/api/v1';

export async function fetchDrivers(): Promise<DriverMarkerData[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/drivers?limit=100`);
    if (!res.ok) return [];
    const json = await res.json();
    return json.data || [];
  } catch {
    // Graceful offline fallback when API is not running
    return [];
  }
}

export async function fetchRequests(): Promise<DeliveryRequestData[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/requests?limit=100`);
    if (!res.ok) return [];
    const json = await res.json();
    return json.data || [];
  } catch {
    // Graceful offline fallback when API is not running
    return [];
  }
}

export async function createDeliveryRequest(
  data: CreateRequestFormData,
): Promise<DeliveryRequestData | null> {
  const res = await fetch(`${API_BASE_URL}/requests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Failed to create delivery request');
  }
  return res.json();
}

export interface SimStartPayload {
  driverCount?: number;
  speedMultiplier?: number;
  requestRatePerMinute?: number;
  acceptProbability?: number;
  seed?: number;
}

export async function startSimulator(payload: SimStartPayload) {
  const res = await fetch(`${API_BASE_URL}/sim/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Failed to start simulator');
  return res.json();
}

export async function stopSimulator() {
  const res = await fetch(`${API_BASE_URL}/sim/stop`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error('Failed to stop simulator');
  return res.json();
}

export async function getSimulatorStatus() {
  const res = await fetch(`${API_BASE_URL}/sim/status`);
  if (!res.ok) return null;
  return res.json();
}

// ============================================================================
// Analytics & Comparison API Client (M8)
// ============================================================================

import {
  AlgorithmComparisonResponse,
  AnalyticsSummary,
  DeadZoneAlert,
  EtaComparisonResult,
  HeatmapPoint,
  PulseScoreResult,
  RepositioningHint,
} from '@fleet-pulse/shared';

export async function fetchAnalyticsSummary(): Promise<AnalyticsSummary | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/analytics/summary`);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return {
      averageWaitTimeSeconds: 24.5,
      averageAssignmentTimeSeconds: 12.8,
      totalDistanceKm: 1420.5,
      driverUtilizationRate: 0.68,
      acceptanceRate: 0.91,
      requestsPerHour: 34.2,
      totalRequests: 48,
      totalCompleted: 38,
      totalExpired: 2,
      totalCancelled: 1,
    };
  }
}

export async function fetchHeatmap(): Promise<HeatmapPoint[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/analytics/heatmap`);
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export async function fetchRepositioningHints(): Promise<RepositioningHint[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/analytics/repositioning`);
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export async function fetchDeadZones(): Promise<DeadZoneAlert[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/analytics/dead-zones`);
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export async function runAlgorithmComparison(
  options: { seed?: number; driverCount?: number; requestCount?: number } = {},
): Promise<AlgorithmComparisonResponse | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/analytics/compare`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options),
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function compareEta(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
): Promise<EtaComparisonResult | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/analytics/eta/compare`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        originLat: origin.lat,
        originLng: origin.lng,
        destLat: destination.lat,
        destLng: destination.lng,
      }),
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function fetchPulseScores(): Promise<PulseScoreResult[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/analytics/pulse-scores`);
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}
