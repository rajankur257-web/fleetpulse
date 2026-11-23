import { Platform } from 'react-native';
import Constants from 'expo-constants';

const defaultHost =
  Platform.OS === 'android'
    ? 'http://10.0.2.2:3001'
    : 'http://localhost:3001';

const extraApiUrl = Constants.expoConfig?.extra?.apiUrl as string | undefined;
const extraSocketUrl = Constants.expoConfig?.extra?.socketUrl as string | undefined;

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || extraApiUrl || defaultHost;

export const SOCKET_URL =
  process.env.EXPO_PUBLIC_SOCKET_URL || extraSocketUrl || defaultHost;

export const LOCATION_TASK_NAME = 'FLEET_PULSE_BACKGROUND_LOCATION';

export const OFFER_TIMEOUT_SECONDS = 20;

export const STORAGE_KEYS = {
  AUTH_TOKEN: 'fleetpulse_auth_token',
  DRIVER_PROFILE: 'fleetpulse_driver_profile',
  OFFLINE_QUEUE: 'fleetpulse_offline_queue',
  ACTIVE_TRIP: 'fleetpulse_active_trip',
  TRIP_HISTORY: 'fleetpulse_trip_history',
} as const;

export const BENGALURU_CENTER = {
  lat: 12.9716,
  lng: 77.5946,
};
