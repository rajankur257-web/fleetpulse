'use client';

import React, { useState } from 'react';
import { Clock, Package } from 'lucide-react';
import { DeliveryRequestData } from '../../types/dashboard';
import { REQUEST_STATUS_COLORS } from '../../lib/constants';

interface RequestsQueueProps {
  requests: DeliveryRequestData[];
  onFlyTo: (coords: { lat: number; lng: number }) => void;
}

export function RequestsQueue({ requests, onFlyTo }: RequestsQueueProps) {
  const [filter, setFilter] = useState<'all' | 'pending' | 'active' | 'delivered'>('all');

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

            return (
              <div
                key={req.id}
                onClick={() => onFlyTo({ lat: req.pickupLat, lng: req.pickupLng })}
                className="p-3 rounded-lg bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 dark:bg-slate-900/90 dark:border-slate-800/80 dark:hover:border-slate-700 dark:hover:bg-slate-800/70 cursor-pointer transition flex flex-col gap-2 text-xs shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-mono text-[11px] text-slate-700 dark:text-slate-300">
                    <Package className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400" />
                    <span>#{req.id.slice(0, 8)}</span>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${statusConfig.bg}`}
                  >
                    {statusConfig.label}
                  </span>
                </div>

                {/* Pickup & Drop coords */}
                <div className="space-y-1 text-[11px] text-slate-600 dark:text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                    <span className="truncate">
                      Pick: {req.pickupLat.toFixed(4)}, {req.pickupLng.toFixed(4)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-purple-500 shrink-0" />
                    <span className="truncate">
                      Drop: {req.dropLat.toFixed(4)}, {req.dropLng.toFixed(4)}
                    </span>
                  </div>
                </div>

                {/* Footer metadata */}
                <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-200 dark:border-slate-800/60 font-mono">
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
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
                  {req.assignedDriverId ? (
                    <span className="text-amber-600 dark:text-amber-400">Driver: #{req.assignedDriverId.slice(0, 6)}</span>
                  ) : (
                    <span className="text-slate-400 dark:text-slate-500">Unassigned</span>
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
