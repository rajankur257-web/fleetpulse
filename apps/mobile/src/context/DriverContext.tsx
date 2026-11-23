import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import * as Haptics from 'expo-haptics';
import {
  DeliveryRequest,
  Driver,
  DriverStatus,
  RequestAssignedEvent,
  RequestOfferedEvent,
  RequestStatus,
  haversineKm,
} from '@fleet-pulse/shared';
import {
  acceptOffer,
  fetchActiveTrip,
  fetchDriverById,
  rejectOffer,
  updateDriverLocation,
  updateDriverStatus,
  updateRequestStatus,
} from '../lib/api';
import { BENGALURU_CENTER, OFFER_TIMEOUT_SECONDS } from '../lib/constants';
import {
  locationTracker,
  subscribeToLocationUpdates,
} from '../lib/location-tracker';
import { offlineQueue } from '../lib/offline-queue';
import { mobileSocket } from '../lib/socket';
import { storage } from '../lib/storage';

export interface DriverLocationState {
  lat: number;
  lng: number;
  heading?: number;
  speed?: number;
  accuracy?: number;
  updatedAt: string;
}

interface DriverContextType {
  driver: Driver | null;
  token: string | null;
  status: DriverStatus;
  isOnline: boolean;
  isTracking: boolean;
  currentCoords: DriverLocationState;
  activeTrip: DeliveryRequest | null;
  incomingOffer: RequestOfferedEvent | null;
  completedTrips: DeliveryRequest[];
  queueCount: number;
  isSocketConnected: boolean;
  login: (driver: Driver, token?: string) => Promise<void>;
  logout: () => Promise<void>;
  toggleOnline: (online: boolean) => Promise<void>;
  acceptIncomingOffer: () => Promise<boolean>;
  rejectIncomingOffer: (reason?: string) => Promise<boolean>;
  advanceTripStatus: () => Promise<boolean>;
  flushOfflineQueue: () => Promise<number>;
  simulateIncomingOffer: () => void;
}

const DriverContext = createContext<DriverContextType | null>(null);

export function DriverProvider({ children }: { children: React.ReactNode }) {
  const [driver, setDriver] = useState<Driver | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [status, setStatus] = useState<DriverStatus>(DriverStatus.OFFLINE);
  const [isSocketConnected, setIsSocketConnected] = useState(false);
  const [isTracking, setIsTracking] = useState(false);

  const [currentCoords, setCurrentCoords] = useState<DriverLocationState>({
    lat: BENGALURU_CENTER.lat,
    lng: BENGALURU_CENTER.lng,
    updatedAt: new Date().toISOString(),
  });

  const [incomingOffer, setIncomingOffer] = useState<RequestOfferedEvent | null>(
    null,
  );
  const [activeTrip, setActiveTrip] = useState<DeliveryRequest | null>(null);
  const [completedTrips, setCompletedTrips] = useState<DeliveryRequest[]>([]);
  const [queueCount, setQueueCount] = useState<number>(0);

  const offerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load Saved Auth Session & State on Mount
  useEffect(() => {
    async function restoreSession() {
      const savedDriver = await storage.getDriver();
      const savedToken = await storage.getToken();
      if (savedDriver) {
        setDriver(savedDriver);
        setStatus(savedDriver.status);
        setCurrentCoords({
          lat: savedDriver.lat,
          lng: savedDriver.lng,
          updatedAt: new Date().toISOString(),
        });
      }
      if (savedToken) {
        setToken(savedToken);
      }
      const count = await offlineQueue.getCount();
      setQueueCount(count);
    }
    restoreSession();
  }, []);

  // Sync Socket.IO Handlers
  useEffect(() => {
    if (!token || !driver) {
      mobileSocket.disconnect();
      setIsSocketConnected(false);
      return;
    }

    mobileSocket.connect(token, {
      onConnect: () => {
        setIsSocketConnected(true);
        // Refresh active trip upon connect
        fetchActiveTrip(driver.id).then((trip) => {
          if (trip) setActiveTrip(trip);
        });
      },
      onDisconnect: () => {
        setIsSocketConnected(false);
      },
      onRequestOffered: (event) => {
        // Trigger haptic feedback
        try {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch {
          // ignore
        }
        setIncomingOffer(event);

        if (offerTimerRef.current) clearTimeout(offerTimerRef.current);
        const timeoutMs = (event.timeoutSeconds || OFFER_TIMEOUT_SECONDS) * 1000;
        offerTimerRef.current = setTimeout(() => {
          setIncomingOffer(null);
        }, timeoutMs);
      },
      onRequestAssigned: (event: RequestAssignedEvent) => {
        setIncomingOffer(null);
        setStatus(DriverStatus.BUSY);
        // Refresh active delivery request details
        fetchActiveTrip(driver.id).then((trip) => {
          if (trip) {
            setActiveTrip(trip);
          } else {
            // Synthesize minimal trip payload if API not reachable
            setActiveTrip({
              id: event.requestId,
              status: RequestStatus.ASSIGNED,
              pickupLat: currentCoords.lat + 0.005,
              pickupLng: currentCoords.lng + 0.005,
              dropLat: currentCoords.lat + 0.025,
              dropLng: currentCoords.lng + 0.02,
              assignedDriverId: driver.id,
              priority: 1,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });
          }
        });
      },
      onRequestExpired: (event) => {
        setIncomingOffer((current) =>
          current?.requestId === event.requestId ? null : current,
        );
      },
      onRequestCancelled: (event) => {
        setIncomingOffer((current) =>
          current?.requestId === event.requestId ? null : current,
        );
        setActiveTrip((current) =>
          current?.id === event.requestId ? null : current,
        );
      },
    });

    return () => {
      if (offerTimerRef.current) clearTimeout(offerTimerRef.current);
    };
  }, [token, driver, currentCoords.lat, currentCoords.lng]);

  // Subscribe to GPS Location updates
  useEffect(() => {
    const unsubscribe = subscribeToLocationUpdates((loc) => {
      const heading =
        typeof loc.coords.heading === 'number' && loc.coords.heading >= 0
          ? loc.coords.heading
          : undefined;
      const speed =
        typeof loc.coords.speed === 'number' && loc.coords.speed >= 0
          ? loc.coords.speed * 3.6
          : undefined;
      const newCoords: DriverLocationState = {
        lat: loc.coords.latitude,
        lng: loc.coords.longitude,
        heading,
        speed,
        accuracy: loc.coords.accuracy ?? undefined,
        updatedAt: new Date().toISOString(),
      };
      setCurrentCoords(newCoords);

      if (driver && status !== DriverStatus.OFFLINE) {
        updateDriverLocation(
          driver.id,
          newCoords.lat,
          newCoords.lng,
          newCoords.heading,
          newCoords.speed,
        ).catch(async () => {
          await offlineQueue.enqueue({
            type: 'LOCATION_PING',
            driverId: driver.id,
            lat: newCoords.lat,
            lng: newCoords.lng,
            heading: newCoords.heading,
            speed: newCoords.speed,
            timestamp: Date.now(),
          });
          const c = await offlineQueue.getCount();
          setQueueCount(c);
        });
      }
    });

    return () => unsubscribe();
  }, [driver, status]);

  // Login
  const login = useCallback(
    async (driverProfile: Driver, authToken?: string) => {
      const effectiveToken =
        authToken ||
        `demo-driver-jwt-token-role-driver-id-${driverProfile.id}`;

      await storage.saveDriver(driverProfile);
      await storage.saveToken(effectiveToken);

      setDriver(driverProfile);
      setToken(effectiveToken);
      setStatus(driverProfile.status);
      setCurrentCoords({
        lat: driverProfile.lat,
        lng: driverProfile.lng,
        updatedAt: new Date().toISOString(),
      });

      if (driverProfile.status !== DriverStatus.OFFLINE) {
        const tracking = await locationTracker.startTracking('idle');
        setIsTracking(tracking);
      }
    },
    [],
  );

  // Logout
  const logout = useCallback(async () => {
    await locationTracker.stopTracking();
    setIsTracking(false);
    mobileSocket.disconnect();
    await storage.clearDriver();
    await storage.clearToken();
    setDriver(null);
    setToken(null);
    setStatus(DriverStatus.OFFLINE);
    setActiveTrip(null);
    setIncomingOffer(null);
  }, []);

  // Toggle Online/Offline
  const toggleOnline = useCallback(
    async (online: boolean) => {
      if (!driver) return;
      const newStatus = online ? DriverStatus.AVAILABLE : DriverStatus.OFFLINE;

      setStatus(newStatus);
      setDriver((d) => (d ? { ...d, status: newStatus } : null));

      // Update API
      await updateDriverStatus(driver.id, newStatus).catch(async () => {
        await offlineQueue.enqueue({
          type: 'STATUS_UPDATE',
          driverId: driver.id,
          status: newStatus,
          timestamp: Date.now(),
        });
        const c = await offlineQueue.getCount();
        setQueueCount(c);
      });

      // Update Socket
      mobileSocket.emitStatus({
        driverId: driver.id,
        status: newStatus,
      });

      if (online) {
        const started = await locationTracker.startTracking(
          activeTrip ? 'delivery' : 'idle',
        );
        setIsTracking(started);
      } else {
        await locationTracker.stopTracking();
        setIsTracking(false);
      }
    },
    [driver, activeTrip],
  );

  // Accept Offer
  const acceptIncomingOffer = useCallback(async (): Promise<boolean> => {
    if (!incomingOffer || !driver) return false;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    } catch {
      // ignore
    }

    const success = await acceptOffer(incomingOffer.requestId, driver.id);
    if (success) {
      setStatus(DriverStatus.BUSY);
      locationTracker.startTracking('delivery');
      if (offerTimerRef.current) clearTimeout(offerTimerRef.current);
      setIncomingOffer(null);

      // Create or fetch active trip
      const trip = await fetchActiveTrip(driver.id);
      if (trip) {
        setActiveTrip(trip);
      } else {
        setActiveTrip({
          id: incomingOffer.requestId,
          status: RequestStatus.ASSIGNED,
          pickupLat: incomingOffer.pickupLat ?? currentCoords.lat + 0.005,
          pickupLng: incomingOffer.pickupLng ?? currentCoords.lng + 0.005,
          dropLat: incomingOffer.dropLat ?? currentCoords.lat + 0.025,
          dropLng: incomingOffer.dropLng ?? currentCoords.lng + 0.02,
          assignedDriverId: driver.id,
          priority: 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
      return true;
    }
    return false;
  }, [incomingOffer, driver, currentCoords]);

  // Reject Offer
  const rejectIncomingOffer = useCallback(
    async (reason = 'Driver declined offer'): Promise<boolean> => {
      if (!incomingOffer || !driver) return false;
      if (offerTimerRef.current) clearTimeout(offerTimerRef.current);

      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {
        // ignore
      }

      await rejectOffer(incomingOffer.requestId, driver.id, reason);
      setIncomingOffer(null);
      return true;
    },
    [incomingOffer, driver],
  );

  // Advance Trip Status: picked_up -> delivered
  const advanceTripStatus = useCallback(async (): Promise<boolean> => {
    if (!activeTrip || !driver) return false;

    if (activeTrip.status === RequestStatus.ASSIGNED) {
      const ok = await updateRequestStatus(activeTrip.id, 'picked_up');
      if (ok) {
        setActiveTrip((t) =>
          t ? { ...t, status: RequestStatus.PICKED_UP } : null,
        );
        return true;
      }
    } else if (activeTrip.status === RequestStatus.PICKED_UP) {
      const ok = await updateRequestStatus(activeTrip.id, 'delivered');
      if (ok) {
        setCompletedTrips((prev) => [
          { ...activeTrip, status: RequestStatus.DELIVERED },
          ...prev,
        ]);
        setActiveTrip(null);
        setStatus(DriverStatus.AVAILABLE);
        locationTracker.startTracking('idle');
        return true;
      }
    }
    return false;
  }, [activeTrip, driver]);

  // Flush Offline Queue
  const flushOfflineQueue = useCallback(async (): Promise<number> => {
    const { sent } = await offlineQueue.flush(async (item) => {
      if (item.type === 'LOCATION_PING') {
        return await updateDriverLocation(
          item.driverId,
          item.lat,
          item.lng,
          item.heading,
          item.speed,
        );
      } else if (item.type === 'STATUS_UPDATE') {
        return await updateDriverStatus(
          item.driverId,
          item.status as DriverStatus,
        );
      }
      return true;
    });

    const remaining = await offlineQueue.getCount();
    setQueueCount(remaining);
    return sent;
  }, []);

  // Demo simulator trigger for quick verification
  const simulateIncomingOffer = useCallback(() => {
    if (!driver) return;
    const pickupLat = currentCoords.lat + 0.008;
    const pickupLng = currentCoords.lng + 0.006;
    const dropLat = currentCoords.lat + 0.035;
    const dropLng = currentCoords.lng + 0.028;

    const fakeOffer: RequestOfferedEvent = {
      requestId: `sim-req-${Date.now().toString().slice(-6)}`,
      driverId: driver.id,
      attempt: 1,
      timeoutSeconds: 20,
      expiresAt: new Date(Date.now() + 20000).toISOString(),
      pickupLat,
      pickupLng,
      dropLat,
      dropLng,
    };

    setIncomingOffer(fakeOffer);
    if (offerTimerRef.current) clearTimeout(offerTimerRef.current);
    offerTimerRef.current = setTimeout(() => {
      setIncomingOffer(null);
    }, 20000);
  }, [driver, currentCoords]);

  return (
    <DriverContext.Provider
      value={{
        driver,
        token,
        status,
        isOnline: status !== DriverStatus.OFFLINE,
        isTracking,
        currentCoords,
        activeTrip,
        incomingOffer,
        completedTrips,
        queueCount,
        isSocketConnected,
        login,
        logout,
        toggleOnline,
        acceptIncomingOffer,
        rejectIncomingOffer,
        advanceTripStatus,
        flushOfflineQueue,
        simulateIncomingOffer,
      }}
    >
      {children}
    </DriverContext.Provider>
  );
}

export function useDriver() {
  const ctx = useContext(DriverContext);
  if (!ctx) {
    throw new Error('useDriver must be used within DriverProvider');
  }
  return ctx;
}
