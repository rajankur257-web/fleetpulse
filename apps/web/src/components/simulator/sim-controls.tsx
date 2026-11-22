'use client';

import React, { useEffect, useState } from 'react';
import { Play, Square, Gauge, Users, Activity, X } from 'lucide-react';
import { getSimulatorStatus, startSimulator, stopSimulator } from '../../lib/api';

interface SimControlsProps {
  isVisible: boolean;
  onClose: () => void;
}

export function SimControls({ isVisible, onClose }: SimControlsProps) {
  const [running, setRunning] = useState(false);
  const [driverCount, setDriverCount] = useState(50);
  const [speedMultiplier, setSpeedMultiplier] = useState(10);
  const [requestRate, setRequestRate] = useState(15);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<{
    elapsedSeconds?: number;
    requestsCreated?: number;
    requestsAssigned?: number;
    requestsCompleted?: number;
    doubleAssignmentsDetected?: number;
  }>({});

  // Poll simulator status every 2 seconds when open
  useEffect(() => {
    if (!isVisible) return;

    const check = async () => {
      try {
        const s = await getSimulatorStatus();
        if (s) {
          setRunning(s.running);
          setStats(s);
          if (s.driverCount) setDriverCount(s.driverCount);
          if (s.speedMultiplier) setSpeedMultiplier(s.speedMultiplier);
        }
      } catch {
        // API offline or not ready
      }
    };

    check();
    const interval = setInterval(check, 2000);
    return () => clearInterval(interval);
  }, [isVisible]);

  if (!isVisible) return null;

  const handleToggle = async () => {
    setLoading(true);
    try {
      if (running) {
        await stopSimulator();
        setRunning(false);
      } else {
        await startSimulator({
          driverCount,
          speedMultiplier,
          requestRatePerMinute: requestRate,
          acceptProbability: 0.85,
          seed: 42,
        });
        setRunning(true);
      }
    } catch (err) {
      console.error('Simulator toggle error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      data-testid="sim-controls-panel"
      className="absolute bottom-6 left-6 z-40 bg-slate-950/95 backdrop-blur border border-slate-800 rounded-xl p-4 shadow-2xl w-80 text-xs text-slate-200 flex flex-col gap-3"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <div className="flex items-center gap-2">
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              running ? 'bg-emerald-500 animate-pulse' : 'bg-slate-600'
            }`}
          />
          <h4 className="font-bold tracking-wide uppercase text-slate-100 text-[11px]">
            Simulator Controller
          </h4>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded text-slate-400 hover:text-slate-100 transition"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Real-time stats if active */}
      {running && (
        <div className="grid grid-cols-3 gap-1.5 p-2 rounded bg-slate-900 border border-slate-800 font-mono text-[10px] text-center">
          <div>
            <div className="text-slate-500">Created</div>
            <div className="font-semibold text-blue-400">{stats.requestsCreated ?? 0}</div>
          </div>
          <div>
            <div className="text-slate-500">Assigned</div>
            <div className="font-semibold text-amber-400">{stats.requestsAssigned ?? 0}</div>
          </div>
          <div>
            <div className="text-slate-500">Completed</div>
            <div className="font-semibold text-emerald-400">{stats.requestsCompleted ?? 0}</div>
          </div>
          <div className="col-span-3 pt-1 border-t border-slate-800 flex justify-between px-1">
            <span className="text-slate-500">Double Assigns:</span>
            <span className="text-emerald-400 font-bold">{stats.doubleAssignmentsDetected ?? 0}</span>
          </div>
        </div>
      )}

      {/* Sliders */}
      <div className="space-y-2">
        <div>
          <div className="flex justify-between text-[11px] text-slate-400 mb-1">
            <span className="flex items-center gap-1">
              <Users className="w-3 h-3" /> Drivers
            </span>
            <span className="font-mono text-slate-200">{driverCount}</span>
          </div>
          <input
            type="range"
            min="10"
            max="150"
            step="10"
            disabled={running}
            value={driverCount}
            onChange={(e) => setDriverCount(Number(e.target.value))}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500 disabled:opacity-50"
          />
        </div>

        <div>
          <div className="flex justify-between text-[11px] text-slate-400 mb-1">
            <span className="flex items-center gap-1">
              <Gauge className="w-3 h-3" /> Speed Multiplier
            </span>
            <span className="font-mono text-slate-200">{speedMultiplier}x</span>
          </div>
          <input
            type="range"
            min="1"
            max="20"
            step="1"
            disabled={running}
            value={speedMultiplier}
            onChange={(e) => setSpeedMultiplier(Number(e.target.value))}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500 disabled:opacity-50"
          />
        </div>

        <div>
          <div className="flex justify-between text-[11px] text-slate-400 mb-1">
            <span className="flex items-center gap-1">
              <Activity className="w-3 h-3" /> Rate (req/min)
            </span>
            <span className="font-mono text-slate-200">{requestRate}</span>
          </div>
          <input
            type="range"
            min="5"
            max="40"
            step="5"
            disabled={running}
            value={requestRate}
            onChange={(e) => setRequestRate(Number(e.target.value))}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500 disabled:opacity-50"
          />
        </div>
      </div>

      {/* Toggle Start/Stop Button */}
      <button
        onClick={handleToggle}
        disabled={loading}
        className={`w-full py-2 rounded-lg font-semibold flex items-center justify-center gap-2 transition shadow-md disabled:opacity-50 ${
          running
            ? 'bg-rose-600 hover:bg-rose-500 text-white'
            : 'bg-emerald-600 hover:bg-emerald-500 text-white'
        }`}
      >
        {running ? (
          <>
            <Square className="w-3.5 h-3.5 fill-white" />
            <span>Stop Simulation</span>
          </>
        ) : (
          <>
            <Play className="w-3.5 h-3.5 fill-white" />
            <span>Start Simulation</span>
          </>
        )}
      </button>
    </div>
  );
}
