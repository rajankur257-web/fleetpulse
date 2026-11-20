---
name: expo-driver-app
description: Use when building, testing, or updating the Expo React Native mobile driver app in Fleet Pulse.
---

# Expo Driver App Development Rules

## 1. Architecture & Navigation
- Framework: React Native with Expo and **Expo Router** (file-based navigation in `apps/mobile/app/`).
- Shared Code: Types, Zod schemas, constants imported from `@fleet-pulse/shared`.
- State Management: React Context / Zustand for auth, socket connection, and live trip status.

## 2. Location Tracking & Permissions
- Permissions must be requested progressively:
  1. Request foreground location permission first (`Location.requestForegroundPermissionsAsync()`).
  2. Explain why background tracking is required before requesting background permission (`Location.requestBackgroundPermissionsAsync()`).
- Background Location Task:
  - Register task with `TaskManager.defineTask(LOCATION_TASK_NAME, ({ data, error }) => { ... })`.
  - Set battery-conscious intervals:
    - Time interval: 5000ms - 10000ms.
    - Distance filter: 10 meters.
    - Accuracy: `Location.Accuracy.Balanced` when idle, `Location.Accuracy.High` during active deliveries.
  - Automatically pause/stop background updates when driver toggles to `offline`.

## 3. Offline Queue & Resiliency
- When network is unavailable:
  - Buffer location pings and status transitions in an offline queue (AsyncStorage / SQLite / MMKV).
  - Flush queue sequentially in batches once connection is re-established.
- Socket.IO connection:
  - Reconnect automatically with exponential backoff.
  - Re-authenticate with JWT upon reconnection.
  - Re-subscribe to driver room `driver:<id>`.

## 4. Driver Flow Screens
- **Login / Auth Screen**: Email/password authentication, JWT storage in SecureStore.
- **Home / Status Screen**: Online/Offline toggle, current GPS accuracy, quick statistics.
- **Offer Modal / Screen**: Full-screen offer alert with audio/haptic feedback, pickup/drop location details, estimated distance/fare, and an animated countdown timer (syncing with `OFFER_TIMEOUT_SECONDS`).
- **Active Trip Screen**: Turn-by-turn map view, customer pickup & drop details, action buttons for state transitions (`picked_up` -> `delivered`).
- **History & Earnings**: List of completed trips and daily summary.

## 5. Build Configuration
- `app.config.ts`: Dynamically read `EXPO_PUBLIC_API_URL` and `EXPO_PUBLIC_SOCKET_URL`.
- `eas.json`: Configure three distinct build profiles:
  - `development`: Debug build with Expo Dev Client.
  - `preview`: Internal testing APK / TestFlight build pointing to staging/production API.
  - `production`: Store release build with minification and production environment variables.
