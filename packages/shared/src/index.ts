// @fleet-pulse/shared entrypoint
export const FLEET_PULSE_VERSION = '0.1.0';

export enum DriverStatus {
  AVAILABLE = 'available',
  BUSY = 'busy',
  OFFLINE = 'offline',
}

export enum RequestStatus {
  PENDING = 'pending',
  OFFERED = 'offered',
  ASSIGNED = 'assigned',
  PICKED_UP = 'picked_up',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
  EXPIRED = 'expired',
}

export enum UserRole {
  ADMIN = 'admin',
  DISPATCHER = 'dispatcher',
  DRIVER = 'driver',
}
