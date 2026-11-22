'use client';

import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Package, Users } from 'lucide-react';
import { DeliveryRequestData, DriverMarkerData } from '../../types/dashboard';
import { RequestsQueue } from './requests-queue';
import { DriversList } from './drivers-list';

interface SidePanelProps {
  drivers: DriverMarkerData[];
  requests: DeliveryRequestData[];
  selectedDriverId: string | null;
  onSelectDriver: (driver: DriverMarkerData | null) => void;
  onFlyTo: (coords: { lat: number; lng: number }) => void;
}

export function SidePanel({
  drivers,
  requests,
  selectedDriverId,
  onSelectDriver,
  onFlyTo,
}: SidePanelProps) {
  const [activeTab, setActiveTab] = useState<'requests' | 'drivers'>('requests');
  const [collapsed, setCollapsed] = useState(false);

  const pendingCount = requests.filter(
    (r) => r.status === 'pending' || r.status === 'offered' || r.status === 'assigned',
  ).length;

  return (
    <aside
      className={`relative z-20 h-full bg-slate-950/90 backdrop-blur border-r border-slate-800/80 flex flex-col transition-all duration-300 ${
        collapsed ? 'w-12' : 'w-80 md:w-96'
      }`}
    >
      {/* Collapse Toggle Button */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-4 w-6 h-6 rounded-full bg-slate-900 border border-slate-700 text-slate-300 flex items-center justify-center hover:bg-slate-800 transition shadow-md z-30"
        title={collapsed ? 'Expand side panel' : 'Collapse side panel'}
      >
        {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
      </button>

      {collapsed ? (
        /* Collapsed View (Vertical icons) */
        <div className="flex flex-col items-center py-4 gap-4">
          <button
            onClick={() => {
              setActiveTab('requests');
              setCollapsed(false);
            }}
            className={`p-2 rounded-lg transition relative ${
              activeTab === 'requests' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Package className="w-5 h-5" />
            {pendingCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-500 text-slate-950 font-bold text-[9px] flex items-center justify-center">
                {pendingCount}
              </span>
            )}
          </button>

          <button
            onClick={() => {
              setActiveTab('drivers');
              setCollapsed(false);
            }}
            className={`p-2 rounded-lg transition ${
              activeTab === 'drivers' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users className="w-5 h-5" />
          </button>
        </div>
      ) : (
        /* Expanded View */
        <div className="flex flex-col h-full overflow-hidden">
          {/* Main Navigation Tabs */}
          <div className="flex border-b border-slate-800 bg-slate-900/80 p-1.5 gap-1 shrink-0">
            <button
              data-testid="tab-requests"
              onClick={() => setActiveTab('requests')}
              className={`flex-1 py-1.5 rounded-md text-xs font-semibold flex items-center justify-center gap-2 transition ${
                activeTab === 'requests'
                  ? 'bg-slate-800 text-slate-100 shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Package className="w-3.5 h-3.5 text-blue-400" />
              <span>Deliveries</span>
              {pendingCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30 text-[10px] font-mono">
                  {pendingCount}
                </span>
              )}
            </button>

            <button
              data-testid="tab-drivers"
              onClick={() => setActiveTab('drivers')}
              className={`flex-1 py-1.5 rounded-md text-xs font-semibold flex items-center justify-center gap-2 transition ${
                activeTab === 'drivers'
                  ? 'bg-slate-800 text-slate-100 shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Users className="w-3.5 h-3.5 text-emerald-400" />
              <span>Fleet</span>
              <span className="px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-mono">
                {drivers.length}
              </span>
            </button>
          </div>

          {/* Active Tab Body */}
          <div className="flex-1 overflow-hidden">
            {activeTab === 'requests' ? (
              <RequestsQueue requests={requests} onFlyTo={onFlyTo} />
            ) : (
              <DriversList
                drivers={drivers}
                selectedDriverId={selectedDriverId}
                onSelectDriver={onSelectDriver}
                onFlyTo={onFlyTo}
              />
            )}
          </div>
        </div>
      )}
    </aside>
  );
}
