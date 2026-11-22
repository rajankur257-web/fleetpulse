'use client';

import React, { useState } from 'react';
import { Crosshair, MapPin, Package, X } from 'lucide-react';
import { createDeliveryRequest } from '../../lib/api';
import { CreateRequestFormData } from '../../types/dashboard';

interface CreateRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRequestCreated: () => void;
  pickingMode: 'pickup' | 'dropoff' | null;
  setPickingMode: (mode: 'pickup' | 'dropoff' | null) => void;
  pendingCoords: { lat: number; lng: number } | null;
}

const PRESET_HUBS = [
  { name: 'Koramangala', lat: 12.9352, lng: 77.6245 },
  { name: 'Indiranagar', lat: 12.9784, lng: 77.6408 },
  { name: 'Whitefield', lat: 12.9698, lng: 77.75 },
  { name: 'HSR Layout', lat: 12.9121, lng: 77.6446 },
  { name: 'Electronic City', lat: 12.8452, lng: 77.6602 },
];

export function CreateRequestModal({
  isOpen,
  onClose,
  onRequestCreated,
  pickingMode,
  setPickingMode,
  pendingCoords,
}: CreateRequestModalProps) {
  const [pickupLat, setPickupLat] = useState('12.9352');
  const [pickupLng, setPickupLng] = useState('77.6245');
  const [dropLat, setDropLat] = useState('12.9784');
  const [dropLng, setDropLng] = useState('77.6408');
  const [priority, setPriority] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Update coords when map click occurs in picking mode
  React.useEffect(() => {
    if (!pendingCoords || !pickingMode) return;

    if (pickingMode === 'pickup') {
      setPickupLat(pendingCoords.lat.toFixed(6));
      setPickupLng(pendingCoords.lng.toFixed(6));
      setPickingMode(null);
    } else if (pickingMode === 'dropoff') {
      setDropLat(pendingCoords.lat.toFixed(6));
      setDropLng(pendingCoords.lng.toFixed(6));
      setPickingMode(null);
    }
  }, [pendingCoords, pickingMode, setPickingMode]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const payload: CreateRequestFormData = {
        pickupLat: parseFloat(pickupLat),
        pickupLng: parseFloat(pickupLng),
        dropLat: parseFloat(dropLat),
        dropLng: parseFloat(dropLng),
        priority,
      };

      await createDeliveryRequest(payload);
      onRequestCreated();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error creating order';
      setErrorMsg(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full shadow-2xl overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Package className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-semibold text-slate-100">Create Delivery Request</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4 text-xs">
          {errorMsg && (
            <div className="p-2.5 rounded bg-rose-500/10 border border-rose-500/30 text-rose-300">
              {errorMsg}
            </div>
          )}

          {/* Quick Hub Presets */}
          <div>
            <label className="text-[11px] text-slate-400 font-medium block mb-1.5">
              Quick Bengaluru Hub Presets:
            </label>
            <div className="flex flex-wrap gap-1.5">
              {PRESET_HUBS.map((hub) => (
                <button
                  type="button"
                  key={hub.name}
                  onClick={() => {
                    setPickupLat(hub.lat.toFixed(4));
                    setPickupLng(hub.lng.toFixed(4));
                  }}
                  className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] border border-slate-700 transition"
                >
                  {hub.name}
                </button>
              ))}
            </div>
          </div>

          {/* Pickup Location */}
          <div className="space-y-1.5 p-3 rounded-lg bg-slate-950/60 border border-slate-800">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-blue-400 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5" /> Pickup Location
              </span>
              <button
                type="button"
                onClick={() => setPickingMode(pickingMode === 'pickup' ? null : 'pickup')}
                className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium transition border ${
                  pickingMode === 'pickup'
                    ? 'bg-blue-600 text-white border-blue-500'
                    : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                }`}
              >
                <Crosshair className="w-3 h-3" />
                {pickingMode === 'pickup' ? 'Click on map...' : 'Pick on map'}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-slate-500">Latitude</label>
                <input
                  type="number"
                  step="any"
                  value={pickupLat}
                  onChange={(e) => setPickupLat(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded bg-slate-900 border border-slate-800 text-slate-200 text-xs font-mono focus:outline-none focus:border-blue-500"
                  required
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-500">Longitude</label>
                <input
                  type="number"
                  step="any"
                  value={pickupLng}
                  onChange={(e) => setPickupLng(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded bg-slate-900 border border-slate-800 text-slate-200 text-xs font-mono focus:outline-none focus:border-blue-500"
                  required
                />
              </div>
            </div>
          </div>

          {/* Dropoff Location */}
          <div className="space-y-1.5 p-3 rounded-lg bg-slate-950/60 border border-slate-800">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-purple-400 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5" /> Dropoff Location
              </span>
              <button
                type="button"
                onClick={() => setPickingMode(pickingMode === 'dropoff' ? null : 'dropoff')}
                className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium transition border ${
                  pickingMode === 'dropoff'
                    ? 'bg-purple-600 text-white border-purple-500'
                    : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                }`}
              >
                <Crosshair className="w-3 h-3" />
                {pickingMode === 'dropoff' ? 'Click on map...' : 'Pick on map'}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-slate-500">Latitude</label>
                <input
                  type="number"
                  step="any"
                  value={dropLat}
                  onChange={(e) => setDropLat(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded bg-slate-900 border border-slate-800 text-slate-200 text-xs font-mono focus:outline-none focus:border-purple-500"
                  required
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-500">Longitude</label>
                <input
                  type="number"
                  step="any"
                  value={dropLng}
                  onChange={(e) => setDropLng(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded bg-slate-900 border border-slate-800 text-slate-200 text-xs font-mono focus:outline-none focus:border-purple-500"
                  required
                />
              </div>
            </div>
          </div>

          {/* Priority */}
          <div>
            <label className="text-[11px] text-slate-400 font-medium block mb-1">
              Priority (1 = Standard, 3 = High, 5 = Urgent)
            </label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((lvl) => (
                <button
                  type="button"
                  key={lvl}
                  onClick={() => setPriority(lvl)}
                  className={`flex-1 py-1.5 rounded font-mono font-medium transition border ${
                    priority === lvl
                      ? 'bg-emerald-600 text-white border-emerald-500 shadow'
                      : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
                  }`}
                >
                  {lvl}
                </button>
              ))}
            </div>
          </div>

          {/* Submit */}
          <div className="pt-2 flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 rounded-md bg-slate-800 text-slate-300 hover:bg-slate-700 font-medium transition"
            >
              Cancel
            </button>
            <button
              data-testid="submit-request-btn"
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-2 rounded-md bg-emerald-600 text-white hover:bg-emerald-500 font-medium shadow-sm transition disabled:opacity-50"
            >
              {isSubmitting ? 'Dispatching...' : 'Dispatch Order'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
