import { describe, expect, it } from 'vitest';
import { haversineKm, etaMinutes, type Coordinates } from './geo';

describe('haversineKm (Earth radius 6371 km)', () => {
  it('returns 0 for identical coordinates', () => {
    const point: Coordinates = { lat: 12.9716, lng: 77.5946 };
    expect(haversineKm(point, point)).toBe(0);
  });

  it('calculates known city pairs within tolerance', () => {
    // Bengaluru to Chennai: ~290.4 km
    const bengaluru: Coordinates = { lat: 12.9716, lng: 77.5946 };
    const chennai: Coordinates = { lat: 13.0827, lng: 80.2707 };
    const distBlrChn = haversineKm(bengaluru, chennai);
    expect(distBlrChn).toBeGreaterThan(288);
    expect(distBlrChn).toBeLessThan(292);
    expect(Math.round(distBlrChn)).toBe(290);

    // London to Paris: ~343.5 km
    const london: Coordinates = { lat: 51.5074, lng: -0.1278 };
    const paris: Coordinates = { lat: 48.8566, lng: 2.3522 };
    const distLonPar = haversineKm(london, paris);
    expect(distLonPar).toBeGreaterThan(340);
    expect(distLonPar).toBeLessThan(346);

    // New York to Los Angeles: ~3936 km
    const newYork: Coordinates = { lat: 40.7128, lng: -74.006 };
    const losAngeles: Coordinates = { lat: 34.0522, lng: -118.2437 };
    const distNyLa = haversineKm(newYork, losAngeles);
    expect(distNyLa).toBeGreaterThan(3930);
    expect(distNyLa).toBeLessThan(3950);
  });

  it('calculates antipodal points accurately (half Earth circumference ~20015 km)', () => {
    const p1: Coordinates = { lat: 0, lng: 0 };
    const p2: Coordinates = { lat: 0, lng: 180 };
    const antipodalDistance = haversineKm(p1, p2);
    const expected = Math.PI * 6371; // ~20015.087 km
    expect(antipodalDistance).toBeCloseTo(expected, -1);
  });

  it('correctly handles crossing the International Date Line', () => {
    // (0, 179) to (0, -179) is only 2 degrees of longitude (~222.4 km), NOT 358 degrees
    const westOfDateLine: Coordinates = { lat: 0, lng: 179 };
    const eastOfDateLine: Coordinates = { lat: 0, lng: -179 };
    const distDateLine1 = haversineKm(westOfDateLine, eastOfDateLine);
    expect(distDateLine1).toBeGreaterThan(221);
    expect(distDateLine1).toBeLessThan(224);

    // Reverse direction: (0, -179) to (0, 179) where delta is -358
    const distDateLine2 = haversineKm(eastOfDateLine, westOfDateLine);
    expect(distDateLine2).toBeCloseTo(distDateLine1, 5);

    // Same test with latitude offset
    const p1: Coordinates = { lat: 10, lng: 179.5 };
    const p2: Coordinates = { lat: 10, lng: -179.5 };
    const distOffset = haversineKm(p1, p2);
    expect(distOffset).toBeGreaterThan(108);
    expect(distOffset).toBeLessThan(112);
  });

  it('correctly calculates polar distances', () => {
    // North pole to South pole
    const northPole: Coordinates = { lat: 90, lng: 0 };
    const southPole: Coordinates = { lat: -90, lng: 0 };
    expect(haversineKm(northPole, southPole)).toBeCloseTo(Math.PI * 6371, -1);

    // Any two points at the same pole must have 0 distance regardless of longitude
    const poleP1: Coordinates = { lat: 90, lng: 45 };
    const poleP2: Coordinates = { lat: 90, lng: -135 };
    expect(haversineKm(poleP1, poleP2)).toBe(0);
  });

  describe('input coordinate validation', () => {
    it('throws on latitude > 90', () => {
      expect(() => haversineKm({ lat: 91, lng: 0 }, { lat: 0, lng: 0 })).toThrowError(
        /Latitude must be between -90 and 90/,
      );
    });

    it('throws on latitude < -90', () => {
      expect(() => haversineKm({ lat: 0, lng: 0 }, { lat: -90.1, lng: 0 })).toThrowError(
        /Latitude must be between -90 and 90/,
      );
    });

    it('throws on longitude > 180', () => {
      expect(() => haversineKm({ lat: 0, lng: 180.5 }, { lat: 0, lng: 0 })).toThrowError(
        /Longitude must be between -180 and 180/,
      );
    });

    it('throws on longitude < -180', () => {
      expect(() => haversineKm({ lat: 0, lng: 0 }, { lat: 0, lng: -181 })).toThrowError(
        /Longitude must be between -180 and 180/,
      );
    });

    it('throws on NaN or Infinite coordinates', () => {
      expect(() => haversineKm({ lat: NaN, lng: 0 }, { lat: 0, lng: 0 })).toThrow();
      expect(() => haversineKm({ lat: 0, lng: Infinity }, { lat: 0, lng: 0 })).toThrow();
    });
  });
});

describe('etaMinutes', () => {
  it('returns 0 for 0 km distance', () => {
    expect(etaMinutes(0, 30)).toBe(0);
  });

  it('calculates travel duration correctly with default average speed (30 km/h)', () => {
    // 15 km at 30 km/h = 0.5 hours = 30 minutes
    expect(etaMinutes(15)).toBe(30);

    // 10 km at 30 km/h = 20 minutes
    expect(etaMinutes(10)).toBe(20);
  });

  it('calculates travel duration with custom average speed', () => {
    // 60 km at 60 km/h = 60 minutes
    expect(etaMinutes(60, 60)).toBe(60);

    // 100 km at 50 km/h = 120 minutes
    expect(etaMinutes(100, 50)).toBe(120);
  });

  it('throws on invalid inputs', () => {
    expect(() => etaMinutes(-5, 30)).toThrowError(/Distance cannot be negative/);
    expect(() => etaMinutes(10, 0)).toThrowError(/Average speed must be greater than zero/);
    expect(() => etaMinutes(10, -20)).toThrowError(/Average speed must be greater than zero/);
  });
});
