'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  MapPin,
  Navigation,
  Package,
  Phone,
  ShieldCheck,
  Star,
  Truck,
  User,
} from 'lucide-react';
import { haversineKm, RequestStatus } from '@fleet-pulse/shared';
import { fetchRequestById } from '../../../lib/api';
import { getSocket } from '../../../lib/socket';
import { DeliveryRequestData, DriverMarkerData } from '../../../types/dashboard';
import {
  getCustomerName,
  getFormattedDriverName,
  getFormattedDriverPhone,
  getNeighborhoodName,
  getPackageType,
} from '../../../lib/order-metadata';

// Dynamically load Map component with SSR disabled
const CustomerTrackingMap = dynamic(
  () =>
    import('../../../components/map/customer-tracking-map').then(
      (mod) => mod.CustomerTrackingMap,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900 text-slate-400 font-mono text-xs gap-2">
        <Truck className="w-6 h-6 animate-bounce text-amber-500" />
        <p>Loading live map...</p>
      </div>
    ),
  },
);

export default function CustomerTrackPage() {
  const params = useParams();
  const id = typeof params?.id === 'string' ? params.id : '';

  const [request, setRequest] = useState<
    (DeliveryRequestData & { assignedDriver?: DriverMarkerData | null }) | null
  >(null);
  const [driver, setDriver] = useState<DriverMarkerData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initial Fetch
  useEffect(() => {
    if (!id) return;
    setIsLoading(true);
    fetchRequestById(id)
      .then((data) => {
        if (!data) {
          setError('Order not found or tracking link expired.');
        } else {
          setRequest(data);
          if (data.assignedDriver) {
            setDriver(data.assignedDriver);
          }
        }
      })
      .catch(() => setError('Unable to load order tracking details.'))
      .finally(() => setIsLoading(false));
  }, [id]);

  // Real-time Socket.IO events for this specific order only
  useEffect(() => {
    if (!id) return;
    const socket = getSocket();

    // Listen for live driver location updates
    const onLocation = (data: {
      driverId: string;
      lat: number;
      lng: number;
      speed?: number;
      heading?: number;
    }) => {
      setDriver((prev) => {
        if (!prev || prev.id !== data.driverId) return prev;
        return {
          ...prev,
          lat: data.lat,
          lng: data.lng,
          speed: data.speed ?? prev.speed,
          heading: data.heading ?? prev.heading,
        };
      });
    };

    // Listen for driver assignment
    const onAssigned = (data: { requestId: string; driverId: string }) => {
      if (data.requestId === id) {
        fetchRequestById(id).then((fresh) => {
          if (fresh) {
            setRequest(fresh);
            if (fresh.assignedDriver) setDriver(fresh.assignedDriver);
          }
        });
      }
    };

    // Listen for status changes (picked_up, delivered, cancelled)
    const onStatus = (data: { requestId: string; status: RequestStatus }) => {
      if (data.requestId === id) {
        setRequest((prev) => (prev ? { ...prev, status: data.status } : prev));
      }
    };

    socket.on('driver:location', onLocation);
    socket.on('request:assigned', onAssigned);
    socket.on('request:status', onStatus);

    return () => {
      socket.off('driver:location', onLocation);
      socket.off('request:assigned', onAssigned);
      socket.off('request:status', onStatus);
    };
  }, [id]);

  // Compute live ETA & remaining distance using Haversine
  const liveEta = useMemo(() => {
    if (!request || !driver) return null;
    const targetLat = request.status === 'picked_up' ? request.dropLat : request.pickupLat;
    const targetLng = request.status === 'picked_up' ? request.dropLng : request.pickupLng;

    const distanceKm = haversineKm(
      { lat: driver.lat, lng: driver.lng },
      { lat: targetLat, lng: targetLng },
    );

    // Approximate Bangalore traffic speed of 22 km/h
    const minutes = Math.max(1, Math.round((distanceKm / 22) * 60));
    return {
      distanceKm: distanceKm.toFixed(1),
      minutes,
      destinationLabel: request.status === 'picked_up' ? 'your address' : 'pickup point',
    };
  }, [request, driver]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white">
        <Truck className="w-10 h-10 animate-bounce text-amber-500 mb-4" />
        <h2 className="text-sm font-semibold tracking-wide text-slate-300">
          Loading Your Delivery Status...
        </h2>
        <p className="text-xs text-slate-500 mt-1">Connecting to live dispatch network</p>
      </div>
    );
  }

  if (error || !request) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white p-6">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center shadow-2xl">
          <Package className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-white mb-1">Order Not Found</h2>
          <p className="text-xs text-slate-400 mb-6">
            {error || 'This delivery tracking link is invalid or may have expired.'}
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  const customerName = getCustomerName(request.id);
  const packageType = getPackageType(request.id);
  const pickupArea = getNeighborhoodName(request.pickupLat, request.pickupLng);
  const dropArea = getNeighborhoodName(request.dropLat, request.dropLng);
  const driverName = driver ? getFormattedDriverName(driver.name, driver.id) : null;
  const driverPhone = driver ? getFormattedDriverPhone(driver.phone, driver.id) : null;

  // Stepper calculations
  const steps = [
    { label: 'Order Confirmed', completed: true },
    {
      label: 'Driver Assigned',
      completed: Boolean(request.assignedDriverId || request.status === 'assigned' || request.status === 'picked_up' || request.status === 'delivered'),
    },
    {
      label: 'Out for Delivery',
      completed: request.status === 'picked_up' || request.status === 'delivered',
    },
    {
      label: 'Delivered',
      completed: request.status === 'delivered',
    },
  ];

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-950 text-white overflow-hidden font-sans">
      {/* Top Customer Header */}
      <header className="h-14 border-b border-slate-800/80 bg-slate-900/95 backdrop-blur px-4 flex items-center justify-between shrink-0 z-30">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
            title="Return to Dashboard"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-sm text-white tracking-tight">
                Fleet<span className="text-amber-500">Pulse</span>
              </span>
              <span className="text-slate-500 text-xs">•</span>
              <span className="text-xs font-semibold text-slate-300">Live Delivery Tracking</span>
            </div>
            <div className="text-[10px] text-slate-500 font-mono">
              Order #{request.id.slice(0, 8)}
            </div>
          </div>
        </div>

        {/* Privacy & Security Badge */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] font-medium">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span className="hidden sm:inline">Protected Customer Session</span>
          <span className="sm:hidden">Private</span>
        </div>
      </header>

      {/* Main Tracking Workspace */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        {/* Left Side: Order & Driver Status Card */}
        <div className="w-full md:w-96 border-b md:border-b-0 md:border-r border-slate-800 bg-slate-900/90 backdrop-blur overflow-y-auto p-4 flex flex-col gap-4 shrink-0 z-20">
          {/* Main Status Hero */}
          <div className="p-4 rounded-xl bg-gradient-to-br from-slate-800/80 to-slate-900 border border-slate-700/80 shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-amber-500 tracking-wider uppercase">
                Status
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                {request.status.toUpperCase()}
              </span>
            </div>

            {request.status === 'delivered' ? (
              <div>
                <h1 className="text-base font-bold text-emerald-400 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  Package Delivered!
                </h1>
                <p className="text-xs text-slate-400 mt-1">
                  Thank you, {customerName}! Your order has safely arrived at {dropArea}.
                </p>
              </div>
            ) : liveEta ? (
              <div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-black text-white font-mono">
                    ~{liveEta.minutes} min
                  </span>
                  <span className="text-xs text-slate-400 font-mono">({liveEta.distanceKm} km)</span>
                </div>
                <p className="text-xs text-slate-300 mt-1 flex items-center gap-1.5">
                  <Truck className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>Driver is heading toward {liveEta.destinationLabel}.</span>
                </p>
              </div>
            ) : (
              <div>
                <h1 className="text-sm font-bold text-white flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-400 animate-spin" />
                  Finding Nearest Delivery Agent...
                </h1>
                <p className="text-xs text-slate-400 mt-1">
                  Our dispatch engine is matching your package with the best driver in {pickupArea}.
                </p>
              </div>
            )}
          </div>

          {/* Stepper Progress */}
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
            <div className="space-y-3">
              {steps.map((st, i) => (
                <div key={st.label} className="flex items-center gap-3">
                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 transition ${
                      st.completed
                        ? 'bg-emerald-500 text-slate-950 shadow-sm'
                        : 'bg-slate-800 text-slate-500 border border-slate-700'
                    }`}
                  >
                    {st.completed ? '✓' : i + 1}
                  </div>
                  <span
                    className={`text-xs font-semibold ${
                      st.completed ? 'text-white' : 'text-slate-500'
                    }`}
                  >
                    {st.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Driver Profile Card (When Assigned) */}
          {driver ? (
            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Assigned Delivery Agent
                </span>
                <div className="flex items-center gap-1 text-amber-400 font-mono text-xs font-bold">
                  <Star className="w-3.5 h-3.5 fill-amber-400" />
                  <span>{driver.rating.toFixed(1)}</span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-amber-600 to-amber-400 text-slate-950 font-black text-sm flex items-center justify-center shadow">
                    {driverName?.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="font-bold text-sm text-white">{driverName}</div>
                    <div className="text-[11px] text-slate-400 flex items-center gap-1">
                      <Navigation className="w-3 h-3 text-slate-500" />
                      <span>{driver.speed ?? 0} km/h • Vehicle Active</span>
                    </div>
                  </div>
                </div>

                {driverPhone && (
                  <a
                    href={`tel:${driverPhone}`}
                    className="p-2.5 rounded-full bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/40 transition shadow-sm"
                    title="Call Driver"
                  >
                    <Phone className="w-4 h-4" />
                  </a>
                )}
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/80 text-center py-6">
              <User className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p className="text-xs text-slate-400 font-medium">Driver details will appear here</p>
              <p className="text-[11px] text-slate-600">as soon as the delivery is accepted</p>
            </div>
          )}

          {/* Delivery Route Hubs */}
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2.5 text-xs">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Route Details
            </div>
            <div className="flex items-start gap-2.5">
              <MapPin className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              <div>
                <span className="text-slate-400 text-[10px] block">Pickup Location</span>
                <span className="font-medium text-slate-200">{pickupArea}</span>
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <MapPin className="w-4 h-4 text-purple-500 shrink-0 mt-0.5" />
              <div>
                <span className="text-slate-400 text-[10px] block">Delivery Address</span>
                <span className="font-medium text-slate-200">{dropArea}</span>
              </div>
            </div>
            <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
              <span>Item: <strong className="text-slate-200">{packageType}</strong></span>
              <span>Recipient: <strong className="text-slate-200">{customerName}</strong></span>
            </div>
          </div>
        </div>

        {/* Right Side: Clean Map Showing ONLY This Delivery & Driver */}
        <div className="flex-1 h-full relative">
          <CustomerTrackingMap request={request} driver={driver} />
        </div>
      </div>
    </div>
  );
}
