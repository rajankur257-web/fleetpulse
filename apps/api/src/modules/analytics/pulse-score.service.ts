import { Injectable } from '@nestjs/common';
import { DriverStatus, PulseScoreResult, haversineKm } from '@fleet-pulse/shared';

export interface DriverScoreContext {
  id: string;
  name: string;
  status: string;
  rating: number;
  lat: number;
  lng: number;
  dailyTrips?: number;
  lastLocationAt?: Date | null;
}

export interface DriverStatsContext {
  acceptedOffers: number;
  rejectedOffers: number;
}

export interface DemandHotspotContext {
  lat: number;
  lng: number;
  weight: number;
}

@Injectable()
export class PulseScoreService {
  /**
   * Calculates a multi-factor Driver Pulse Score (0 to 100) based on:
   * 1. Acceptance rate (40% weight)
   * 2. Idle time & activity status (35% weight)
   * 3. Proximity to current demand hotspots (25% weight)
   */
  calculateDriverScore(
    driver: DriverScoreContext,
    stats: DriverStatsContext,
    demandHotspots: DemandHotspotContext[],
  ): PulseScoreResult {
    // 1. Acceptance Score (0 - 100)
    const totalOffers = stats.acceptedOffers + stats.rejectedOffers;
    const acceptanceRate =
      totalOffers > 0 ? stats.acceptedOffers / totalOffers : 1.0;
    const acceptanceScore = Math.round(acceptanceRate * 100);

    // 2. Idle / Activity Score (0 - 100)
    let idleScore = 100;
    if (driver.status === DriverStatus.OFFLINE) {
      idleScore = 0;
    } else if (driver.status === DriverStatus.BUSY) {
      idleScore = 100;
    } else {
      // Driver is AVAILABLE: inspect idle minutes
      const now = Date.now();
      const lastActive = driver.lastLocationAt
        ? new Date(driver.lastLocationAt).getTime()
        : now;
      const idleMinutes = Math.max(0, (now - lastActive) / 60000);

      if (idleMinutes <= 10) {
        idleScore = 100;
      } else {
        // Decrease by 1.6 points per minute beyond 10 mins down to minimum 20
        idleScore = Math.max(20, Math.round(100 - (idleMinutes - 10) * 1.6));
      }
    }

    // 3. Proximity to Demand Score (0 - 100)
    let proximityScore = 50;
    if (demandHotspots.length > 0 && driver.status !== DriverStatus.OFFLINE) {
      let minDistanceKm = Infinity;
      for (const spot of demandHotspots) {
        const dist = haversineKm(
          { lat: driver.lat, lng: driver.lng },
          { lat: spot.lat, lng: spot.lng },
        );
        if (dist < minDistanceKm) {
          minDistanceKm = dist;
        }
      }

      if (minDistanceKm <= 2.0) {
        proximityScore = 100;
      } else if (minDistanceKm <= 5.0) {
        proximityScore = 85;
      } else if (minDistanceKm <= 10.0) {
        proximityScore = 65;
      } else if (minDistanceKm <= 15.0) {
        proximityScore = 45;
      } else {
        proximityScore = Math.max(10, Math.round(100 - minDistanceKm * 4));
      }
    }

    // Weighted composite Pulse Score (0 - 100)
    const rawPulseScore =
      0.4 * acceptanceScore + 0.35 * idleScore + 0.25 * proximityScore;
    const pulseScore = Math.max(0, Math.min(100, Math.round(rawPulseScore)));

    return {
      driverId: driver.id,
      driverName: driver.name,
      pulseScore,
      components: {
        idleScore,
        acceptanceScore,
        proximityScore,
      },
      status: driver.status as DriverStatus,
      acceptanceRate: Math.round(acceptanceRate * 100) / 100,
      dailyTrips: driver.dailyTrips ?? 0,
      rating: driver.rating,
    };
  }
}
