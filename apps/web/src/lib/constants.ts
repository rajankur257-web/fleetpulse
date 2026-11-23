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
    text: 'text-emerald-600 dark:text-emerald-400',
    border: 'border-emerald-500/40',
    dot: '#10b981',
    label: 'Available',
  },
  busy: {
    bg: 'bg-amber-500',
    text: 'text-amber-600 dark:text-amber-400',
    border: 'border-amber-500/40',
    dot: '#f59e0b',
    label: 'Busy',
  },
  offline: {
    bg: 'bg-slate-500',
    text: 'text-slate-600 dark:text-slate-400',
    border: 'border-slate-500/40',
    dot: '#64748b',
    label: 'Offline',
  },
} as const;

export const REQUEST_STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  pending: { bg: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/30', text: 'text-blue-600 dark:text-blue-400', label: 'Pending' },
  offered: { bg: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-500/10 dark:text-purple-400 dark:border-purple-500/30', text: 'text-purple-600 dark:text-purple-400', label: 'Offered' },
  assigned: { bg: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/30', text: 'text-amber-600 dark:text-amber-400', label: 'Assigned' },
  picked_up: { bg: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-indigo-500/30', text: 'text-indigo-600 dark:text-indigo-400', label: 'In Transit' },
  delivered: { bg: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/30', text: 'text-emerald-600 dark:text-emerald-400', label: 'Delivered' },
  cancelled: { bg: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/30', text: 'text-rose-600 dark:text-rose-400', label: 'Cancelled' },
  expired: { bg: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-500/10 dark:text-slate-400 dark:border-slate-500/30', text: 'text-slate-600 dark:text-slate-400', label: 'Expired' },
};
