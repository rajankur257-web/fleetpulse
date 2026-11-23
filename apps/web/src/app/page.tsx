'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  DriverLocationEvent,
  DriverStatus,
  DriverStatusEvent,
  RequestAssignedEvent,
  RequestCancelledEvent,
  RequestCreatedEvent,
  RequestExpiredEvent,
  RequestOfferedEvent,
  RequestStatus,
} from '@fleet-pulse/shared';
import { fetchDrivers, fetchRequests } from '../lib/api';
import { getSocket, disconnectSocket } from '../lib/socket';
import {
  DeliveryRequestData,
  DriverMarkerData,
  SocketStatus,
} from '../types/dashboard';
import { Header } from '../components/layout/header';
import dynamic from 'next/dynamic';
import { SidePanel } from '../components/sidebar/side-panel';
import { CreateRequestModal } from '../components/sidebar/create-request-modal';
import { SimControls } from '../components/simulator/sim-controls';

const FleetMap = dynamic(
  () => import('../components/map/fleet-map').then((mod) => mod.FleetMap),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex items-center justify-center bg-slate-100 dark:bg-slate-900 text-slate-500 font-mono text-xs">
        Loading live dispatch map...
      </div>
    ),
  },
);

export default function DispatcherDashboardPage() {
  const [socketStatus, setSocketStatus] = useState<SocketStatus>('disconnected');
  const [drivers, setDrivers] = useState<DriverMarkerData[]>([]);
  const [requests, setRequests] = useState<DeliveryRequestData[]>([]);

  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const [flyToCoords, setFlyToCoords] = useState<{ lat: number; lng: number } | null>(null);

  // Create Request Modal & Map Coordinate Picker State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [pickingMode, setPickingMode] = useState<'pickup' | 'dropoff' | null>(null);
  const [pendingCoords, setPendingCoords] = useState<{ lat: number; lng: number } | null>(null);

  // Simulator Floating Overlay
  const [showSimControls, setShowSimControls] = useState(true);

  // Initial Data Query with TanStack Query
  const { data: initialDrivers } = useQuery({
    queryKey: ['drivers'],
    queryFn: fetchDrivers,
  });

  const { data: initialRequests } = useQuery({
    queryKey: ['requests'],
    queryFn: fetchRequests,
  });

  // Sync initial data into local reactive state
  useEffect(() => {
    if (initialDrivers && initialDrivers.length > 0) {
      setDrivers(initialDrivers);
    }
  }, [initialDrivers]);

  useEffect(() => {
    if (initialRequests && initialRequests.length > 0) {
      setRequests(initialRequests);
    }
  }, [initialRequests]);

  // Connect to Socket.IO and register real-time event listeners
  useEffect(() => {
    const socket = getSocket();

    const onConnect = () => {
      setSocketStatus('connected');
    };

    const onDisconnect = () => {
      setSocketStatus('disconnected');
    };

    const onReconnectAttempt = () => {
      setSocketStatus('reconnecting');
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.io.on('reconnect_attempt', onReconnectAttempt);

    if (socket.connected) {
      setSocketStatus('connected');
    }

    // Real-time Event Handlers
    const handleDriverLocation = (evt: DriverLocationEvent) => {
      setDrivers((prev) => {
        const index = prev.findIndex((d) => d.id === evt.driverId);
        if (index >= 0) {
          const updated = [...prev];
          const existing = updated[index]!;
          updated[index] = {
            ...existing,
            lat: evt.lat,
            lng: evt.lng,
            heading: evt.heading ?? existing.heading,
            speed: evt.speed ?? existing.speed,
            lastLocationAt: String(evt.updatedAt),
          };
          return updated;
        }
        return prev;
      });
    };

    const handleDriverStatus = (evt: DriverStatusEvent) => {
      setDrivers((prev) => {
        const index = prev.findIndex((d) => d.id === evt.driverId);
        if (index >= 0) {
          const updated = [...prev];
          const existing = updated[index]!;
          updated[index] = {
            ...existing,
            status: evt.status,
            activeRequestId: evt.activeRequestId ?? null,
          };
          return updated;
        }
        return prev;
      });
    };

    const handleRequestCreated = (evt: RequestCreatedEvent) => {
      setRequests((prev) => {
        const exists = prev.some((r) => r.id === evt.request.id);
        if (exists) return prev;
        const newReq: DeliveryRequestData = {
          id: evt.request.id,
          pickupLat: evt.request.pickupLat,
          pickupLng: evt.request.pickupLng,
          dropLat: evt.request.dropLat,
          dropLng: evt.request.dropLng,
          status: evt.request.status,
          priority: evt.request.priority,
          createdAt: String(evt.request.createdAt || new Date().toISOString()),
        };
        return [newReq, ...prev];
      });
    };

    const handleRequestOffered = (evt: RequestOfferedEvent) => {
      setRequests((prev) =>
        prev.map((r) =>
          r.id === evt.requestId
            ? { ...r, status: RequestStatus.OFFERED }
            : r,
        ),
      );
    };

    const handleRequestAssigned = (evt: RequestAssignedEvent) => {
      setRequests((prev) =>
        prev.map((r) =>
          r.id === evt.requestId
            ? {
                ...r,
                status: RequestStatus.ASSIGNED,
                assignedDriverId: evt.driverId,
                assignedAt: String(evt.assignedAt),
              }
            : r,
        ),
      );
      setDrivers((prev) =>
        prev.map((d) =>
          d.id === evt.driverId
            ? { ...d, status: DriverStatus.BUSY, activeRequestId: evt.requestId }
            : d,
        ),
      );
    };

    const handleRequestExpired = (evt: RequestExpiredEvent) => {
      setRequests((prev) =>
        prev.map((r) =>
          r.id === evt.requestId
            ? { ...r, status: RequestStatus.EXPIRED }
            : r,
        ),
      );
    };

    const handleRequestCancelled = (evt: RequestCancelledEvent) => {
      setRequests((prev) =>
        prev.map((r) =>
          r.id === evt.requestId
            ? { ...r, status: RequestStatus.CANCELLED }
            : r,
        ),
      );
    };

    socket.on('driver:location', handleDriverLocation);
    socket.on('driver:status', handleDriverStatus);
    socket.on('request:created', handleRequestCreated);
    socket.on('request:offered', handleRequestOffered);
    socket.on('request:assigned', handleRequestAssigned);
    socket.on('request:expired', handleRequestExpired);
    socket.on('request:cancelled', handleRequestCancelled);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.io.off('reconnect_attempt', onReconnectAttempt);
      socket.off('driver:location', handleDriverLocation);
      socket.off('driver:status', handleDriverStatus);
      socket.off('request:created', handleRequestCreated);
      socket.off('request:offered', handleRequestOffered);
      socket.off('request:assigned', handleRequestAssigned);
      socket.off('request:expired', handleRequestExpired);
      socket.off('request:cancelled', handleRequestCancelled);
      disconnectSocket();
    };
  }, []);

  const handleMapClickCoordinate = useCallback(
    (coords: { lat: number; lng: number }) => {
      if (pickingMode) {
        setPendingCoords(coords);
      }
    },
    [pickingMode],
  );

  const availableDriversCount = drivers.filter((d) => d.status === 'available').length;
  const activeRequestsCount = requests.filter(
    (r) => r.status === 'assigned' || r.status === 'picked_up' || r.status === 'offered' || r.status === 'pending',
  ).length;

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 overflow-hidden font-sans transition-colors duration-200">
      {/* Top Header with HUD Metrics & Socket Indicator */}
      <Header
        socketStatus={socketStatus}
        availableDriversCount={availableDriversCount}
        totalDriversCount={drivers.length}
        activeRequestsCount={activeRequestsCount}
        onOpenCreateModal={() => setIsCreateModalOpen(true)}
        showSimControls={showSimControls}
        onToggleSimControls={() => setShowSimControls((prev) => !prev)}
      />

      {/* Main Workspace: Side Panel + Full-bleed Map */}
      <div className="flex-1 flex overflow-hidden relative">
        <SidePanel
          drivers={drivers}
          requests={requests}
          selectedDriverId={selectedDriverId}
          onSelectDriver={(d) => {
            setSelectedDriverId(d ? d.id : null);
          }}
          onFlyTo={(coords) => setFlyToCoords(coords)}
        />

        {/* Live Interactive MapLibre GL Map */}
        <FleetMap
          drivers={drivers}
          requests={requests}
          selectedDriverId={selectedDriverId}
          onSelectDriver={(d) => {
            setSelectedDriverId(d ? d.id : null);
          }}
          pickingMode={pickingMode}
          onMapClickCoordinate={handleMapClickCoordinate}
          flyToCoords={flyToCoords}
        />

        {/* Simulator Controls Floating HUD Overlay */}
        <SimControls
          isVisible={showSimControls}
          onClose={() => setShowSimControls(false)}
        />
      </div>

      {/* Create Delivery Request Modal */}
      <CreateRequestModal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          setPickingMode(null);
        }}
        onRequestCreated={() => {
          // Re-fetch requests
          fetchRequests().then((r) => setRequests(r));
        }}
        pickingMode={pickingMode}
        setPickingMode={setPickingMode}
        pendingCoords={pendingCoords}
      />
    </div>
  );
}
