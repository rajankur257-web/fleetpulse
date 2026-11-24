'use client';

import React, { useMemo, useState } from 'react';
import { ArrowRight, Clock, Navigation, Package, User } from 'lucide-react';
import { DeliveryRequestData, DriverMarkerData } from '../../types/dashboard';
import { REQUEST_STATUS_COLORS } from '../../lib/constants';
import {
  getCustomerName,
  getFormattedDriverName,
  getNeighborhoodName,
  getPackageType,
} from '../../lib/order-metadata';

interface RequestsQueueProps {
  requests: DeliveryRequestData[];
  drivers?: DriverMarkerData[];
  onFlyTo: (coords: { lat: number; lng: number }) => void;
  onSelectDriver?: (driver: DriverMarkerData | null) => void;
  selectedDriverId?: string | null;
}

export function RequestsQueue({
  requests,
  drivers = [],
  onFlyTo,
  onSelectDriver,
  selectedDriverId,
}: RequestsQueueProps) {
  const [filter, setFilter] = useState<'all' | 'pending' | 'active' | 'delivered'>('all');

  const driverMap = useMemo(() => {
    const map = new Map<string, DriverMarkerData>();
    for (const d of drivers) {
      map.set(d.id, d);
    }
    return map;
  }, [drivers]);

  const filteredRequests = requests.filter((r) => {
    if (filter === 'all') return true;
    if (filter === 'pending') return r.status === 'pending' || r.status === 'offered';
    if (filter === 'active') return r.status === 'assigned' || r.status === 'picked_up';
    if (filter === 'delivered') return r.status === 'delivered';
    return true;
  });

  const pendingCount = requests.filter((r) => r.status === 'pending' || r.status === 'offered').length;
  const activeCount = requests.filter((r) => r.status === 'assigned' || r.status === 'picked_up').length;

  return (
    <div className="flex flex-col h-full">
      {/* Sub-tabs filter */}
      <div className="flex items-center gap-1 p-2 bg-slate-100/90 border-b border-slate-200 text-xs dark:bg-slate-900/60 dark:border-slate-800">
        <button
          onClick={() => setFilter('all')}
          className={`flex-1 py-1 rounded transition text-center font-medium ${
            filter === 'all'
              ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-slate-100'
              : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          All ({requests.length})
        </button>
        <button
          onClick={() => setFilter('pending')}
          className={`flex-1 py-1 rounded transition text-center font-medium ${
            filter === 'pending'
              ? 'bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-600/20 dark:text-blue-300 dark:border-blue-500/30'
              : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          Pending ({pendingCount})
        </button>
        <button
          onClick={() => setFilter('active')}
          className={`flex-1 py-1 rounded transition text-center font-medium ${
            filter === 'active'
              ? 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-600/20 dark:text-amber-300 dark:border-amber-500/30'
              : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          Active ({activeCount})
        </button>
        <button
          onClick={() => setFilter('delivered')}
          className={`flex-1 py-1 rounded transition text-center font-medium ${
            filter === 'delivered'
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-600/20 dark:text-emerald-300 dark:border-emerald-500/30'
              : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          Done
        </button>
      </div>

      {/* Request List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {filteredRequests.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-xs flex flex-col items-center gap-2">
            <Package className="w-8 h-8 stroke-1 text-slate-400 dark:text-slate-600" />
            <p>No delivery orders in this view</p>
          </div>
        ) : (
          filteredRequests.map((req) => {
            const statusConfig = REQUEST_STATUS_COLORS[req.status] || {
              bg: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400',
              label: req.status,
            };

            const customerName = getCustomerName(req.id);
            const packageType = getPackageType(req.id);
            const pickupArea = getNeighborhoodName(req.pickupLat, req.pickupLng);
            const dropArea = getNeighborhoodName(req.dropLat, req.dropLng);

            // Resolve assigned driver real name
            let assignedDriverDisplay: string | null = null;
            if (req.assignedDriverId) {
              const matchedDriver = driverMap.get(req.assignedDriverId);
              assignedDriverDisplay = matchedDriver
                ? getFormattedDriverName(matchedDriver.name, matchedDriver.id)
                : getFormattedDriverName(null, req.assignedDriverId);
            }

            const isDriverSelected = Boolean(
              req.assignedDriverId && req.assignedDriverId === selectedDriverId,
            );

            return (
              <div
                key={req.id}
                onClick={() => {
                  if (req.assignedDriverId) {
                    const matched = driverMap.get(req.assignedDriverId);
                    if (matched) {
                      if (onSelectDriver) onSelectDriver(matched);
                      onFlyTo({ lat: matched.lat, lng: matched.lng });
                      return;
                    }
                  }
                  onFlyTo({ lat: req.pickupLat, lng: req.pickupLng });
                }}
                className={`p-3 rounded-lg border transition flex flex-col gap-2 text-xs shadow-sm cursor-pointer ${
                  isDriverSelected
                    ? 'ring-2 ring-amber-400 bg-amber-50/50 border-amber-400 dark:bg-amber-950/20 dark:border-amber-500/60 shadow-md'
                    : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50 dark:bg-slate-900/90 dark:border-slate-800/80 dark:hover:border-slate-700 dark:hover:bg-slate-800/70'
                }`}
              >
                {/* Header: Customer Name, Package Type & Status */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-col">
                    <div className="flex items-center gap-1.5 font-semibold text-slate-900 dark:text-slate-100 text-xs">
                      <User className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400 shrink-0" />
                      <span>{customerName}</span>
                    </div>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                      <Package className="w-2.5 h-2.5" />
                      {packageType} • <span className="font-mono">#{req.id.slice(0, 6)}</span>
                    </span>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border shrink-0 ${statusConfig.bg}`}
                  >
                    {statusConfig.label}
                  </span>
                </div>

                {/* Human-readable Route Hubs */}
                <div className="p-1.5 rounded bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-slate-700 dark:text-slate-300">
                  <div className="flex items-center gap-1 font-medium truncate">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                    <span className="truncate">{pickupArea}</span>
                  </div>
                  <ArrowRight className="w-3 h-3 text-slate-400 shrink-0 mx-1" />
                  <div className="flex items-center gap-1 font-medium truncate text-right">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-500 shrink-0" />
                    <span className="truncate">{dropArea}</span>
                  </div>
                </div>

                {/* Pickup & Drop Coords (subtle) */}
                <div className="flex items-center justify-between text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                  <span>Pick: {req.pickupLat.toFixed(3)}, {req.pickupLng.toFixed(3)}</span>
                  <span>Drop: {req.dropLat.toFixed(3)}, {req.dropLng.toFixed(3)}</span>
                </div>

                {/* Locate Driver Quick Action Button (if assigned) */}
                {req.assignedDriverId && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      const matched = driverMap.get(req.assignedDriverId!);
                      if (matched) {
                        if (onSelectDriver) onSelectDriver(matched);
                        onFlyTo({ lat: matched.lat, lng: matched.lng });
                      }
                    }}
                    className="w-full py-1.5 px-2.5 rounded-md bg-amber-100/70 hover:bg-amber-100 text-amber-900 border border-amber-300 dark:bg-amber-500/10 dark:hover:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/30 flex items-center justify-center gap-1.5 font-bold text-[11px] transition shadow-xs"
                  >
                    <Navigation className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                    <span>Locate Driver Holding Parcel ({assignedDriverDisplay})</span>
                  </button>
                )}

                {/* Footer Metadata: Timestamp & Assigned Driver */}
                <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 pt-1.5 border-t border-slate-100 dark:border-slate-800/60 font-mono">
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-400" />
                    <span>
                      {req.createdAt
                        ? new Date(req.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })
                        : '--:--'}
                    </span>
                  </div>
                  {assignedDriverDisplay ? (
                    <span className="text-amber-700 dark:text-amber-300 font-semibold flex items-center gap-1 font-sans">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                      {assignedDriverDisplay}
                    </span>
                  ) : (
                    <span className="text-slate-400 dark:text-slate-500 font-sans italic">Unassigned</span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
