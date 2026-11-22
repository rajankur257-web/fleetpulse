import { RepositioningService } from './repositioning.service';

describe('RepositioningService', () => {
  let service: RepositioningService;

  beforeEach(() => {
    service = new RepositioningService();
  });

  it('generates repositioning hints for high-demand clusters with low local driver supply', () => {
    const demandHotspots = [
      { name: 'Koramangala', lat: 12.9352, lng: 77.6245, weight: 1.5, pendingRequests: 8 },
      { name: 'Whitefield', lat: 12.9698, lng: 77.7499, weight: 1.2, pendingRequests: 2 },
    ];

    // Only 1 driver near Koramangala
    const drivers = [
      { id: 'd1', lat: 12.9350, lng: 77.6240, status: 'available' },
      { id: 'd2', lat: 12.9690, lng: 77.7490, status: 'available' },
      { id: 'd3', lat: 12.9695, lng: 77.7495, status: 'available' },
    ];

    const hints = service.generateRepositioningHints(demandHotspots, drivers);

    expect(hints.length).toBeGreaterThan(0);
    const koramangalaHint = hints.find((h) => h.zoneName === 'Koramangala');
    expect(koramangalaHint).toBeDefined();
    expect(koramangalaHint?.availableNearbyDrivers).toBe(1);
    expect(koramangalaHint?.recommendedRepositionCount).toBeGreaterThan(0);
    expect(koramangalaHint?.priority).toBe('high');
  });

  it('detects dead zones where requests wait beyond threshold seconds', () => {
    const now = Date.now();
    const staleRequests = [
      {
        id: 'r1',
        pickupLat: 13.0358,
        pickupLng: 77.5970, // Hebbal
        createdAt: new Date(now - 150 * 1000), // 150s wait > 120s threshold
        status: 'pending',
      },
      {
        id: 'r2',
        pickupLat: 13.0360,
        pickupLng: 77.5975,
        createdAt: new Date(now - 200 * 1000), // 200s wait
        status: 'pending',
      },
      {
        id: 'r3',
        pickupLat: 12.9716,
        pickupLng: 77.5946,
        createdAt: new Date(now - 30 * 1000), // 30s wait < 120s (not dead-zone)
        status: 'pending',
      },
    ];

    const alerts = service.detectDeadZones(staleRequests, 120);

    expect(alerts.length).toBeGreaterThan(0);
    const alert = alerts[0]!;
    expect(alert.pendingCount).toBe(2);
    expect(alert.maxWaitSeconds).toBeGreaterThanOrEqual(150);
    expect(alert.alertLevel).toBe('critical');
  });
});
