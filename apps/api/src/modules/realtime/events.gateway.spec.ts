import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Server, Socket } from 'socket.io';
import { EventsGateway } from './events.gateway';
import { OfferCascadeService } from './cascade/offer-cascade.service';
import jwt from 'jsonwebtoken';

describe('EventsGateway (Unit)', () => {
  let gateway: EventsGateway;
  let mockOfferCascadeService: Partial<OfferCascadeService>;
  const jwtSecret = 'test-secret-at-least-32-characters-long';

  beforeEach(async () => {
    mockOfferCascadeService = {
      handleDriverDisconnect: jest.fn().mockResolvedValue(undefined),
    };

    const mockConfigService = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'JWT_SECRET') return jwtSecret;
        return null;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventsGateway,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: OfferCascadeService, useValue: mockOfferCascadeService },
      ],
    }).compile();

    gateway = module.get<EventsGateway>(EventsGateway);
    // Mock the socket server
    gateway.server = {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
    } as unknown as Server;
  });

  it('validates and authenticates dispatcher socket during connection', async () => {
    const token = jwt.sign(
      { sub: 'user-1', role: 'dispatcher' },
      jwtSecret,
    );

    const mockSocket = {
      id: 'sock-1',
      handshake: {
        auth: { token },
        headers: {},
      },
      join: jest.fn(),
      disconnect: jest.fn(),
      data: {},
    } as unknown as Socket;

    await gateway.handleConnection(mockSocket);

    expect(mockSocket.join).toHaveBeenCalledWith('dispatchers');
    expect(mockSocket.disconnect).not.toHaveBeenCalled();
    expect(mockSocket.data.role).toBe('dispatcher');
  });

  it('validates and authenticates driver socket and joins private driver room', async () => {
    const token = jwt.sign(
      { sub: 'user-driver', role: 'driver', driverId: 'd-100' },
      jwtSecret,
    );

    const mockSocket = {
      id: 'sock-driver',
      handshake: {
        auth: { token },
        headers: {},
      },
      join: jest.fn(),
      disconnect: jest.fn(),
      data: {},
    } as unknown as Socket;

    await gateway.handleConnection(mockSocket);

    expect(mockSocket.join).toHaveBeenCalledWith('driver:d-100');
    expect(mockSocket.disconnect).not.toHaveBeenCalled();
    expect(mockSocket.data.driverId).toBe('d-100');
  });

  it('rejects connection if JWT token is invalid or missing', async () => {
    const mockSocket = {
      id: 'sock-invalid',
      handshake: {
        auth: {},
        headers: {},
      },
      join: jest.fn(),
      disconnect: jest.fn(),
      data: {},
    } as unknown as Socket;

    await gateway.handleConnection(mockSocket);

    expect(mockSocket.disconnect).toHaveBeenCalledWith(true);
    expect(mockSocket.join).not.toHaveBeenCalled();
  });

  it('throttles location broadcasts to dispatchers room to at most 1/sec per driver', () => {
    const driverId = 'd-throttle-test';
    const locationPayload = {
      driverId,
      lat: 12.9716,
      lng: 77.5946,
      heading: 90,
      speed: 25,
      updatedAt: new Date().toISOString(),
    };

    // First broadcast: should emit
    const emitted1 = gateway.broadcastDriverLocation(locationPayload);
    expect(emitted1).toBe(true);
    expect(gateway.server.to).toHaveBeenCalledWith('dispatchers');
    expect(gateway.server.emit).toHaveBeenCalledWith('driver:location', locationPayload);

    // Immediate second broadcast (< 1000ms): should be throttled/suppressed
    const emitted2 = gateway.broadcastDriverLocation(locationPayload);
    expect(emitted2).toBe(false);

    // Another driver should NOT be throttled
    const otherDriverPayload = { ...locationPayload, driverId: 'd-other' };
    const emittedOther = gateway.broadcastDriverLocation(otherDriverPayload);
    expect(emittedOther).toBe(true);
  });

  it('calls handleDriverDisconnect when a driver socket disconnects', async () => {
    const mockSocket = {
      id: 'sock-disconnect',
      data: {
        driverId: 'd-disconnect-test',
        role: 'driver',
      },
    } as unknown as Socket;

    await gateway.handleDisconnect(mockSocket);

    expect(mockOfferCascadeService.handleDriverDisconnect).toHaveBeenCalledWith(
      'd-disconnect-test',
    );
  });
});
