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
