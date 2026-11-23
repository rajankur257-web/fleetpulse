'use client';

import React, { useEffect, useRef, useState } from 'react';
import maplibregl, { Map as MapLibreMap, Marker } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import {
  DeadZoneAlert,
  HeatmapPoint,
  RepositioningHint,
} from '@fleet-pulse/shared';
import {
  AlertTriangle,
  Compass,
  Flame,
  Layers,
} from 'lucide-react';
import {
  BENGALURU_CENTER,
  DEFAULT_ZOOM,
  OSM_RASTER_STYLE,
} from '../../lib/constants';

interface DemandHeatmapMapProps {
  heatmapPoints: HeatmapPoint[];
  repositioningHints: RepositioningHint[];
  deadZones: DeadZoneAlert[];
  flyToCoords?: { lat: number; lng: number } | null;
}

export function DemandHeatmapMap({
  heatmapPoints,
  repositioningHints,
  deadZones,
  flyToCoords,
}: DemandHeatmapMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);

  const [showHeatmap, setShowHeatmap] = useState(true);
  const [showHints, setShowHints] = useState(true);
  const [showDeadZones, setShowDeadZones] = useState(true);

  const hintMarkersRef = useRef<Marker[]>([]);
  const deadZoneMarkersRef = useRef<Marker[]>([]);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: OSM_RASTER_STYLE,
      center: BENGALURU_CENTER,
      zoom: DEFAULT_ZOOM,
      attributionControl: { compact: true },
    });

    map.addControl(
      new maplibregl.NavigationControl({ showCompass: true }),
      'bottom-right',
    );
    map.addControl(new maplibregl.ScaleControl(), 'bottom-left');

    map.on('load', () => {
      // Add GeoJSON source for Heatmap
      map.addSource('demand-heatmap-source', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: [],
        },
      });

      // Add Heatmap Layer
      map.addLayer({
        id: 'demand-heatmap-layer',
        type: 'heatmap',
        source: 'demand-heatmap-source',
        maxzoom: 17,
        paint: {
          'heatmap-weight': ['get', 'weight'],
          'heatmap-intensity': [
            'interpolate',
            ['linear'],
            ['zoom'],
            10,
            1,
            15,
            3,
          ],
          'heatmap-color': [
            'interpolate',
            ['linear'],
            ['heatmap-density'],
            0,
            'rgba(33, 102, 172, 0)',
            0.2,
            'rgb(103, 169, 207)',
            0.4,
            'rgb(209, 229, 240)',
            0.6,
            'rgb(253, 219, 199)',
            0.8,
            'rgb(239, 138, 98)',
            1,
            'rgb(178, 24, 43)',
          ],
          'heatmap-radius': [
            'interpolate',
            ['linear'],
            ['zoom'],
            10,
            12,
            15,
            35,
          ],
          'heatmap-opacity': 0.75,
        },
      });
    });

    mapRef.current = map;

    return () => {
      hintMarkersRef.current.forEach((m) => m.remove());
      hintMarkersRef.current = [];
      deadZoneMarkersRef.current.forEach((m) => m.remove());
      deadZoneMarkersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update Heatmap Source Data
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const source = map.getSource(
      'demand-heatmap-source',
    ) as maplibregl.GeoJSONSource | undefined;
    if (!source) return;

    const features = heatmapPoints.map((p) => ({
      type: 'Feature' as const,
      geometry: {
        type: 'Point' as const,
        coordinates: [p.lng, p.lat],
      },
      properties: {
        weight: p.weight,
        requestCount: p.requestCount,
      },
    }));

    source.setData({
      type: 'FeatureCollection',
      features,
    });
  }, [heatmapPoints]);

  // Update Repositioning Hotspot Markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clear old hint markers
    hintMarkersRef.current.forEach((m) => m.remove());
    hintMarkersRef.current = [];

    if (!showHints) return;

    // Add Target Cluster Markers
    repositioningHints.forEach((hint) => {
      const isHigh = hint.priority === 'high';
      const el = document.createElement('div');
      el.className = 'group relative cursor-pointer';
      el.innerHTML = `
        <div class="flex items-center justify-center w-8 h-8 rounded-full ${
          isHigh
            ? 'bg-cyan-500/30 border-2 border-cyan-400 text-cyan-300 shadow-cyan-500/40'
            : 'bg-emerald-500/20 border-2 border-emerald-400 text-emerald-300 shadow-emerald-500/30'
        } shadow-lg animate-pulse font-mono font-bold text-[11px]">
          +${hint.recommendedRepositionCount}
        </div>
        <div class="absolute bottom-10 left-1/2 -translate-x-1/2 hidden group-hover:flex flex-col items-center z-50">
          <div class="bg-slate-900 border border-slate-700 text-slate-100 text-[10px] font-mono px-2.5 py-1.5 rounded-lg shadow-2xl whitespace-nowrap">
            <div class="font-bold text-cyan-400">${hint.zoneName} (${hint.priority.toUpperCase()})</div>
            <div class="text-slate-300">Rec: +${hint.recommendedRepositionCount} drivers | Avail: ${hint.availableNearbyDrivers}</div>
            <div class="text-slate-400">Demand Weight: ${hint.demandWeight.toFixed(1)}</div>
          </div>
        </div>
      `;

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([hint.lng, hint.lat])
        .addTo(map);

      hintMarkersRef.current.push(marker);
    });
  }, [repositioningHints, showHints]);

  // Update Dead-Zone Markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    deadZoneMarkersRef.current.forEach((m) => m.remove());
    deadZoneMarkersRef.current = [];

    if (!showDeadZones) return;

    deadZones.forEach((dz) => {
      const isCritical = dz.alertLevel === 'critical';
      const el = document.createElement('div');
      el.className = 'group relative cursor-pointer';
      el.innerHTML = `
        <div class="relative flex items-center justify-center">
          <div class="absolute w-10 h-10 rounded-full ${
            isCritical ? 'bg-rose-500/30' : 'bg-amber-500/30'
          } animate-ping"></div>
          <div class="flex items-center justify-center w-7 h-7 rounded-full ${
            isCritical
              ? 'bg-rose-600 border-2 border-rose-300 text-white'
              : 'bg-amber-600 border-2 border-amber-300 text-white'
          } shadow-lg z-10 font-bold text-[10px]">
            !
          </div>
          <div class="absolute bottom-8 left-1/2 -translate-x-1/2 hidden group-hover:flex flex-col items-center z-50">
            <div class="bg-slate-900 border border-slate-700 text-slate-100 text-[10px] font-mono px-2.5 py-1.5 rounded shadow-2xl whitespace-nowrap">
              <div class="font-bold ${
                isCritical ? 'text-rose-400' : 'text-amber-400'
              }">${dz.zoneName} (${dz.alertLevel.toUpperCase()})</div>
              <div class="text-slate-300">Pending: ${dz.pendingCount} reqs | Max wait: ${dz.maxWaitSeconds}s</div>
            </div>
          </div>
        </div>
      `;

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([dz.lng, dz.lat])
        .addTo(map);

      deadZoneMarkersRef.current.push(marker);
    });
  }, [deadZones, showDeadZones]);

  // Toggle Heatmap Layer Visibility
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getLayer('demand-heatmap-layer')) return;

    map.setLayoutProperty(
      'demand-heatmap-layer',
      'visibility',
      showHeatmap ? 'visible' : 'none',
    );
  }, [showHeatmap]);

  // Fly to Coordinate focus
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !flyToCoords) return;

    map.flyTo({
      center: [flyToCoords.lng, flyToCoords.lat],
      zoom: 14,
      essential: true,
      duration: 1200,
    });
  }, [flyToCoords]);

  return (
    <div className="rounded-xl bg-white border border-slate-200 dark:bg-slate-900/90 dark:border-slate-800 p-5 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-500 dark:text-rose-400">
              <Flame className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Demand Heatmap & Idle Repositioning Map
            </h3>
          </div>
          <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
            Real-time delivery demand density, dead-zone alert rings, and directional repositioning vectors
          </p>
        </div>

        {/* Map Layers Toggles */}
        <div className="flex items-center gap-2 text-xs">
          <button
            onClick={() => setShowHeatmap(!showHeatmap)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md border font-medium transition ${
              showHeatmap
                ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/20 dark:text-rose-300 dark:border-rose-500/40'
                : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
            }`}
          >
            <Flame className="w-3 h-3" />
            <span>Heatmap</span>
          </button>

          <button
            onClick={() => setShowHints(!showHints)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md border font-medium transition ${
              showHints
                ? 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-500/20 dark:text-cyan-300 dark:border-cyan-500/40'
                : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
            }`}
          >
            <Compass className="w-3 h-3" />
            <span>Reposition Hints ({repositioningHints.length})</span>
          </button>

          <button
            onClick={() => setShowDeadZones(!showDeadZones)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md border font-medium transition ${
              showDeadZones
                ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/40'
                : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
            }`}
          >
            <AlertTriangle className="w-3 h-3" />
            <span>Dead Zones ({deadZones.length})</span>
          </button>
        </div>
      </div>

      {/* Map Container */}
      <div className="relative w-full h-[420px] mt-4 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800">
        <div
          ref={mapContainerRef}
          data-testid="analytics-demand-map"
          className="w-full h-full"
        />

        {/* Map Legend Overlay */}
        <div className="absolute top-3 left-3 bg-white/90 border border-slate-200 text-slate-800 dark:bg-slate-950/85 backdrop-blur dark:border-slate-800 rounded-lg p-2.5 text-[10px] font-mono shadow-xl flex flex-col gap-1.5 z-10">
          <div className="text-[11px] font-sans font-semibold text-slate-900 dark:text-slate-200 flex items-center gap-1">
            <Layers className="w-3 h-3 text-indigo-500 dark:text-indigo-400" />
            <span>Map Layers</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-1.5 rounded-sm bg-gradient-to-r from-blue-400 via-orange-400 to-red-600 inline-block" />
            <span className="text-slate-700 dark:text-slate-300">Demand Heatmap ({heatmapPoints.length} clusters)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-500 dark:bg-cyan-400 inline-block" />
            <span className="text-slate-700 dark:text-slate-300">Reposition Hint</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-rose-500 inline-block animate-ping" />
            <span className="text-slate-700 dark:text-slate-300">Dead Zone Alert</span>
          </div>
        </div>
      </div>
    </div>
  );
}
