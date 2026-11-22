'use client';

import React from 'react';
import { DeadZoneAlert, RepositioningHint } from '@fleet-pulse/shared';
import {
  AlertTriangle,
  ArrowRight,
  Compass,
  Navigation,
  ShieldAlert,
} from 'lucide-react';

interface RepositionAlertsProps {
  hints: RepositioningHint[];
  deadZones: DeadZoneAlert[];
  onFlyToZone?: (coords: { lat: number; lng: number }) => void;
}

export function RepositionAlerts({
  hints,
  deadZones,
  onFlyToZone,
}: RepositionAlertsProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Dead-Zone Critical Alerts */}
      <div className="rounded-xl bg-slate-900/90 border border-slate-800 p-4 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400">
                <ShieldAlert className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-100">
                  Dead-Zone Detection
                </h3>
                <p className="text-[11px] text-slate-400">
                  Areas with unassigned requests exceeding wait threshold (&gt;120s)
                </p>
              </div>
            </div>
            <span className="text-xs font-mono font-medium px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20">
              {deadZones.length} Active
            </span>
          </div>

          <div className="mt-3 space-y-2 max-h-56 overflow-y-auto pr-1">
            {deadZones.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400 flex flex-col items-center justify-center">
                <div className="w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-1.5">
                  ✓
                </div>
                <span>No active dead zones detected. Fleet dispatch coverage is optimal.</span>
              </div>
            ) : (
              deadZones.map((alert, i) => (
                <div
                  key={i}
                  className={`p-3 rounded-lg border text-xs flex items-start justify-between gap-3 ${
                    alert.alertLevel === 'critical'
                      ? 'bg-rose-500/10 border-rose-500/30 text-rose-200'
                      : 'bg-amber-500/10 border-amber-500/30 text-amber-200'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                    <div>
                      <div className="font-semibold text-slate-100 flex items-center gap-2">
                        <span>{alert.zoneName}</span>
                        <span className="text-[10px] uppercase font-mono px-1.5 py-0.2 rounded bg-black/30">
                          {alert.alertLevel}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-300 mt-0.5">
                        {alert.message}
                      </p>
                      <div className="text-[10px] text-slate-400 font-mono mt-1">
                        Max wait: <span className="font-semibold text-slate-200">{alert.maxWaitSeconds}s</span> | Pending: <span className="font-semibold text-slate-200">{alert.pendingCount}</span>
                      </div>
                    </div>
                  </div>

                  {onFlyToZone && (
                    <button
                      onClick={() => onFlyToZone({ lat: alert.lat, lng: alert.lng })}
                      className="shrink-0 p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
                      title="Fly to zone on map"
                    >
                      <Navigation className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Idle-Driver Repositioning Recommendations */}
      <div className="rounded-xl bg-slate-900/90 border border-slate-800 p-4 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
                <Compass className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-100">
                  Idle-Driver Repositioning Hints
                </h3>
                <p className="text-[11px] text-slate-400">
                  High-demand clusters with low local available driver supply
                </p>
              </div>
            </div>
            <span className="text-xs font-mono font-medium px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              {hints.length} Recommendations
            </span>
          </div>

          <div className="mt-3 space-y-2 max-h-56 overflow-y-auto pr-1">
            {hints.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400">
                Supply and demand are currently well-balanced across all commercial zones.
              </div>
            ) : (
              hints.slice(0, 4).map((hint, i) => (
                <div
                  key={i}
                  className="p-3 rounded-lg bg-slate-800/60 border border-slate-700/60 text-xs flex items-center justify-between"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-100">
                        {hint.zoneName}
                      </span>
                      <span
                        className={`text-[9px] font-mono px-1.5 py-0.5 rounded uppercase ${
                          hint.priority === 'high'
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            : hint.priority === 'medium'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        }`}
                      >
                        {hint.priority}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono mt-1">
                      Local supply: <span className="text-slate-200">{hint.availableNearbyDrivers} avail</span> | Demand weight: <span className="text-slate-200">{hint.demandWeight}x</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-bold text-cyan-400 font-mono bg-cyan-500/10 border border-cyan-500/20 px-2 py-1 rounded-md">
                      +{hint.recommendedRepositionCount} Drivers
                    </span>
                    {onFlyToZone && (
                      <button
                        onClick={() => onFlyToZone({ lat: hint.lat, lng: hint.lng })}
                        className="p-1 rounded bg-slate-700 hover:bg-slate-600 text-slate-200 transition"
                        title="View zone on map"
                      >
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
