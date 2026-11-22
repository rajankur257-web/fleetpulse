'use client';

import React from 'react';
import {
  Activity,
  Plus,
  Radio,
  Sliders,
  Sun,
  Moon,
  Zap,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { SocketStatus } from '../../types/dashboard';

interface HeaderProps {
  socketStatus: SocketStatus;
  availableDriversCount: number;
  totalDriversCount: number;
  activeRequestsCount: number;
  onOpenCreateModal: () => void;
  showSimControls: boolean;
  onToggleSimControls: () => void;
}

export function Header({
  socketStatus,
  availableDriversCount,
  totalDriversCount,
  activeRequestsCount,
  onOpenCreateModal,
  showSimControls,
  onToggleSimControls,
}: HeaderProps) {
  const { theme, setTheme } = useTheme();

  return (
    <header className="h-14 bg-slate-950/80 backdrop-blur border-b border-slate-800/80 px-4 flex items-center justify-between z-30 shrink-0">
      {/* Brand & Live Connection Indicator */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Zap className="w-4 h-4 fill-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm tracking-wider uppercase text-slate-100">
                Fleet Pulse
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                DISPATCH HUD
              </span>
            </div>
          </div>
        </div>

        {/* WebSocket Live Status */}
        <div
          data-testid="socket-indicator"
          className="flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-mono bg-slate-900 border border-slate-800"
        >
          {socketStatus === 'connected' && (
            <>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span className="text-emerald-400 font-medium">LIVE CONNECTED</span>
            </>
          )}
          {socketStatus === 'reconnecting' && (
            <>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
              </span>
              <span className="text-amber-400 font-medium">RECONNECTING...</span>
            </>
          )}
          {socketStatus === 'disconnected' && (
            <>
              <span className="h-2 w-2 rounded-full bg-rose-500" />
              <span className="text-rose-400 font-medium">DISCONNECTED</span>
            </>
          )}
        </div>
      </div>

      {/* Fleet Metrics Strip */}
      <div className="hidden md:flex items-center gap-6 text-xs font-mono">
        <div className="flex items-center gap-2 text-slate-400">
          <Radio className="w-3.5 h-3.5 text-emerald-400" />
          <span>Drivers:</span>
          <span className="font-semibold text-slate-200">
            <span className="text-emerald-400">{availableDriversCount}</span> / {totalDriversCount} Avail
          </span>
        </div>

        <div className="flex items-center gap-2 text-slate-400">
          <Activity className="w-3.5 h-3.5 text-amber-400" />
          <span>Active Orders:</span>
          <span className="font-semibold text-amber-400">{activeRequestsCount}</span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2">
        <button
          onClick={onToggleSimControls}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition ${
            showSimControls
              ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
              : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white'
          }`}
          title="Toggle Simulator HUD"
        >
          <Sliders className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Simulator</span>
        </button>

        <button
          data-testid="create-request-btn"
          onClick={onOpenCreateModal}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Delivery</span>
        </button>

        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="p-1.5 rounded-md bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 transition"
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
      </div>
    </header>
  );
}
