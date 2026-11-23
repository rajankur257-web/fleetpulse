import { io, Socket } from 'socket.io-client';
import {
  DriverLocationEvent,
  DriverStatus,
  DriverStatusEvent,
  RequestAssignedEvent,
  RequestCancelledEvent,
  RequestExpiredEvent,
  RequestOfferedEvent,
} from '@fleet-pulse/shared';
import { SOCKET_URL } from './constants';

export interface SocketEventHandlers {
  onConnect?: () => void;
  onDisconnect?: (reason: string) => void;
  onConnectError?: (err: Error) => void;
  onRequestOffered?: (event: RequestOfferedEvent) => void;
  onRequestAssigned?: (event: RequestAssignedEvent) => void;
  onRequestExpired?: (event: RequestExpiredEvent) => void;
  onRequestCancelled?: (event: RequestCancelledEvent) => void;
}

class MobileSocketManager {
  private socket: Socket | null = null;
  private currentToken: string | null = null;
  private handlers: SocketEventHandlers = {};

  connect(token: string, handlers: SocketEventHandlers = {}): Socket {
    if (this.socket && this.socket.connected && this.currentToken === token) {
      this.handlers = { ...this.handlers, ...handlers };
      return this.socket;
    }

    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    this.currentToken = token;
    this.handlers = handlers;

    this.socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      timeout: 15000,
    });

    this.socket.on('connect', () => {
      this.handlers.onConnect?.();
    });

    this.socket.on('disconnect', (reason) => {
      this.handlers.onDisconnect?.(reason);
    });

    this.socket.on('connect_error', (err) => {
      this.handlers.onConnectError?.(err);
    });

    // Realtime Dispatch Events
    this.socket.on('request:offered', (event: RequestOfferedEvent) => {
      this.handlers.onRequestOffered?.(event);
    });

    this.socket.on('request:assigned', (event: RequestAssignedEvent) => {
      this.handlers.onRequestAssigned?.(event);
    });

    this.socket.on('request:expired', (event: RequestExpiredEvent) => {
      this.handlers.onRequestExpired?.(event);
    });

    this.socket.on('request:cancelled', (event: RequestCancelledEvent) => {
      this.handlers.onRequestCancelled?.(event);
    });

    return this.socket;
  }

  setHandlers(handlers: Partial<SocketEventHandlers>) {
    this.handlers = { ...this.handlers, ...handlers };
  }

  emitLocation(event: DriverLocationEvent) {
    if (this.socket?.connected) {
      this.socket.emit('driver:location', event);
    }
  }

  emitStatus(event: DriverStatusEvent) {
    if (this.socket?.connected) {
      this.socket.emit('driver:status', event);
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.currentToken = null;
  }

  isConnected(): boolean {
    return !!this.socket?.connected;
  }
}

export const mobileSocket = new MobileSocketManager();
