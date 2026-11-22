import { Injectable } from '@nestjs/common';
import {
  DeadZoneAlert,
  HeatmapPoint,
  RepositioningHint,
  haversineKm,
} from '@fleet-pulse/shared';
import { BENGALURU_HOTSPOTS } from '../simulator/simulator.types';

export interface HotspotDemandInput {
  name: string;
  lat: number;
  lng: number;
  weight: number;
  pendingRequests: number;
}

export interface DriverPositionInput {
  id: string;
  lat: number;
  lng: number;
  status: string;
}

export interface StaleRequestInput {
  id: string;
  pickupLat: number;
  pickupLng: number;
  createdAt: Date;
  status: string;
}

@Injectable()
export class RepositioningService {
  /**
   * Generates demand heatmap data points with intensity weights
   */
  generateHeatmapPoints(
    requests: Array<{ pickupLat: number; pickupLng: number; priority?: number }>,
  ): HeatmapPoint[] {
    const clusterMap = new Map<string, { lat: number; lng: number; count: number; weight: number }>();

    for (const req of requests) {
      // Cluster points with ~500m precision (0.005 degrees)
      const latKey = (Math.round(req.pickupLat / 0.005) * 0.005).toFixed(3);
      const lngKey = (Math.round(req.pickupLng / 0.005) * 0.005).toFixed(3);
      const key = `${latKey},${lngKey}`;

      const existing = clusterMap.get(key);
      const reqWeight = (req.priority || 1) * 1.0;

      if (existing) {
        existing.count++;
        existing.weight += reqWeight;
      } else {
        clusterMap.set(key, {
          lat: Number(latKey),
          lng: Number(lngKey),
          count: 1,
          weight: reqWeight,
        });
      }
    }

    // Include baseline commercial hotspots if demand is sparse
    if (clusterMap.size < 5) {
      for (const hub of BENGALURU_HOTSPOTS) {
        const key = `${hub.lat.toFixed(3)},${hub.lng.toFixed(3)}`;
        if (!clusterMap.has(key)) {
          clusterMap.set(key, {
            lat: hub.lat,
            lng: hub.lng,
            count: 2,
            weight: hub.weight,
          });
        }
      }
    }

    return Array.from(clusterMap.values()).map((c) => ({
      lat: c.lat,
      lng: c.lng,
      weight: Math.round(c.weight * 10) / 10,
      requestCount: c.count,
    }));
  }

  /**
   * Generates idle driver repositioning hints based on demand/supply imbalance
   */
  generateRepositioningHints(
    demandHotspots: HotspotDemandInput[],
    drivers: DriverPositionInput[],
  ): RepositioningHint[] {
    const hints: RepositioningHint[] = [];
    const availableDrivers = drivers.filter((d) => d.status === 'available');

    for (const hotspot of demandHotspots) {
      // Count available drivers within 3.0 km
      let nearbyCount = 0;
      for (const d of availableDrivers) {
        const dist = haversineKm(
          { lat: d.lat, lng: d.lng },
          { lat: hotspot.lat, lng: hotspot.lng },
        );
        if (dist <= 3.0) {
          nearbyCount++;
        }
      }

      const deficit = hotspot.pendingRequests - nearbyCount;
      if (deficit > 0) {
        const priority: 'low' | 'medium' | 'high' =
          deficit >= 4 ? 'high' : deficit >= 2 ? 'medium' : 'low';

        hints.push({
          zoneName: hotspot.name,
          lat: hotspot.lat,
          lng: hotspot.lng,
          demandWeight: hotspot.weight,
          availableNearbyDrivers: nearbyCount,
          recommendedRepositionCount: Math.min(10, deficit),
          priority,
        });
      }
    }

    // Sort hints by priority high to low, then deficit descending
    hints.sort((a, b) => {
      const pMap = { high: 3, medium: 2, low: 1 };
      if (pMap[a.priority] !== pMap[b.priority]) {
        return pMap[b.priority] - pMap[a.priority];
      }
      return b.recommendedRepositionCount - a.recommendedRepositionCount;
    });

    return hints;
  }

  /**
   * Detects dead-zone clusters where requests wait beyond the timeout threshold
   */
  detectDeadZones(
    requests: StaleRequestInput[],
    thresholdSeconds = 120,
  ): DeadZoneAlert[] {
    const now = Date.now();
    const staleRequests = requests.filter((r) => {
      if (r.status !== 'pending' && r.status !== 'offered') return false;
      const waitTime = (now - new Date(r.createdAt).getTime()) / 1000;
      return waitTime >= thresholdSeconds;
    });

    if (staleRequests.length === 0) {
      return [];
    }

    // Cluster stale requests within ~2.0 km of each other
    const clusters: Array<{
      lat: number;
      lng: number;
      requests: StaleRequestInput[];
      maxWait: number;
    }> = [];

    for (const req of staleRequests) {
      const waitTime = Math.round((now - new Date(req.createdAt).getTime()) / 1000);
      let matchedCluster = clusters.find(
        (c) =>
          haversineKm(
            { lat: c.lat, lng: c.lng },
            { lat: req.pickupLat, lng: req.pickupLng },
          ) <= 2.0,
      );

      if (matchedCluster) {
        matchedCluster.requests.push(req);
        matchedCluster.maxWait = Math.max(matchedCluster.maxWait, waitTime);
      } else {
        clusters.push({
          lat: req.pickupLat,
          lng: req.pickupLng,
          requests: [req],
          maxWait: waitTime,
        });
      }
    }

    return clusters.map((cluster, index) => {
      // Find nearest known hotspot name for readability
      let nearestName = `Zone #${index + 1}`;
      let minDist = Infinity;
      for (const hub of BENGALURU_HOTSPOTS) {
        const d = haversineKm({ lat: cluster.lat, lng: cluster.lng }, hub);
        if (d < minDist) {
          minDist = d;
          nearestName = hub.name;
        }
      }

      const alertLevel: 'warning' | 'critical' =
        cluster.maxWait >= thresholdSeconds * 1.5 || cluster.requests.length >= 3
          ? 'critical'
          : 'warning';

      return {
        zoneName: `${nearestName} Dead Zone`,
        lat: cluster.lat,
        lng: cluster.lng,
        pendingCount: cluster.requests.length,
        maxWaitSeconds: cluster.maxWait,
        alertLevel,
        message: `${cluster.requests.length} requests unassigned in ${nearestName} (max wait: ${Math.round(cluster.maxWait)}s). Immediate repositioning required.`,
      };
    });
  }
}
