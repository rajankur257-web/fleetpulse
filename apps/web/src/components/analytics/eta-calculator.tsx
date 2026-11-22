'use client';

import React, { useState } from 'react';
import { EtaComparisonResult } from '@fleet-pulse/shared';
import {
  Calculator,
  MapPin,
  Route,
} from 'lucide-react';
import { compareEta } from '../../lib/api';

const PRESET_ROUTES = [
  {
    name: 'Koramangala to Indiranagar',
    origin: { lat: 12.9352, lng: 77.6245 },
    destination: { lat: 12.9784, lng: 77.6408 },
  },
  {
    name: 'Electronic City to Whitefield',
    origin: { lat: 12.8399, lng: 77.677 },
    destination: { lat: 12.9698, lng: 77.7499 },
  },
  {
    name: 'MG Road to Hebbal',
    origin: { lat: 12.9756, lng: 77.6066 },
    destination: { lat: 13.0358, lng: 77.597 },
  },
];

export function EtaCalculator() {
  const [origin, setOrigin] = useState(PRESET_ROUTES[0]!.origin);
  const [destination, setDestination] = useState(PRESET_ROUTES[0]!.destination);
  const [result, setResult] = useState<EtaComparisonResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleCalculate = async (
    orig = origin,
    dest = destination,
  ) => {
    setIsLoading(true);
    try {
      const res = await compareEta(orig, dest);
      if (res) setResult(res);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectPreset = (preset: (typeof PRESET_ROUTES)[0]) => {
    setOrigin(preset.origin);
    setDestination(preset.destination);
    handleCalculate(preset.origin, preset.destination);
  };

  return (
    <div className="rounded-xl bg-slate-900/90 border border-slate-800 p-5 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <Route className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-100">
              Haversine Distance vs OSRM Road ETA
            </h3>
            <p className="text-[11px] text-slate-400">
              Direct spherical Haversine formula compared against OSRM street network routing
            </p>
          </div>
        </div>

        {/* Presets */}
        <div className="flex flex-wrap items-center gap-1.5">
          {PRESET_ROUTES.map((p) => (
            <button
              key={p.name}
              onClick={() => handleSelectPreset(p)}
              className="text-[11px] font-medium px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
            >
              {p.name.split(' to ')[0]} → {p.name.split(' to ')[1]}
            </button>
          ))}
        </div>
      </div>

      {/* Input Coordinates */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4 text-xs">
        <div className="p-3 rounded-lg bg-slate-800/60 border border-slate-700/60">
          <div className="flex items-center gap-1.5 text-slate-300 font-medium mb-2">
            <MapPin className="w-3.5 h-3.5 text-emerald-400" />
            <span>Origin Coordinates (Pickup)</span>
          </div>
          <div className="grid grid-cols-2 gap-2 font-mono">
            <input
              type="number"
              step="0.0001"
              value={origin.lat}
              onChange={(e) => setOrigin({ ...origin, lat: Number(e.target.value) })}
              className="px-2 py-1 rounded bg-slate-900 border border-slate-700 text-slate-100 focus:outline-none"
              placeholder="Latitude"
            />
            <input
              type="number"
              step="0.0001"
              value={origin.lng}
              onChange={(e) => setOrigin({ ...origin, lng: Number(e.target.value) })}
              className="px-2 py-1 rounded bg-slate-900 border border-slate-700 text-slate-100 focus:outline-none"
              placeholder="Longitude"
            />
          </div>
        </div>

        <div className="p-3 rounded-lg bg-slate-800/60 border border-slate-700/60">
          <div className="flex items-center gap-1.5 text-slate-300 font-medium mb-2">
            <MapPin className="w-3.5 h-3.5 text-blue-400" />
            <span>Destination Coordinates (Dropoff)</span>
          </div>
          <div className="grid grid-cols-2 gap-2 font-mono">
            <input
              type="number"
              step="0.0001"
              value={destination.lat}
              onChange={(e) => setDestination({ ...destination, lat: Number(e.target.value) })}
              className="px-2 py-1 rounded bg-slate-900 border border-slate-700 text-slate-100 focus:outline-none"
              placeholder="Latitude"
            />
            <input
              type="number"
              step="0.0001"
              value={destination.lng}
              onChange={(e) => setDestination({ ...destination, lng: Number(e.target.value) })}
              className="px-2 py-1 rounded bg-slate-900 border border-slate-700 text-slate-100 focus:outline-none"
              placeholder="Longitude"
            />
          </div>
        </div>
      </div>

      <div className="mt-3 flex justify-end">
        <button
          onClick={() => handleCalculate()}
          disabled={isLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow transition disabled:opacity-50"
        >
          <Calculator className="w-3.5 h-3.5" />
          <span>{isLoading ? 'Routing...' : 'Calculate Route Comparison'}</span>
        </button>
      </div>

      {/* Comparison Results Card */}
      {result && (
        <div className="mt-4 p-4 rounded-xl bg-slate-800/50 border border-slate-700 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-mono">
          <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800">
            <span className="text-[10px] text-slate-400 block uppercase tracking-wider">
              Haversine (Great-Circle)
            </span>
            <div className="text-lg font-bold text-slate-100 mt-1">
              {result.haversine.distanceKm.toFixed(2)} km
            </div>
            <div className="text-[11px] text-emerald-400 mt-0.5">
              ETA: ~{result.haversine.etaMinutes} min (30 km/h)
            </div>
          </div>

          <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-slate-400 block uppercase tracking-wider">
                OSRM Street Route
              </span>
              <span
                className={`text-[9px] px-1.5 py-0.2 rounded ${
                  result.osrm.isAvailable
                    ? 'bg-emerald-500/20 text-emerald-300'
                    : 'bg-amber-500/20 text-amber-300'
                }`}
              >
                {result.osrm.isAvailable ? 'LIVE OSRM' : 'FALLBACK'}
              </span>
            </div>
            <div className="text-lg font-bold text-slate-100 mt-1">
              {result.osrm.distanceKm.toFixed(2)} km
            </div>
            <div className="text-[11px] text-blue-400 mt-0.5">
              Duration: ~{result.osrm.durationMinutes} min
            </div>
          </div>

          <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800 flex flex-col justify-between">
            <span className="text-[10px] text-slate-400 block uppercase tracking-wider">
              Urban Detour Factor
            </span>
            <div className="text-lg font-bold text-cyan-400 mt-1">
              {result.detourFactor.toFixed(2)}x
            </div>
            <div className="text-[10px] text-slate-400">
              Road detour ratio vs straight line
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
