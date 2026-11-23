import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';
import { LOCATION_TASK_NAME } from './constants';
import { offlineQueue } from './offline-queue';
import { mobileSocket } from './socket';
import { storage } from './storage';

type LocationCallback = (location: Location.LocationObject) => void;
const subscribers = new Set<LocationCallback>();

export function subscribeToLocationUpdates(cb: LocationCallback): () => void {
  subscribers.add(cb);
  return () => subscribers.delete(cb);
}

// Define the Background Task with TaskManager
try {
  if (!TaskManager.isTaskDefined(LOCATION_TASK_NAME)) {
    TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
      if (error) {
        console.warn('[LocationTask] Background task error:', error);
        return;
      }
      if (data) {
        const { locations } = data as { locations: Location.LocationObject[] };
        const loc = locations[0];
        if (loc) {
          subscribers.forEach((cb) => {
            try {
              cb(loc);
            } catch (err) {
              console.warn('[LocationTask] subscriber callback failed:', err);
            }
          });

          // Send or buffer location update
          const driver = await storage.getDriver();
          if (driver) {
            const heading =
              typeof loc.coords.heading === 'number' && loc.coords.heading >= 0
                ? loc.coords.heading
                : undefined;
            const speed =
              typeof loc.coords.speed === 'number' && loc.coords.speed >= 0
                ? loc.coords.speed * 3.6
                : undefined;
            const payload = {
              driverId: driver.id,
              lat: loc.coords.latitude,
              lng: loc.coords.longitude,
              heading,
              speed,
              updatedAt: new Date().toISOString(),
            };

            if (mobileSocket.isConnected()) {
              mobileSocket.emitLocation(payload);
            } else {
              await offlineQueue.enqueue({
                type: 'LOCATION_PING',
                driverId: driver.id,
                lat: payload.lat,
                lng: payload.lng,
                heading: payload.heading,
                speed: payload.speed,
                timestamp: Date.now(),
              });
            }
          }
        }
      }
    });
  }
} catch (err) {
  console.warn('[LocationTask] Error defining background task:', err);
}

export class LocationTrackerService {
  private foregroundSubscription: Location.LocationSubscription | null = null;
  private isTracking = false;

  async requestPermissions(): Promise<{
    foreground: boolean;
    background: boolean;
  }> {
    // 1. Request Foreground Permissions first
    const fg = await Location.requestForegroundPermissionsAsync();
    if (fg.status !== Location.PermissionStatus.GRANTED) {
      return { foreground: false, background: false };
    }

    // 2. Request Background Permissions progressively (native only)
    if (Platform.OS !== 'web') {
      try {
        const bg = await Location.requestBackgroundPermissionsAsync();
        return {
          foreground: true,
          background: bg.status === Location.PermissionStatus.GRANTED,
        };
      } catch (err) {
        console.warn('[LocationTracker] BG permission request failed:', err);
        return { foreground: true, background: false };
      }
    }

    return { foreground: true, background: false };
  }

  async getCurrentPosition(): Promise<Location.LocationObject | null> {
    try {
      const { foreground } = await this.requestPermissions();
      if (!foreground) return null;
      return await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
    } catch (err) {
      console.warn('[LocationTracker] getCurrentPosition failed:', err);
      return null;
    }
  }

  async startTracking(
    mode: 'idle' | 'delivery' = 'idle',
    onLocationUpdate?: LocationCallback,
  ): Promise<boolean> {
    const { foreground, background } = await this.requestPermissions();
    if (!foreground) return false;

    if (onLocationUpdate) {
      subscribeToLocationUpdates(onLocationUpdate);
    }

    const accuracy =
      mode === 'delivery' ? Location.Accuracy.High : Location.Accuracy.Balanced;
    const timeInterval = mode === 'delivery' ? 5000 : 10000;
    const distanceInterval = 10;

    // Start background updates if supported
    if (background && Platform.OS !== 'web') {
      try {
        const hasStarted =
          await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
        if (hasStarted) {
          await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
        }

        await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
          accuracy,
          timeInterval,
          distanceInterval,
          showsBackgroundLocationIndicator: true,
          foregroundService: {
            notificationTitle: 'Fleet Pulse Active',
            notificationBody:
              mode === 'delivery'
                ? 'High-precision delivery tracking enabled.'
                : 'Vehicle available for dispatch.',
            notificationColor: '#10b981',
          },
        });
      } catch (err) {
        console.warn('[LocationTracker] Failed to start BG updates:', err);
      }
    }

    // Also start foreground watcher for immediate UI updates
    if (!this.foregroundSubscription) {
      try {
        this.foregroundSubscription = await Location.watchPositionAsync(
          {
            accuracy,
            timeInterval,
            distanceInterval,
          },
          (loc) => {
            subscribers.forEach((cb) => {
              try {
                cb(loc);
              } catch (e) {
                console.warn(e);
              }
            });
          },
        );
      } catch (err) {
        console.warn('[LocationTracker] Foreground watch failed:', err);
      }
    }

    this.isTracking = true;
    return true;
  }

  async stopTracking(): Promise<void> {
    if (this.foregroundSubscription) {
      this.foregroundSubscription.remove();
      this.foregroundSubscription = null;
    }

    if (Platform.OS !== 'web') {
      try {
        const hasStarted =
          await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
        if (hasStarted) {
          await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
        }
      } catch (err) {
        console.warn('[LocationTracker] Failed to stop BG updates:', err);
      }
    }

    this.isTracking = false;
  }

  isCurrentlyTracking(): boolean {
    return this.isTracking;
  }
}

export const locationTracker = new LocationTrackerService();
