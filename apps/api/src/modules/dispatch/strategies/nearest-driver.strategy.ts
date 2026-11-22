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

@Injectable()
export class NearestDriverStrategy implements DispatchStrategy {
  readonly name = DispatchStrategyType.NEAREST;

  assign(
    request: DeliveryRequest,
    candidates: Driver[],
    context?: DispatchContext,
  ): Assignment | null {
    if (!candidates || candidates.length === 0) {
      return null;
    }

    const availableCandidates = candidates.filter(
      (driver) => driver.status === DriverStatus.AVAILABLE,
    );

    if (availableCandidates.length === 0) {
      return null;
    }

    let closestDriver: Driver | null = null;
    let minDistance = Infinity;

    const requestCoord = {
      lat: request.pickupLat,
      lng: request.pickupLng,
    };

    for (const driver of availableCandidates) {
      const distance = haversineKm(requestCoord, {
        lat: driver.lat,
        lng: driver.lng,
      });

      if (distance < minDistance) {
        minDistance = distance;
        closestDriver = driver;
      }
    }

    if (!closestDriver) {
      return null;
    }

    return {
      requestId: request.id,
      driverId: closestDriver.id,
      strategy: this.name,
      distanceKm: minDistance,
      assignedAt: context?.now ?? new Date(),
    };
  }
}
