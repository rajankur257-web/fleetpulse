'use client';

import React, { useEffect, useRef } from 'react';
import maplibregl, { Map as MapLibreMap, Marker } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { BENGALURU_CENTER, DEFAULT_ZOOM, OSM_RASTER_STYLE } from '../../lib/constants';
import { DeliveryRequestData, DriverMarkerData } from '../../types/dashboard';
import { createDriverMarkerElement, updateDriverMarkerElement } from './driver-marker';
import { createRequestPinElement } from './request-pin';

interface FleetMapProps {
  drivers: DriverMarkerData[];
  requests: DeliveryRequestData[];
  selectedDriverId: string | null;
  onSelectDriver: (driver: DriverMarkerData | null) => void;
  pickingMode: 'pickup' | 'dropoff' | null;
  onMapClickCoordinate: (coords: { lat: number; lng: number }) => void;
  flyToCoords: { lat: number; lng: number } | null;
}

export function FleetMap({
  drivers,
  requests,
  onSelectDriver,
  pickingMode,
  onMapClickCoordinate,
  flyToCoords,
}: FleetMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);

  const driverMarkersRef = useRef<Map<string, Marker>>(new Map());
  const requestMarkersRef = useRef<Map<string, { pickup: Marker; dropoff: Marker }>>(new Map());

  // Initialize MapLibre GL JS map instance
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: OSM_RASTER_STYLE,
      center: BENGALURU_CENTER,
      zoom: DEFAULT_ZOOM,
      attributionControl: { compact: true },
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'bottom-right');
    map.addControl(new maplibregl.ScaleControl(), 'bottom-left');

    map.on('click', (e) => {
      onMapClickCoordinate({ lat: e.lngLat.lat, lng: e.lngLat.lng });
    });

    mapRef.current = map;

    return () => {
      driverMarkersRef.current.forEach((m) => m.remove());
      driverMarkersRef.current.clear();
      requestMarkersRef.current.forEach((m) => {
        m.pickup.remove();
        m.dropoff.remove();
      });
      requestMarkersRef.current.clear();
      map.remove();
      mapRef.current = null;
    };
  }, [onMapClickCoordinate]);

  // Handle flyTo when programmatic focus is requested
  useEffect(() => {
    if (!mapRef.current || !flyToCoords) return;
    mapRef.current.flyTo({
      center: [flyToCoords.lng, flyToCoords.lat],
      zoom: 14,
      essential: true,
      duration: 1200,
    });
  }, [flyToCoords]);

  // Sync Driver Markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const activeDriverIds = new Set<string>();

    for (const driver of drivers) {
      activeDriverIds.add(driver.id);
      let marker = driverMarkersRef.current.get(driver.id);

      if (!marker) {
        const el = createDriverMarkerElement(
          driver.status,
          driver.heading,
          driver.name,
          driver.speed,
        );
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          onSelectDriver(driver);
        });

        marker = new maplibregl.Marker({ element: el })
          .setLngLat([driver.lng, driver.lat])
          .addTo(map);

        driverMarkersRef.current.set(driver.id, marker);
      } else {
        // Smoothly update location and orientation
        marker.setLngLat([driver.lng, driver.lat]);
        updateDriverMarkerElement(
          marker.getElement(),
          driver.status,
          driver.heading,
          driver.speed,
        );
      }
    }

    // Remove markers for drivers no longer present
    driverMarkersRef.current.forEach((marker, id) => {
      if (!activeDriverIds.has(id)) {
        marker.remove();
        driverMarkersRef.current.delete(id);
      }
    });
  }, [drivers, onSelectDriver]);

  // Sync Delivery Request Markers (Pickup & Dropoff pins)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const activeRequestIds = new Set<string>();

    // Only display active or pending requests on map to avoid clutter
    const visibleRequests = requests.filter(
      (r) => r.status === 'pending' || r.status === 'offered' || r.status === 'assigned' || r.status === 'picked_up',
    );

    for (const req of visibleRequests) {
      activeRequestIds.add(req.id);
      let pins = requestMarkersRef.current.get(req.id);

      if (!pins) {
        const pEl = createRequestPinElement('pickup', req.id);
        const dEl = createRequestPinElement('dropoff', req.id);

        const pickupMarker = new maplibregl.Marker({ element: pEl })
          .setLngLat([req.pickupLng, req.pickupLat])
          .addTo(map);

        const dropoffMarker = new maplibregl.Marker({ element: dEl })
          .setLngLat([req.dropLng, req.dropLat])
          .addTo(map);

        pins = { pickup: pickupMarker, dropoff: dropoffMarker };
        requestMarkersRef.current.set(req.id, pins);
      } else {
        pins.pickup.setLngLat([req.pickupLng, req.pickupLat]);
        pins.dropoff.setLngLat([req.dropLng, req.dropLat]);
      }
    }

    // Clean up finished / cancelled request markers
    requestMarkersRef.current.forEach((pins, id) => {
      if (!activeRequestIds.has(id)) {
        pins.pickup.remove();
        pins.dropoff.remove();
        requestMarkersRef.current.delete(id);
      }
    });
  }, [requests]);

  return (
    <div className="relative w-full h-full flex-1 overflow-hidden">
      <div
        ref={mapContainerRef}
        data-testid="fleet-map-container"
        className="w-full h-full cursor-crosshair"
      />

      {/* Crosshair Banner when in picking mode */}
      {pickingMode && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-blue-600/90 text-white text-xs font-semibold px-4 py-2 rounded-full shadow-lg backdrop-blur flex items-center gap-2 z-20 pointer-events-none animate-pulse">
          <span>Click anywhere on the map to set {pickingMode === 'pickup' ? 'Pickup' : 'Dropoff'} point</span>
        </div>
      )}
    </div>
  );
}
