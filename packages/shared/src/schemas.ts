import { z } from 'zod';

// ============================================================================
// Enums from docs/CONTRACTS.md
// ============================================================================

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

export enum DispatchStrategyType {
  NEAREST = 'nearest',
  SCORED = 'scored',
  BATCH = 'batch',
}

export enum DispatchEventType {
  REQUEST_CREATED = 'request:created',
  REQUEST_OFFERED = 'request:offered',
  REQUEST_ASSIGNED = 'request:assigned',
  REQUEST_PICKED_UP = 'request:picked_up',
  REQUEST_DELIVERED = 'request:delivered',
  REQUEST_CANCELLED = 'request:cancelled',
  REQUEST_EXPIRED = 'request:expired',
  DRIVER_LOCATION = 'driver:location',
  DRIVER_STATUS = 'driver:status',
}

// ============================================================================
// Primitive & Domain Zod Schemas
// ============================================================================

export const CoordinatesSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export const DriverStatusSchema = z.nativeEnum(DriverStatus);
export const RequestStatusSchema = z.nativeEnum(RequestStatus);
export const UserRoleSchema = z.nativeEnum(UserRole);
export const DispatchStrategyTypeSchema = z.nativeEnum(DispatchStrategyType);

export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string().min(1),
  role: UserRoleSchema,
  driverId: z.string().uuid().nullable().optional(),
  createdAt: z.string().or(z.date()).optional(),
  updatedAt: z.string().or(z.date()).optional(),
});

export const DriverSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  phone: z.string().min(5),
  status: DriverStatusSchema,
  rating: z.number().min(0).max(5).default(5.0),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  lastLocationAt: z.string().or(z.date()).nullable().optional(),
  activeRequestId: z.string().uuid().nullable().optional(),
  dailyTrips: z.number().int().min(0).default(0),
  createdAt: z.string().or(z.date()).optional(),
  updatedAt: z.string().or(z.date()).optional(),
});

export const DeliveryRequestSchema = z.object({
  id: z.string().uuid(),
  pickupLat: z.number().min(-90).max(90),
  pickupLng: z.number().min(-180).max(180),
  dropLat: z.number().min(-90).max(90),
  dropLng: z.number().min(-180).max(180),
  status: RequestStatusSchema,
  priority: z.number().int().min(1).default(1),
  assignedDriverId: z.string().uuid().nullable().optional(),
  offeredAt: z.string().or(z.date()).nullable().optional(),
  assignedAt: z.string().or(z.date()).nullable().optional(),
  completedAt: z.string().or(z.date()).nullable().optional(),
  createdAt: z.string().or(z.date()).optional(),
  updatedAt: z.string().or(z.date()).optional(),
});

export const DispatchEventSchema = z.object({
  id: z.string().uuid(),
  requestId: z.string().uuid().nullable().optional(),
  driverId: z.string().uuid().nullable().optional(),
  type: z.string(),
  payload: z.record(z.unknown()),
  createdAt: z.string().or(z.date()).optional(),
});

// ============================================================================
// REST API Request DTO Schemas
// ============================================================================

export const CreateDeliveryRequestSchema = z.object({
  pickupLat: z.number().min(-90).max(90),
  pickupLng: z.number().min(-180).max(180),
  dropLat: z.number().min(-90).max(90),
  dropLng: z.number().min(-180).max(180),
  priority: z.number().int().min(1).max(5).default(1),
});

export const UpdateDriverLocationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  heading: z.number().min(0).max(360).optional(),
  speed: z.number().min(0).optional(),
});

export const UpdateDriverStatusSchema = z.object({
  status: DriverStatusSchema,
});

export const NearbyDriversQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radiusKm: z.coerce.number().positive().max(100).default(5),
});

export const AcceptOfferSchema = z.object({
  offerId: z.string().optional(),
});

export const RejectOfferSchema = z.object({
  reason: z.string().optional(),
});

// ============================================================================
// Socket.IO Payload Schemas
// ============================================================================

export const DriverLocationEventSchema = z.object({
  driverId: z.string(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  heading: z.number().optional(),
  speed: z.number().optional(),
  updatedAt: z.string().or(z.date()),
});

export const DriverStatusEventSchema = z.object({
  driverId: z.string(),
  status: DriverStatusSchema,
  activeRequestId: z.string().nullable().optional(),
});

export const RequestCreatedEventSchema = z.object({
  request: DeliveryRequestSchema,
});

export const RequestOfferedEventSchema = z.object({
  requestId: z.string(),
  driverId: z.string(),
  attempt: z.number().int().min(1),
  expiresAt: z.string().or(z.date()),
  timeoutSeconds: z.number().positive().default(20),
  pickupLat: z.number().optional(),
  pickupLng: z.number().optional(),
  dropLat: z.number().optional(),
  dropLng: z.number().optional(),
});

export const RequestAssignedEventSchema = z.object({
  requestId: z.string(),
  driverId: z.string(),
  assignedAt: z.string().or(z.date()),
});

export const RequestExpiredEventSchema = z.object({
  requestId: z.string(),
  reason: z.string(),
});

export const RequestCancelledEventSchema = z.object({
  requestId: z.string(),
  reason: z.string(),
});

// ============================================================================
// Dispatch Engine Interfaces
// ============================================================================

export interface DispatchCandidate {
  driver: z.infer<typeof DriverSchema>;
  distanceKm: number;
  score?: number;
  estimatedTimeUntilFreeMinutes?: number;
}

export interface DispatchContext {
  activeStrategy: DispatchStrategyType;
  weights?: {
    distance: number;
    rating: number;
    idleTime: number;
    dailyTrips: number;
  };
  now?: Date;
}

export interface Assignment {
  requestId: string;
  driverId: string;
  strategy: DispatchStrategyType;
  distanceKm: number;
  score?: number;
  assignedAt: Date;
}

export interface DispatchStrategy {
  readonly name: DispatchStrategyType;
  assign(
    request: z.infer<typeof DeliveryRequestSchema>,
    candidates: z.infer<typeof DriverSchema>[],
    context?: DispatchContext,
  ): Assignment | null;
}

// Inferred Types
export type User = z.infer<typeof UserSchema>;
export type Driver = z.infer<typeof DriverSchema>;
export type DeliveryRequest = z.infer<typeof DeliveryRequestSchema>;
export type DispatchEvent = z.infer<typeof DispatchEventSchema>;
export type CreateDeliveryRequestDto = z.infer<typeof CreateDeliveryRequestSchema>;
export type UpdateDriverLocationDto = z.infer<typeof UpdateDriverLocationSchema>;
export type UpdateDriverStatusDto = z.infer<typeof UpdateDriverStatusSchema>;
export type NearbyDriversQueryDto = z.infer<typeof NearbyDriversQuerySchema>;
export type DriverLocationEvent = z.infer<typeof DriverLocationEventSchema>;
export type DriverStatusEvent = z.infer<typeof DriverStatusEventSchema>;
export type RequestCreatedEvent = z.infer<typeof RequestCreatedEventSchema>;
export type RequestOfferedEvent = z.infer<typeof RequestOfferedEventSchema>;
export type RequestAssignedEvent = z.infer<typeof RequestAssignedEventSchema>;
export type RequestExpiredEvent = z.infer<typeof RequestExpiredEventSchema>;
export type RequestCancelledEvent = z.infer<typeof RequestCancelledEventSchema>;
