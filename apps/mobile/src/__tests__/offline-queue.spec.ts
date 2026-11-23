import { OfflineQueueService } from '../lib/offline-queue';

// Mock AsyncStorage
const mockStore: Record<string, string> = {};
jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(async (key: string, val: string) => {
    mockStore[key] = val;
  }),
  getItem: jest.fn(async (key: string) => {
    return mockStore[key] || null;
  }),
  removeItem: jest.fn(async (key: string) => {
    delete mockStore[key];
  }),
}));

describe('OfflineQueueService', () => {
  let queue: OfflineQueueService;

  beforeEach(async () => {
    for (const k in mockStore) delete mockStore[k];
    queue = new OfflineQueueService();
    await queue.clear();
  });

  it('enqueues telemetry location pings and tracks queue count', async () => {
    await queue.enqueue({
      type: 'LOCATION_PING',
      driverId: 'driver-1',
      lat: 12.9716,
      lng: 77.5946,
      heading: 90,
      speed: 35,
      timestamp: Date.now(),
    });

    await queue.enqueue({
      type: 'LOCATION_PING',
      driverId: 'driver-1',
      lat: 12.972,
      lng: 77.595,
      heading: 95,
      speed: 40,
      timestamp: Date.now(),
    });

    const count = await queue.getCount();
    expect(count).toBe(2);
  });

  it('enqueues status updates and respects capacity', async () => {
    await queue.enqueue({
      type: 'STATUS_UPDATE',
      driverId: 'driver-1',
      status: 'available',
      timestamp: Date.now(),
    });

    const count = await queue.getCount();
    expect(count).toBe(1);
  });

  it('flushes queued events sequentially when connection is restored', async () => {
    await queue.enqueue({
      type: 'LOCATION_PING',
      driverId: 'driver-1',
      lat: 12.9716,
      lng: 77.5946,
      timestamp: Date.now(),
    });
    await queue.enqueue({
      type: 'LOCATION_PING',
      driverId: 'driver-1',
      lat: 12.973,
      lng: 77.596,
      timestamp: Date.now(),
    });

    const sentItems: string[] = [];
    const result = await queue.flush(async (item) => {
      sentItems.push(item.type);
      return true;
    });

    expect(result.sent).toBe(2);
    expect(result.remaining).toBe(0);
    expect(sentItems.length).toBe(2);

    const remainingCount = await queue.getCount();
    expect(remainingCount).toBe(0);
  });

  it('stops flushing and preserves remaining items if a request fails', async () => {
    await queue.enqueue({
      type: 'LOCATION_PING',
      driverId: 'driver-1',
      lat: 12.9716,
      lng: 77.5946,
      timestamp: 1,
    });
    await queue.enqueue({
      type: 'LOCATION_PING',
      driverId: 'driver-1',
      lat: 12.972,
      lng: 77.595,
      timestamp: 2,
    });
    await queue.enqueue({
      type: 'LOCATION_PING',
      driverId: 'driver-1',
      lat: 12.973,
      lng: 77.596,
      timestamp: 3,
    });

    let attempt = 0;
    const result = await queue.flush(async () => {
      attempt++;
      if (attempt === 2) {
        return false; // Second item network failure
      }
      return true;
    });

    expect(result.sent).toBe(1);
    expect(result.remaining).toBe(2);

    const count = await queue.getCount();
    expect(count).toBe(2);
  });
});
