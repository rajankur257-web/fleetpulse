'use client';

import React, { useCallback, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AlgorithmComparisonResponse,
  AnalyticsSummary,
  DeadZoneAlert,
  HeatmapPoint,
  PulseScoreResult,
  RepositioningHint,
} from '@fleet-pulse/shared';
import {
  BarChart3,
  RefreshCw,
} from 'lucide-react';
import { Header } from '../../components/layout/header';
import { SummaryCards } from '../../components/analytics/summary-cards';
import { DemandHeatmapMap } from '../../components/analytics/demand-heatmap-map';
import { RepositionAlerts } from '../../components/analytics/reposition-alerts';
import { AlgorithmComparison } from '../../components/analytics/algorithm-comparison';
import { EtaCalculator } from '../../components/analytics/eta-calculator';
import { PulseScoresTable } from '../../components/analytics/pulse-scores-table';
import {
  fetchAnalyticsSummary,
  fetchDeadZones,
  fetchHeatmap,
  fetchPulseScores,
  fetchRepositioningHints,
  runAlgorithmComparison,
} from '../../lib/api';

export default function AnalyticsDashboardPage() {
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(new Date());
  const [flyToCoords, setFlyToCoords] = useState<{ lat: number; lng: number } | null>(null);

  // Queries
  const {
    data: summary,
    refetch: refetchSummary,
    isFetching: isFetchingSummary,
  } = useQuery<AnalyticsSummary | null>({
    queryKey: ['analytics', 'summary'],
    queryFn: fetchAnalyticsSummary,
    refetchInterval: 15000,
  });

  const {
    data: heatmapPoints = [],
    refetch: refetchHeatmap,
  } = useQuery<HeatmapPoint[]>({
    queryKey: ['analytics', 'heatmap'],
    queryFn: fetchHeatmap,
    refetchInterval: 30000,
  });

  const {
    data: repositioningHints = [],
    refetch: refetchHints,
  } = useQuery<RepositioningHint[]>({
    queryKey: ['analytics', 'repositioning'],
    queryFn: fetchRepositioningHints,
    refetchInterval: 30000,
  });

  const {
    data: deadZones = [],
    refetch: refetchDeadZones,
  } = useQuery<DeadZoneAlert[]>({
    queryKey: ['analytics', 'dead-zones'],
    queryFn: fetchDeadZones,
    refetchInterval: 20000,
  });

  const {
    data: initialComparison,
  } = useQuery<AlgorithmComparisonResponse | null>({
    queryKey: ['analytics', 'compare', 'seed-42'],
    queryFn: () => runAlgorithmComparison({ seed: 42, driverCount: 40, requestCount: 25 }),
    staleTime: Infinity,
  });

  const {
    data: pulseScores = [],
    refetch: refetchPulseScores,
    isFetching: isFetchingPulseScores,
  } = useQuery<PulseScoreResult[]>({
    queryKey: ['analytics', 'pulse-scores'],
    queryFn: fetchPulseScores,
    refetchInterval: 20000,
  });

  const handleRefreshAll = useCallback(async () => {
    await Promise.all([
      refetchSummary(),
      refetchHeatmap(),
      refetchHints(),
      refetchDeadZones(),
      refetchPulseScores(),
    ]);
    setLastRefreshedAt(new Date());
  }, [
    refetchSummary,
    refetchHeatmap,
    refetchHints,
    refetchDeadZones,
    refetchPulseScores,
  ]);

  const handleFlyToZone = useCallback((coords: { lat: number; lng: number }) => {
    setFlyToCoords(coords);
    window.scrollTo({ top: 120, behavior: 'smooth' });
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 flex flex-col transition-colors duration-200">
      <Header />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Page Title & Refresh Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-500 dark:text-indigo-400">
                <BarChart3 className="w-5 h-5" />
              </div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
                Fleet Analytics & Intelligence
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1">
              Real-time operational KPIs, demand heatmap, dead-zone warnings, OSRM road routing, and deterministic algorithm replay.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-mono text-slate-500 hidden sm:inline">
              Updated: {lastRefreshedAt.toLocaleTimeString()}
            </span>
            <button
              onClick={handleRefreshAll}
              disabled={isFetchingSummary || isFetchingPulseScores}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:border-slate-700 dark:text-slate-200 transition shadow-sm disabled:opacity-50"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${
                  isFetchingSummary || isFetchingPulseScores ? 'animate-spin' : ''
                }`}
              />
              <span>Refresh Metrics</span>
            </button>
          </div>
        </div>

        {/* 1. Summary Metric KPIs */}
        <section aria-labelledby="kpi-heading">
          <SummaryCards summary={summary ?? null} />
        </section>

        {/* 2. Demand Heatmap & Repositioning Map */}
        <section aria-labelledby="demand-map-heading">
          <DemandHeatmapMap
            heatmapPoints={heatmapPoints}
            repositioningHints={repositioningHints}
            deadZones={deadZones}
            flyToCoords={flyToCoords}
          />
        </section>

        {/* 3. Dead-Zone Alerts & Repositioning Recommendations */}
        <section aria-labelledby="alerts-heading">
          <RepositionAlerts
            hints={repositioningHints}
            deadZones={deadZones}
            onFlyToZone={handleFlyToZone}
          />
        </section>

        {/* 4. Algorithm Comparison Replay */}
        <section aria-labelledby="comparison-heading">
          <AlgorithmComparison initialData={initialComparison ?? null} />
        </section>

        {/* 5. Haversine vs OSRM ETA Calculator */}
        <section aria-labelledby="eta-calculator-heading">
          <EtaCalculator />
        </section>

        {/* 6. Driver Pulse Score Leaderboard */}
        <section aria-labelledby="pulse-scores-heading">
          <PulseScoresTable
            scores={pulseScores}
            isLoading={isFetchingPulseScores}
          />
        </section>
      </main>
    </div>
  );
}
