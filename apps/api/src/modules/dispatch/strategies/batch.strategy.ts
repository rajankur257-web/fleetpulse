import { Injectable } from '@nestjs/common';
import {
  Assignment,
  DeliveryRequest,
  DispatchContext,
  DispatchStrategy,
  DispatchStrategyType,
  Driver,
  DriverStatus,
  haversineKm,
} from '@fleet-pulse/shared';
import { hungarianAlgorithm } from './hungarian';

@Injectable()
export class BatchStrategy implements DispatchStrategy {
  readonly name = DispatchStrategyType.BATCH;

  /**
   * Single assignment fallback delegating to batch solving
   */
  assign(
    request: DeliveryRequest,
    candidates: Driver[],
    context?: DispatchContext,
  ): Assignment | null {
    const results = this.assignBatch([request], candidates, context);
    return results.length > 0 && results[0] ? results[0] : null;
  }

  /**
   * Solves multi-driver multi-request global assignment minimizing total distance
   */
  assignBatch(
    requests: DeliveryRequest[],
    candidates: Driver[],
    context?: DispatchContext,
  ): Assignment[] {
    if (!requests || requests.length === 0 || !candidates || candidates.length === 0) {
      return [];
    }

    const availableDrivers = candidates.filter(
      (driver) => driver.status === DriverStatus.AVAILABLE,
    );

    if (availableDrivers.length === 0) {
      return [];
    }

    // Build cost matrix: costMatrix[reqIdx][driverIdx] = haversineKm
    const costMatrix: number[][] = [];
    for (let r = 0; r < requests.length; r++) {
      const row: number[] = [];
      const req = requests[r];
      if (!req) continue;

      const reqCoord = {
        lat: req.pickupLat,
        lng: req.pickupLng,
      };

      for (let d = 0; d < availableDrivers.length; d++) {
        const driver = availableDrivers[d];
        if (!driver) continue;

        const dist = haversineKm(reqCoord, {
          lat: driver.lat,
          lng: driver.lng,
        });
        row.push(dist);
      }
      costMatrix.push(row);
    }

    // Run Hungarian algorithm to find globally optimal assignment
    const matching = hungarianAlgorithm(costMatrix);
    const assignments: Assignment[] = [];
    const now = context?.now ?? new Date();

    for (let r = 0; r < requests.length; r++) {
      const req = requests[r];
      const driverIndex = matching[r];
      if (
        req &&
        driverIndex !== undefined &&
        driverIndex >= 0 &&
        driverIndex < availableDrivers.length
      ) {
        const assignedDriver = availableDrivers[driverIndex];
        const costRow = costMatrix[r];
        const distance = costRow && costRow[driverIndex] !== undefined ? costRow[driverIndex]! : 0;

        if (assignedDriver) {
          assignments.push({
            requestId: req.id,
            driverId: assignedDriver.id,
            strategy: this.name,
            distanceKm: distance,
            assignedAt: now,
          });
        }
      }
    }

    return assignments;
  }
}
