'use client';

import React, { useState } from 'react';
import { DriverStatus, PulseScoreResult } from '@fleet-pulse/shared';
import {
  Award,
  Search,
  Star,
  Users,
} from 'lucide-react';

interface PulseScoresTableProps {
  scores: PulseScoreResult[];
  isLoading?: boolean;
}

export function PulseScoresTable({
  scores,
  isLoading = false,
}: PulseScoresTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filteredScores = scores.filter((item) => {
    const matchesSearch = item.driverName
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
    const matchesStatus =
      statusFilter === 'all' || item.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getScoreBadge = (score: number) => {
    if (score >= 80) {
      return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
    }
    if (score >= 60) {
      return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30';
    }
    if (score >= 40) {
      return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
    }
    return 'bg-rose-500/10 text-rose-400 border-rose-500/30';
  };

  return (
    <div className="rounded-xl bg-white border border-slate-200 dark:bg-slate-900/90 dark:border-slate-800 p-5 shadow-sm">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-500 dark:text-indigo-400">
              <Award className="w-4 h-4" />
            </div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Driver Pulse Score Leaderboard (0-100)
            </h3>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
            Weighted efficiency metric: 40% Acceptance Rate + 35% Idle Time Management + 25% Proximity to Demand.
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search driver..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 pr-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100 dark:placeholder-slate-500"
            />
          </div>

          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200 dark:bg-slate-800/80 dark:border-slate-700">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-2 py-1 rounded text-[11px] font-medium transition ${
                statusFilter === 'all'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setStatusFilter(DriverStatus.AVAILABLE)}
              className={`px-2 py-1 rounded text-[11px] font-medium transition ${
                statusFilter === DriverStatus.AVAILABLE
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              Available
            </button>
            <button
              onClick={() => setStatusFilter(DriverStatus.BUSY)}
              className={`px-2 py-1 rounded text-[11px] font-medium transition ${
                statusFilter === DriverStatus.BUSY
                  ? 'bg-amber-600 text-white'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              Busy
            </button>
            <button
              onClick={() => setStatusFilter(DriverStatus.OFFLINE)}
              className={`px-2 py-1 rounded text-[11px] font-medium transition ${
                statusFilter === DriverStatus.OFFLINE
                  ? 'bg-slate-600 text-white'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              Offline
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto mt-4">
        {isLoading ? (
          <div className="py-12 text-center text-xs text-slate-500 animate-pulse">
            Loading driver pulse scores...
          </div>
        ) : filteredScores.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-500 dark:text-slate-400 flex flex-col items-center justify-center">
            <Users className="w-8 h-8 text-slate-400 dark:text-slate-600 mb-2" />
            <span>No drivers found matching criteria.</span>
          </div>
        ) : (
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-mono text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <th className="pb-2.5 pl-2 font-medium">Rank</th>
                <th className="pb-2.5 font-medium">Driver</th>
                <th className="pb-2.5 font-medium">Status</th>
                <th className="pb-2.5 font-medium">Pulse Score</th>
                <th className="pb-2.5 font-medium">Components Breakdown</th>
                <th className="pb-2.5 font-medium">Acceptance</th>
                <th className="pb-2.5 font-medium">Rating</th>
                <th className="pb-2.5 pr-2 font-medium">Daily Trips</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono">
              {filteredScores.map((item, index) => {
                const rank = index + 1;
                return (
                  <tr
                    key={item.driverId}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition group"
                  >
                    {/* Rank */}
                    <td className="py-3 pl-2">
                      <span
                        className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                          rank === 1
                            ? 'bg-amber-500/20 text-amber-500 dark:text-amber-400 border border-amber-500/40'
                            : rank === 2
                            ? 'bg-slate-200 dark:bg-slate-300/20 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-300/40'
                            : rank === 3
                            ? 'bg-amber-700/20 text-amber-700 dark:text-amber-600 border border-amber-700/40'
                            : 'text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        {rank}
                      </span>
                    </td>

                    {/* Driver Name & ID */}
                    <td className="py-3">
                      <div className="font-sans font-semibold text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition">
                        {item.driverName}
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400">
                        {item.driverId.slice(0, 8)}...
                      </div>
                    </td>

                    {/* Status */}
                    <td className="py-3">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] uppercase font-mono font-semibold ${
                          item.status === DriverStatus.AVAILABLE
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/30'
                            : item.status === DriverStatus.BUSY
                            ? 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/30'
                            : 'bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-500/10 dark:text-slate-400 dark:border-slate-500/30'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            item.status === DriverStatus.AVAILABLE
                              ? 'bg-emerald-500'
                              : item.status === DriverStatus.BUSY
                              ? 'bg-amber-500'
                              : 'bg-slate-500'
                          }`}
                        />
                        {item.status}
                      </span>
                    </td>

                    {/* Pulse Score */}
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded font-bold text-sm border ${getScoreBadge(
                            item.pulseScore,
                          )}`}
                        >
                          {item.pulseScore}
                        </span>
                        <div className="w-16 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${
                              item.pulseScore >= 80
                                ? 'bg-emerald-500'
                                : item.pulseScore >= 60
                                ? 'bg-cyan-500'
                                : item.pulseScore >= 40
                                ? 'bg-amber-500'
                                : 'bg-rose-500'
                            }`}
                            style={{ width: `${item.pulseScore}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    {/* Components Breakdown */}
                    <td className="py-3">
                      <div className="flex items-center gap-3 text-[10px]">
                        <div title="Acceptance Score (40%)">
                          <span className="text-slate-500 dark:text-slate-400">Acc: </span>
                          <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                            {item.components.acceptanceScore}
                          </span>
                        </div>
                        <div title="Idle Management Score (35%)">
                          <span className="text-slate-500 dark:text-slate-400">Idle: </span>
                          <span className="font-semibold text-cyan-600 dark:text-cyan-400">
                            {item.components.idleScore}
                          </span>
                        </div>
                        <div title="Demand Proximity Score (25%)">
                          <span className="text-slate-500 dark:text-slate-400">Prox: </span>
                          <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                            {item.components.proximityScore}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Acceptance Rate */}
                    <td className="py-3 text-slate-800 dark:text-slate-200">
                      {(item.acceptanceRate * 100).toFixed(0)}%
                    </td>

                    {/* Rating */}
                    <td className="py-3">
                      <div className="flex items-center gap-1 text-amber-500 dark:text-amber-400">
                        <Star className="w-3.5 h-3.5 fill-amber-500 dark:fill-amber-400" />
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {item.rating.toFixed(1)}
                        </span>
                      </div>
                    </td>

                    {/* Daily Trips */}
                    <td className="py-3 pr-2 text-slate-800 dark:text-slate-200">
                      {item.dailyTrips}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
