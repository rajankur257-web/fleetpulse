'use client';

import React, { useEffect, useRef } from 'react';
import maplibregl, { Map as MapLibreMap, Marker } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { DEFAULT_ZOOM, OSM_RASTER_STYLE } from '../../lib/constants';
import { DeliveryRequestData, DriverMarkerData } from '../../types/dashboard';
import { createDriverMarkerElement, updateDriverMarkerElement } from './driver-marker';
import { createRequestPinElement } from './request-pin';
import {
  getCustomerName,
  getFormattedDriverName,
  getNeighborhoodName,
} from '../../lib/order-metadata';

interface CustomerTrackingMapProps {
  request: DeliveryRequestData;
  driver: DriverMarkerData | null;
}

export function CustomerTrackingMap({ request, driver }: CustomerTrackingMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);

  const pickupMarkerRef = useRef<Marker | null>(null);
  const dropoffMarkerRef = useRef<Marker | null>(null);
  const driverMarkerRef = useRef<Marker | null>(null);

  const customerName = getCustomerName(request.id);
  const pickupArea = getNeighborhoodName(request.pickupLat, request.pickupLng);
  const dropArea = getNeighborhoodName(request.dropLat, request.dropLng);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: OSM_RASTER_STYLE,
      center: [request.pickupLng, request.pickupLat],
      zoom: DEFAULT_ZOOM,
      attributionControl: { compact: true },
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'bottom-right');

    map.on('load', () => {
      // Add dashed route line source
      const coordinates = driver
        ? [
            [driver.lng, driver.lat],
            [request.pickupLng, request.pickupLat],
            [request.dropLng, request.dropLat],
          ]
        : [
            [request.pickupLng, request.pickupLat],
            [request.dropLng, request.dropLat],
          ];

      map.addSource('route-line', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates,
          },
        },
      });

      map.addLayer({
        id: 'route-line-layer',
        type: 'line',
        source: 'route-line',
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': '#f59e0b',
          'line-width': 4,
          'line-dasharray': [2, 2],
          'line-opacity': 0.85,
        },
      });

      // Fit map bounds to encompass all points
      const bounds = new maplibregl.LngLatBounds();
      bounds.extend([request.pickupLng, request.pickupLat]);
      bounds.extend([request.dropLng, request.dropLat]);
      if (driver) {
        bounds.extend([driver.lng, driver.lat]);
      }
      map.fitBounds(bounds, { padding: 90, maxZoom: 15, duration: 1000 });
    });

    // Add Pickup & Dropoff Markers
    const pEl = createRequestPinElement('pickup', request.id, customerName, pickupArea);
    const pMarker = new maplibregl.Marker({ element: pEl })
      .setLngLat([request.pickupLng, request.pickupLat])
      .addTo(map);
    pickupMarkerRef.current = pMarker;

    const dEl = createRequestPinElement('dropoff', request.id, customerName, dropArea);
    const dMarker = new maplibregl.Marker({ element: dEl })
      .setLngLat([request.dropLng, request.dropLat])
      .addTo(map);
    dropoffMarkerRef.current = dMarker;

    mapRef.current = map;

    return () => {
      pickupMarkerRef.current?.remove();
      dropoffMarkerRef.current?.remove();
      driverMarkerRef.current?.remove();
      map.remove();
      mapRef.current = null;
    };
  }, [request.id, request.pickupLat, request.pickupLng, request.dropLat, request.dropLng, customerName, pickupArea, dropArea]);

  // Update Driver Marker & Route Line
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (driver) {
      const displayName = getFormattedDriverName(driver.name, driver.id);

      if (!driverMarkerRef.current) {
        const dEl = createDriverMarkerElement(
          driver.status,
          driver.heading,
          displayName,
          driver.speed,
          true, // isSelected (big bold styling with radar ping)
          true, // hasActiveOrder
          customerName,
        );

        const marker = new maplibregl.Marker({ element: dEl })
          .setLngLat([driver.lng, driver.lat])
          .addTo(map);

        driverMarkerRef.current = marker;
      } else {
        driverMarkerRef.current.setLngLat([driver.lng, driver.lat]);
        updateDriverMarkerElement(
          driverMarkerRef.current.getElement(),
          driver.status,
          driver.heading,
          displayName,
          driver.speed,
          true,
          true,
          customerName,
        );
      }

      // Update route line if layer exists
      if (map.getSource('route-line')) {
        const source = map.getSource('route-line') as maplibregl.GeoJSONSource;
        const coords =
          request.status === 'picked_up'
            ? [
                [driver.lng, driver.lat],
                [request.dropLng, request.dropLat],
              ]
            : [
                [driver.lng, driver.lat],
                [request.pickupLng, request.pickupLat],
                [request.dropLng, request.dropLat],
              ];

        source.setData({
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: coords,
          },
        });
      }
    } else {
      if (driverMarkerRef.current) {
        driverMarkerRef.current.remove();
        driverMarkerRef.current = null;
      }
    }
  }, [driver, request.status, customerName, request.pickupLat, request.pickupLng, request.dropLat, request.dropLng]);

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainerRef} className="w-full h-full" />
    </div>
  );
}
