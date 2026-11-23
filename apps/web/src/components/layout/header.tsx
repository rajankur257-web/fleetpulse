'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Activity,
  BarChart3,
  MapPin,
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
  socketStatus?: SocketStatus;
  availableDriversCount?: number;
  totalDriversCount?: number;
  activeRequestsCount?: number;
  onOpenCreateModal?: () => void;
  showSimControls?: boolean;
  onToggleSimControls?: () => void;
}

export function Header({
  socketStatus = 'connected',
  availableDriversCount = 0,
  totalDriversCount = 0,
  activeRequestsCount = 0,
  onOpenCreateModal,
  showSimControls = false,
  onToggleSimControls,
}: HeaderProps) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = (theme || resolvedTheme) === 'dark';

  const handleToggleTheme = () => {
    setTheme(isDark ? 'light' : 'dark');
  };

  return (
    <header className="h-14 bg-white/90 dark:bg-slate-950/80 backdrop-blur border-b border-slate-200 dark:border-slate-800/80 px-4 flex items-center justify-between z-30 shrink-0 transition-colors duration-200">
      {/* Brand & Live Connection Indicator */}
      <div className="flex items-center gap-4">
        <Link href="/" className="flex items-center gap-2 hover:opacity-90 transition">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-500 dark:text-emerald-400">
            <Zap className="w-4 h-4 fill-emerald-500 dark:fill-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm tracking-wider uppercase text-slate-900 dark:text-slate-100">
                Fleet Pulse
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700">
                DISPATCH HUD
              </span>
            </div>
          </div>
        </Link>

        {/* View Navigation Tabs */}
        <nav className="flex items-center bg-slate-100 border border-slate-200 dark:bg-slate-900 dark:border-slate-800 p-0.5 rounded-lg text-xs font-medium ml-2">
          <Link
            href="/"
            data-testid="nav-live-dispatch"
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition ${
              pathname === '/'
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-slate-100'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <MapPin className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
            <span>Map HUD</span>
          </Link>
          <Link
            href="/analytics"
            data-testid="nav-analytics"
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition ${
              pathname === '/analytics'
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-slate-100'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5 text-cyan-500 dark:text-cyan-400" />
            <span>Analytics & Replay</span>
          </Link>
        </nav>

        {/* WebSocket Live Status */}
        <div
          data-testid="socket-indicator"
          className="flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-mono bg-slate-100 border border-slate-200 dark:bg-slate-900 dark:border-slate-800"
        >
          {socketStatus === 'connected' && (
            <>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span className="text-emerald-600 dark:text-emerald-400 font-medium">LIVE CONNECTED</span>
            </>
          )}
          {socketStatus === 'reconnecting' && (
            <>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
              </span>
              <span className="text-amber-600 dark:text-amber-400 font-medium">RECONNECTING...</span>
            </>
          )}
          {socketStatus === 'disconnected' && (
            <>
              <span className="h-2 w-2 rounded-full bg-rose-500" />
              <span className="text-rose-600 dark:text-rose-400 font-medium">DISCONNECTED</span>
            </>
          )}
        </div>
      </div>

      {/* Fleet Metrics Strip */}
      <div className="hidden md:flex items-center gap-6 text-xs font-mono">
        <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
          <Radio className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
          <span>Drivers:</span>
          <span className="font-semibold text-slate-800 dark:text-slate-200">
            <span className="text-emerald-600 dark:text-emerald-400">{availableDriversCount}</span> / {totalDriversCount} Avail
          </span>
        </div>

        <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
          <Activity className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
          <span>Active Orders:</span>
          <span className="font-semibold text-amber-600 dark:text-amber-400">{activeRequestsCount}</span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2">
        {onToggleSimControls && (
          <button
            onClick={onToggleSimControls}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition ${
              showSimControls
                ? 'bg-amber-500/20 border-amber-500/40 text-amber-700 dark:text-amber-300'
                : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200 hover:text-slate-900 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
            }`}
            title="Toggle Simulator HUD"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Simulator</span>
          </button>
        )}

        {onOpenCreateModal && (
          <button
            data-testid="create-request-btn"
            onClick={onOpenCreateModal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Delivery</span>
          </button>
        )}

        <button
          onClick={handleToggleTheme}
          className="p-1.5 rounded-md bg-slate-100 border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-200 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800 transition"
          aria-label="Toggle theme"
          title={isDark ? 'Switch to day mode' : 'Switch to night mode'}
        >
          {mounted ? (
            isDark ? (
              <Sun className="w-4 h-4 text-amber-500 hover:text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-indigo-600 hover:text-indigo-500" />
            )
          ) : (
            <div className="w-4 h-4" />
          )}
        </button>
      </div>
    </header>
  );
}
