import {
  DeliveryRequest,
  Driver,
  DriverStatus,
} from '@fleet-pulse/shared';
import { API_BASE_URL } from './constants';

export async function fetchDrivers(): Promise<Driver[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/drivers`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.data || data;
  } catch (err) {
    console.warn('[API] fetchDrivers failed:', err);
    return [];
  }
}

export async function fetchDriverById(driverId: string): Promise<Driver | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/drivers/${driverId}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.data || data;
  } catch (err) {
    console.warn(`[API] fetchDriverById(${driverId}) failed:`, err);
    return null;
  }
}

export async function updateDriverStatus(
  driverId: string,
  status: DriverStatus,
): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/drivers/${driverId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    return res.ok;
  } catch (err) {
    console.warn(`[API] updateDriverStatus failed:`, err);
    return false;
  }
}

export async function updateDriverLocation(
  driverId: string,
  lat: number,
  lng: number,
  heading?: number,
  speed?: number,
): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/drivers/${driverId}/location`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lat,
        lng,
        heading: heading !== undefined ? Math.round(heading) : undefined,
        speed: speed !== undefined ? Math.round(speed) : undefined,
      }),
    });
    return res.ok;
  } catch (err) {
    console.warn(`[API] updateDriverLocation failed:`, err);
    return false;
  }
}

export async function acceptOffer(
  requestId: string,
  driverId: string,
): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/offers/${requestId}/accept`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ driverId }),
    });
    return res.ok;
  } catch (err) {
    console.warn(`[API] acceptOffer failed:`, err);
    return false;
  }
}

export async function rejectOffer(
  requestId: string,
  driverId: string,
  reason = 'Driver manually declined offer',
): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/offers/${requestId}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ driverId, reason }),
    });
    return res.ok;
  } catch (err) {
    console.warn(`[API] rejectOffer failed:`, err);
    return false;
  }
}

export async function updateRequestStatus(
  requestId: string,
  status: 'picked_up' | 'delivered',
): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/requests/${requestId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    return res.ok;
  } catch (err) {
    console.warn(`[API] updateRequestStatus failed:`, err);
    return false;
  }
}

export async function fetchActiveTrip(
  driverId: string,
): Promise<DeliveryRequest | null> {
  try {
    const res = await fetch(
      `${API_BASE_URL}/api/v1/requests?assignedDriverId=${driverId}&status=assigned,picked_up`,
    );
    if (!res.ok) return null;
    const json = await res.json();
    const list = json.data || json;
    if (Array.isArray(list) && list.length > 0) {
      return list[0];
    }
    return null;
  } catch (err) {
    console.warn(`[API] fetchActiveTrip failed:`, err);
    return null;
  }
}
