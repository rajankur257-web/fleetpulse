import type { StyleSpecification } from 'maplibre-gl';

export const BENGALURU_CENTER: [number, number] = [77.5946, 12.9716]; // [lng, lat]
export const DEFAULT_ZOOM = 12;

export const OSM_RASTER_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    'osm-tiles': {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    },
  },
  layers: [
    {
      id: 'osm-tiles-layer',
      type: 'raster',
      source: 'osm-tiles',
      minzoom: 0,
      maxzoom: 19,
    },
  ],
};

export const STATUS_COLORS = {
  available: {
    bg: 'bg-emerald-500',
    text: 'text-emerald-400',
    border: 'border-emerald-500/40',
    dot: '#10b981',
    label: 'Available',
  },
  busy: {
    bg: 'bg-amber-500',
    text: 'text-amber-400',
    border: 'border-amber-500/40',
    dot: '#f59e0b',
    label: 'Busy',
  },
  offline: {
    bg: 'bg-slate-500',
    text: 'text-slate-400',
    border: 'border-slate-500/40',
    dot: '#64748b',
    label: 'Offline',
  },
} as const;

export const REQUEST_STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  pending: { bg: 'bg-blue-500/10 text-blue-400 border-blue-500/30', text: 'text-blue-400', label: 'Pending' },
  offered: { bg: 'bg-purple-500/10 text-purple-400 border-purple-500/30', text: 'text-purple-400', label: 'Offered' },
  assigned: { bg: 'bg-amber-500/10 text-amber-400 border-amber-500/30', text: 'text-amber-400', label: 'Assigned' },
  picked_up: { bg: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30', text: 'text-indigo-400', label: 'In Transit' },
  delivered: { bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30', text: 'text-emerald-400', label: 'Delivered' },
  cancelled: { bg: 'bg-rose-500/10 text-rose-400 border-rose-500/30', text: 'text-rose-400', label: 'Cancelled' },
  expired: { bg: 'bg-slate-500/10 text-slate-400 border-slate-500/30', text: 'text-slate-400', label: 'Expired' },
};
