---
name: frontend-design
description: Use when building, styling, or reviewing UI components and dashboard views for Fleet Pulse web apps.
---

# Frontend Design & UI Standards for Fleet Pulse

## 1. UI Tech Stack
- **Framework**: Next.js (App Router), React 18/19, TypeScript.
- **Styling**: Tailwind CSS with consistent color palette and typography.
- **UI Components**: `shadcn/ui` (Radix UI primitives).
- **Icons**: Lucide React.
- **Mapping**: MapLibre GL JS with OpenStreetMap raster/vector tiles (no paid API keys required).
- **Data Fetching & Cache**: TanStack Query for server state management.

## 2. Dispatcher Dashboard Layout
- **Live Map**: Full-viewport responsive map showing:
  - Driver markers color-coded by status:
    - Green: Available
    - Orange/Yellow: Busy (on delivery)
    - Gray: Offline
  - Pickup and Dropoff request pins with status badges.
  - Smooth animated transitions for vehicle marker movements via WebSockets.
- **Side Panel**:
  - Request queue with tabs (`Pending`, `Offered`, `Assigned`, `Completed`).
  - Driver list with search, status filters, and rating badges.
  - Request creation drawer with map-click coordinate selection.
- **Simulator Controls Panel**: Quick floating bar to start/stop the simulator, adjust driver count, and change speed multiplier (1x-20x).
- **Status Indicator**: Top header badge showing WebSocket live status (`Connected`, `Reconnecting`, `Disconnected`).

## 3. Design System & Accessibility
- **Themes**: Support seamless Dark and Light modes using `next-themes`.
- **States**: Every view must handle:
  - Loading skeletons (not bare blank screens).
  - Empty states with clear calls-to-action (e.g., "No active delivery requests").
  - Error states with user-friendly retry buttons.
- **Responsiveness**: Responsive grid that adapts smoothly between desktop widescreen, standard laptop, and tablet displays.
