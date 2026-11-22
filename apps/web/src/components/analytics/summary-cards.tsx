'use client';

import React from 'react';
import { AnalyticsSummary } from '@fleet-pulse/shared';
import {
  Activity,
  CheckCircle2,
  Clock,
  Gauge,
  MapPin,
  TrendingUp,
} from 'lucide-react';

interface SummaryCardsProps {
  summary: AnalyticsSummary | null;
}

export function SummaryCards({ summary }: SummaryCardsProps) {
  if (!summary) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-24 rounded-xl bg-slate-900/60 border border-slate-800 animate-pulse"
          />
        ))}
      </div>
    );
  }

  const kpis = [
    {
      title: 'Avg Wait Time',
      value: `${summary.averageWaitTimeSeconds.toFixed(1)}s`,
      subtitle: 'Created to Picked Up',
      icon: Clock,
      color: 'text-amber-400',
      bg: 'bg-amber-500/10 border-amber-500/20',
    },
    {
      title: 'Avg Assignment',
      value: `${summary.averageAssignmentTimeSeconds.toFixed(1)}s`,
      subtitle: 'Dispatch decision latency',
      icon: Gauge,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10 border-emerald-500/20',
    },
    {
      title: 'Total Distance',
      value: `${summary.totalDistanceKm.toFixed(1)} km`,
      subtitle: 'Combined Haversine distance',
      icon: MapPin,
      color: 'text-cyan-400',
      bg: 'bg-cyan-500/10 border-cyan-500/20',
    },
    {
      title: 'Driver Utilization',
      value: `${Math.round(summary.driverUtilizationRate * 100)}%`,
      subtitle: 'Active busy ratio',
      icon: Activity,
      color: 'text-indigo-400',
      bg: 'bg-indigo-500/10 border-indigo-500/20',
    },
    {
      title: 'Acceptance Rate',
      value: `${Math.round(summary.acceptanceRate * 100)}%`,
      subtitle: 'Driver offer accept ratio',
      icon: CheckCircle2,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10 border-emerald-500/20',
    },
    {
      title: 'Requests / Hour',
      value: `${summary.requestsPerHour.toFixed(1)}/h`,
      subtitle: `${summary.totalRequests} total requests`,
      icon: TrendingUp,
      color: 'text-purple-400',
      bg: 'bg-purple-500/10 border-purple-500/20',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {kpis.map((kpi) => {
        const Icon = kpi.icon;
        return (
          <div
            key={kpi.title}
            className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 shadow-sm flex flex-col justify-between"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                {kpi.title}
              </span>
              <div className={`p-1.5 rounded-lg border ${kpi.bg} ${kpi.color}`}>
                <Icon className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="mt-2">
              <div className="text-xl font-bold font-mono tracking-tight text-slate-100">
                {kpi.value}
              </div>
              <div className="text-[10px] text-slate-400 truncate mt-0.5">
                {kpi.subtitle}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
