'use client';

import React, { useState } from 'react';
import { Navigation, Phone, Search, Star } from 'lucide-react';
import { DriverMarkerData } from '../../types/dashboard';
import { STATUS_COLORS } from '../../lib/constants';

interface DriversListProps {
  drivers: DriverMarkerData[];
  selectedDriverId: string | null;
  onSelectDriver: (driver: DriverMarkerData) => void;
  onFlyTo: (coords: { lat: number; lng: number }) => void;
}

export function DriversList({
  drivers,
  selectedDriverId,
  onSelectDriver,
  onFlyTo,
}: DriversListProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'available' | 'busy' | 'offline'>('all');

  const filteredDrivers = drivers.filter((d) => {
    const matchesSearch =
      d.name.toLowerCase().includes(search.toLowerCase()) ||
      d.phone.includes(search);
    const matchesStatus =
      statusFilter === 'all' || d.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const availableCount = drivers.filter((d) => d.status === 'available').length;
  const busyCount = drivers.filter((d) => d.status === 'busy').length;

  return (
    <div className="flex flex-col h-full">
      {/* Search Bar */}
      <div className="p-3 border-b border-slate-800 bg-slate-900/60">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-slate-500" />
          <input
            type="text"
            placeholder="Search driver by name or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-md text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500/50"
          />
        </div>
      </div>

      {/* Filter Chips */}
      <div className="flex items-center gap-1.5 px-3 py-2 border-b border-slate-800 text-[11px] font-medium bg-slate-900/40">
        <button
          onClick={() => setStatusFilter('all')}
          className={`px-2 py-0.5 rounded transition ${
            statusFilter === 'all'
              ? 'bg-slate-800 text-slate-100'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          All ({drivers.length})
        </button>
        <button
          onClick={() => setStatusFilter('available')}
          className={`px-2 py-0.5 rounded transition ${
            statusFilter === 'available'
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Free ({availableCount})
        </button>
        <button
          onClick={() => setStatusFilter('busy')}
          className={`px-2 py-0.5 rounded transition ${
            statusFilter === 'busy'
              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Busy ({busyCount})
        </button>
      </div>

      {/* Drivers List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {filteredDrivers.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-xs">
            No drivers matching filter
          </div>
        ) : (
          filteredDrivers.map((driver) => {
            const isSelected = driver.id === selectedDriverId;
            const color = STATUS_COLORS[driver.status] || STATUS_COLORS.offline;

            return (
              <div
                key={driver.id}
                onClick={() => {
                  onSelectDriver(driver);
                  onFlyTo({ lat: driver.lat, lng: driver.lng });
                }}
                className={`p-2.5 rounded-lg border transition cursor-pointer flex flex-col gap-1.5 text-xs ${
                  isSelected
                    ? 'bg-slate-800/90 border-emerald-500/60 shadow-md ring-1 ring-emerald-500/30'
                    : 'bg-slate-900/70 border-slate-800/80 hover:bg-slate-800/60 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${color.bg}`} />
                    <span className="font-semibold text-slate-100">{driver.name}</span>
                  </div>
                  <div className="flex items-center gap-1 text-[11px] text-amber-400 font-mono">
                    <Star className="w-3 h-3 fill-amber-400" />
                    <span>{driver.rating.toFixed(1)}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <div className="flex items-center gap-1">
                    <Phone className="w-3 h-3 text-slate-500" />
                    <span className="font-mono">{driver.phone}</span>
                  </div>
                  {driver.speed !== undefined && (
                    <div className="flex items-center gap-1 text-slate-500 font-mono">
                      <Navigation
                        className="w-3 h-3"
                        style={{ transform: `rotate(${driver.heading}deg)` }}
                      />
                      <span>{driver.speed} km/h</span>
                    </div>
                  )}
                </div>

                {driver.activeRequestId && (
                  <div className="text-[10px] text-amber-300 font-mono pt-1 border-t border-slate-800">
                    Active Order: #{driver.activeRequestId.slice(0, 8)}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
