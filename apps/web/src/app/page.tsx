import {
  haversineKm,
  etaMinutes,
  DriverStatus,
  FLEET_PULSE_VERSION,
} from '@fleet-pulse/shared';

export default function DashboardPage() {
  const blr = { lat: 12.9716, lng: 77.5946 };
  const chn = { lat: 13.0827, lng: 80.2707 };
  const sampleDistance = Math.round(haversineKm(blr, chn));
  const sampleEta = etaMinutes(sampleDistance, 40);

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold tracking-tight">Fleet Pulse Dashboard</h1>
        <p className="mt-2 text-slate-400">
          Real-time delivery dispatch operations (v{FLEET_PULSE_VERSION})
        </p>
        <div className="mt-4 p-4 rounded bg-slate-900 border border-slate-800">
          <p className="text-sm text-slate-300">
            Shared Haversine Smoke Check: BLR to MAA is ~{sampleDistance} km (~{sampleEta} mins at 40 km/h).
          </p>
          <p className="text-xs text-emerald-400 mt-1">
            Driver Status Check: {DriverStatus.AVAILABLE}
          </p>
        </div>
      </div>
    </main>
  );
}

