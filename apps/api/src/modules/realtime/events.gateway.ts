import {
  Inject,
  Injectable,
  Logger,
  forwardRef,
} from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { ConfigService } from '@nestjs/config';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import {
  DriverLocationEvent,
  DriverStatusEvent,
  RequestAssignedEvent,
  RequestCancelledEvent,
  RequestCreatedEvent,
  RequestExpiredEvent,
  RequestOfferedEvent,
} from '@fleet-pulse/shared';
import { OfferCascadeService } from './cascade/offer-cascade.service';

export interface AuthenticatedSocketData {
  userId: string;
  role: 'admin' | 'dispatcher' | 'driver';
  driverId?: string;
}

@Injectable()
@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
})
export class EventsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(EventsGateway.name);
  private readonly driverLastBroadcastTime = new Map<string, number>();

  constructor(
    private readonly configService: ConfigService,
    @Inject(forwardRef(() => OfferCascadeService))
    private readonly offerCascadeService: OfferCascadeService,
  ) {}

  afterInit(_server: Server) {
    this.logger.log('Realtime Socket.IO Gateway initialized');
  }

  async handleConnection(socket: Socket) {
    try {
      const authHeader =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization ||
        socket.handshake.query?.token;

      if (!authHeader || typeof authHeader !== 'string') {
        this.logger.warn(`Socket connection rejected: No token provided (${socket.id})`);
        socket.disconnect(true);
        return;
      }

      const token = authHeader.startsWith('Bearer ')
        ? authHeader.slice(7)
        : authHeader;

      const secret =
        this.configService.get<string>('JWT_SECRET') ||
        'fleetpulse-dev-jwt-access-secret-minimum-32-chars-long';

      const decoded = jwt.verify(token, secret) as jwt.JwtPayload;

      const role = (decoded.role || 'dispatcher') as 'admin' | 'dispatcher' | 'driver';
      const driverId = (decoded.driverId || undefined) as string | undefined;
      const userId = (decoded.sub || decoded.id || socket.id) as string;

      socket.data = {
        userId,
        role,
        driverId,
      } as AuthenticatedSocketData;

      if (role === 'admin' || role === 'dispatcher') {
        await socket.join('dispatchers');
        this.logger.log(`Dispatcher socket ${socket.id} joined 'dispatchers' room`);
      } else if (role === 'driver' && driverId) {
        const driverRoom = `driver:${driverId}`;
        await socket.join(driverRoom);
        this.logger.log(`Driver socket ${socket.id} joined '${driverRoom}' room`);
      } else {
        await socket.join('dispatchers');
      }
    } catch (err) {
      this.logger.warn(`Socket authentication failed (${socket.id}): ${err}`);
      socket.disconnect(true);
    }
  }

  async handleDisconnect(socket: Socket) {
    const data = socket.data as AuthenticatedSocketData | undefined;
    if (data?.role === 'driver' && data?.driverId) {
      this.logger.warn(`Driver ${data.driverId} disconnected from socket ${socket.id}`);
      this.driverLastBroadcastTime.delete(data.driverId);
      // Treat unexpected disconnect during an offer as a reject and cascade
      try {
        await this.offerCascadeService.handleDriverDisconnect(data.driverId);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Error in driver disconnect handler (${data.driverId}): ${msg}`);
      }
    }
  }

  /**
   * Broadcasts driver location to 'dispatchers' room.
   * Throttled to at most once per second per driver.
   */
  broadcastDriverLocation(event: DriverLocationEvent): boolean {
    if (!this.server) return false;

    const now = Date.now();
    const lastBroadcast = this.driverLastBroadcastTime.get(event.driverId) || 0;

    if (now - lastBroadcast < 1000) {
      // Suppress broadcast: throttled (< 1 sec)
      return false;
    }

    this.driverLastBroadcastTime.set(event.driverId, now);
    this.server.to('dispatchers').emit('driver:location', event);
    return true;
  }

  /**
   * Broadcasts driver status change to 'dispatchers' room.
   */
  broadcastDriverStatus(event: DriverStatusEvent): void {
    if (!this.server) return;
    this.server.to('dispatchers').emit('driver:status', event);
  }

  /**
   * Broadcasts newly created delivery request to 'dispatchers' room.
   */
  broadcastRequestCreated(event: RequestCreatedEvent): void {
    if (!this.server) return;
    this.server.to('dispatchers').emit('request:created', event);
  }

  /**
   * Emits an offer to the specific driver's private room and notifies dispatchers.
   */
  emitRequestOffered(driverId: string, event: RequestOfferedEvent): void {
    if (!this.server) return;
    const driverRoom = `driver:${driverId}`;
    this.server.to(driverRoom).emit('request:offered', event);
    this.server.to('dispatchers').emit('request:offered', event);
  }

  /**
   * Broadcasts that a request was successfully assigned.
   */
  broadcastRequestAssigned(event: RequestAssignedEvent): void {
    if (!this.server) return;
    const driverRoom = `driver:${event.driverId}`;
    this.server.to(driverRoom).emit('request:assigned', event);
    this.server.to('dispatchers').emit('request:assigned', event);
  }

  /**
   * Broadcasts that a request expired after all cascade attempts failed.
   */
  broadcastRequestExpired(event: RequestExpiredEvent): void {
    if (!this.server) return;
    this.server.to('dispatchers').emit('request:expired', event);
  }

  /**
   * Emits cancellation to a driver's room.
   */
  emitRequestCancelled(driverId: string, event: RequestCancelledEvent): void {
    if (!this.server) return;
    const driverRoom = `driver:${driverId}`;
    this.server.to(driverRoom).emit('request:cancelled', event);
    this.server.to('dispatchers').emit('request:cancelled', event);
  }
}
