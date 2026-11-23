# Fleet Pulse Mobile Driver App (M9)

The Fleet Pulse Driver application (`apps/mobile`) is built using **React Native with Expo 52** and **Expo Router v4** for file-based routing. It provides delivery drivers with live telemetry broadcast, offline queue resiliency, offer acceptance with animated countdown, and delivery lifecycle management.

---

## 1. Architecture & Navigation

The app is structured under `apps/mobile/app/` using Expo Router:

```text
apps/mobile/app/
├── _layout.tsx           # Global Root Layout with DriverProvider and OfferModal
├── index.tsx             # Auth Gatekeeper (routes to /(tabs) or /login)
├── login.tsx             # Driver selection and authentication
└── (tabs)/               # Bottom Tab Navigator
    ├── _layout.tsx       # Tab bar configuration & badges
    ├── index.tsx         # Driver Dashboard & Online/Offline status switch
    ├── trip.tsx          # Active Delivery lifecycle HUD (Assigned -> Picked Up -> Delivered)
    ├── history.tsx       # Completed trips and daily earnings
    └── profile.tsx       # Profile, network connectivity, and offline buffer flush
```

---

## 2. Location Tracking & Battery-Conscious Telemetry

Location tracking is handled via `LocationTrackerService` (`src/lib/location-tracker.ts`) using progressive permissions:

1. **Foreground Permission**: First requested via `Location.requestForegroundPermissionsAsync()`.
2. **Background Permission**: Progressively requested with explanation via `Location.requestBackgroundPermissionsAsync()`.
3. **Background Task**: Defined with `TaskManager.defineTask('FLEET_PULSE_BACKGROUND_LOCATION', ...)`:
   - **Idle Mode** (`available`): Balanced accuracy (`Location.Accuracy.Balanced`), 10,000ms interval, 10m distance filter.
   - **Delivery Mode** (`assigned` / `picked_up`): High accuracy (`Location.Accuracy.High`), 5,000ms interval, 10m distance filter.
   - **Offline Mode**: Automatically pauses/stops background tracking.

---

## 3. Offline Queue & Resiliency (`src/lib/offline-queue.ts`)

When network connectivity or WebSocket connection drops:
- Location pings (`LOCATION_PING`) and status transitions (`STATUS_UPDATE`) are buffered into an AsyncStorage-backed queue (capped at 500 items).
- Upon reconnect or manual trigger, `offlineQueue.flush()` sequentially sends buffered events to the API.
- If a transmission fails, the queue stops and preserves remaining items to prevent event drop or ordering errors.

---

## 4. Real-time Offer Cascade & Animated Countdown (`src/components/OfferModal.tsx`)

When an offer is dispatched by BullMQ:
- Receives `request:offered` event through Socket.IO.
- Triggers immediate haptic vibration via `expo-haptics`.
- Displays a modal with:
  - 20-second circular/linear animated progress bar.
  - Pickup and Dropoff coordinates with Haversine distance (`haversineKm`) from `@fleet-pulse/shared`.
  - Estimated fare (`₹50 base + ₹15/km`).
  - **Accept Offer**: Calls `/api/v1/offers/:id/accept` and switches driver status to `busy`.
  - **Decline Offer**: Calls `/api/v1/offers/:id/reject`, allowing BullMQ to cascade to the next driver.

---

## 5. Active Delivery Lifecycle (`apps/mobile/app/(tabs)/trip.tsx`)

Tracks the delivery through state progression:
1. **Assigned**: Driver is en route to pickup. Action button: `CONFIRM ORDER PICKED UP`.
2. **Picked Up**: Driver has collected package and is heading to dropoff. Action button: `CONFIRM ORDER DELIVERED`.
3. **Delivered**: Trip is recorded to completed history and driver transitions back to `available`.

---

## 6. Build Configurations

- **Dynamic Configuration (`app.config.ts`)**: Dynamically resolves `EXPO_PUBLIC_API_URL` and `EXPO_PUBLIC_SOCKET_URL` with sensible Android emulator (`10.0.2.2:3001`) and iOS/web defaults.
- **EAS Profiles (`eas.json`)**:
  - `development`: Debug build with Expo Dev Client.
  - `preview`: Internal testing APK for Android and TestFlight for iOS.
  - `production`: Optimized store release build.
