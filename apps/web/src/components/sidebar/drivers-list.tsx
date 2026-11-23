'use client';

import React, { useState } from 'react';
import { Navigation, Phone, Search, Star, User } from 'lucide-react';
import { DeliveryRequestData, DriverMarkerData } from '../../types/dashboard';
import { STATUS_COLORS } from '../../lib/constants';
import {
  getCustomerName,
  getFormattedDriverName,
  getFormattedDriverPhone,
  getNeighborhoodName,
} from '../../lib/order-metadata';

interface DriversListProps {
  drivers: DriverMarkerData[];
  requests?: DeliveryRequestData[];
  selectedDriverId: string | null;
  onSelectDriver: (driver: DriverMarkerData) => void;
  onFlyTo: (coords: { lat: number; lng: number }) => void;
}

export function DriversList({
  drivers,
  requests = [],
  selectedDriverId,
  onSelectDriver,
  onFlyTo,
}: DriversListProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'available' | 'busy' | 'offline'>('all');

  const filteredDrivers = drivers.filter((d) => {
    const displayName = getFormattedDriverName(d.name, d.id);
    const matchesSearch =
      displayName.toLowerCase().includes(search.toLowerCase()) ||
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
      <div className="p-3 border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/60">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-slate-400 dark:text-slate-500" />
          <input
            type="text"
            placeholder="Search driver by name or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-md text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500/50 dark:bg-slate-950 dark:border-slate-800 dark:text-slate-200 dark:placeholder-slate-500"
          />
        </div>
      </div>

      {/* Filter Chips */}
      <div className="flex items-center gap-1.5 px-3 py-2 border-b border-slate-200 text-[11px] font-medium bg-slate-100/70 dark:border-slate-800 dark:bg-slate-900/40">
        <button
          onClick={() => setStatusFilter('all')}
          className={`px-2 py-0.5 rounded transition ${
            statusFilter === 'all'
              ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-slate-100'
              : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          All ({drivers.length})
        </button>
        <button
          onClick={() => setStatusFilter('available')}
          className={`px-2 py-0.5 rounded transition ${
            statusFilter === 'available'
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/30'
              : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          Free ({availableCount})
        </button>
        <button
          onClick={() => setStatusFilter('busy')}
          className={`px-2 py-0.5 rounded transition ${
            statusFilter === 'busy'
              ? 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-500/20 dark:text-amber-400 dark:border-amber-500/30'
              : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          Busy ({busyCount})
        </button>
      </div>

      {/* Drivers List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {filteredDrivers.length === 0 ? (
          <div className="text-center py-12 text-slate-400 dark:text-slate-500 text-xs">
            No drivers matching filter
          </div>
        ) : (
          filteredDrivers.map((driver) => {
            const isSelected = driver.id === selectedDriverId;
            const color = STATUS_COLORS[driver.status] || STATUS_COLORS.offline;
            const displayName = getFormattedDriverName(driver.name, driver.id);

            return (
              <div
                key={driver.id}
                onClick={() => {
                  onSelectDriver(driver);
                  onFlyTo({ lat: driver.lat, lng: driver.lng });
                }}
                className={`p-2.5 rounded-lg border transition cursor-pointer flex flex-col gap-1.5 text-xs ${
                  isSelected
                    ? 'bg-emerald-50/80 border-emerald-500/80 shadow-sm ring-1 ring-emerald-500/30 dark:bg-slate-800/90 dark:border-emerald-500/60 dark:shadow-md'
                    : 'bg-white border-slate-200 hover:bg-slate-50 hover:border-slate-300 dark:bg-slate-900/70 dark:border-slate-800/80 dark:hover:bg-slate-800/60 dark:hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${color.bg}`} />
                    <span className="font-semibold text-slate-900 dark:text-slate-100">{displayName}</span>
                  </div>
                  <div className="flex items-center gap-1 text-[11px] text-amber-500 dark:text-amber-400 font-mono">
                    <Star className="w-3 h-3 fill-amber-500 dark:fill-amber-400" />
                    <span>{driver.rating.toFixed(1)}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-400">
                  <div className="flex items-center gap-1">
                    <Phone className="w-3 h-3 text-slate-400 dark:text-slate-500" />
                    <span className="font-mono">{getFormattedDriverPhone(driver.phone, driver.id)}</span>
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
                  <div className="text-[10px] text-amber-700 dark:text-amber-300 font-mono pt-1 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-1">
                    <span className="font-sans font-medium truncate flex items-center gap-1">
                      <User className="w-3 h-3 text-amber-500 shrink-0" />
                      <span className="truncate">
                        To: {getCustomerName(driver.activeRequestId)}
                        {(() => {
                          const matched = requests.find((r) => r.id === driver.activeRequestId);
                          return matched ? ` (${getNeighborhoodName(matched.dropLat, matched.dropLng)})` : '';
                        })()}
                      </span>
                    </span>
                    <span className="shrink-0 text-slate-400 text-[9px]">#{driver.activeRequestId.slice(0, 6)}</span>
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
