import { DriverStatus, RequestStatus } from '@fleet-pulse/shared';

export interface DriverMarkerData {
  id: string;
  name: string;
  phone: string;
  lat: number;
  lng: number;
  heading: number;
  speed?: number;
  status: DriverStatus;
  rating: number;
  activeRequestId?: string | null;
  lastLocationAt?: string | null;
}

export interface DeliveryRequestData {
  id: string;
  pickupLat: number;
  pickupLng: number;
  dropLat: number;
  dropLng: number;
  status: RequestStatus;
  priority: number;
  assignedDriverId?: string | null;
  createdAt: string;
  assignedAt?: string | null;
  completedAt?: string | null;
}

export type SocketStatus = 'connected' | 'reconnecting' | 'disconnected';

export interface CreateRequestFormData {
  pickupLat: number;
  pickupLng: number;
  dropLat: number;
  dropLng: number;
  priority: number;
}
