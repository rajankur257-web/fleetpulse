import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { Driver } from '@fleet-pulse/shared';
import { STORAGE_KEYS } from './constants';

const isSecureStoreAvailable = Platform.OS === 'ios' || Platform.OS === 'android';

export const storage = {
  async setItem(key: string, value: string): Promise<void> {
    try {
      if (isSecureStoreAvailable) {
        await SecureStore.setItemAsync(key, value);
      } else {
        await AsyncStorage.setItem(key, value);
      }
    } catch {
      await AsyncStorage.setItem(key, value);
    }
  },

  async getItem(key: string): Promise<string | null> {
    try {
      if (isSecureStoreAvailable) {
        const val = await SecureStore.getItemAsync(key);
        if (val !== null) return val;
      }
      return await AsyncStorage.getItem(key);
    } catch {
      return await AsyncStorage.getItem(key);
    }
  },

  async removeItem(key: string): Promise<void> {
    try {
      if (isSecureStoreAvailable) {
        await SecureStore.deleteItemAsync(key);
      }
    } catch {
      // ignore
    }
    try {
      await AsyncStorage.removeItem(key);
    } catch {
      // ignore
    }
  },

  // Helpers for Driver Profile & Auth Token
  async saveToken(token: string): Promise<void> {
    await this.setItem(STORAGE_KEYS.AUTH_TOKEN, token);
  },

  async getToken(): Promise<string | null> {
    return await this.getItem(STORAGE_KEYS.AUTH_TOKEN);
  },

  async clearToken(): Promise<void> {
    await this.removeItem(STORAGE_KEYS.AUTH_TOKEN);
  },

  async saveDriver(driver: Driver): Promise<void> {
    await this.setItem(STORAGE_KEYS.DRIVER_PROFILE, JSON.stringify(driver));
  },

  async getDriver(): Promise<Driver | null> {
    const raw = await this.getItem(STORAGE_KEYS.DRIVER_PROFILE);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as Driver;
    } catch {
      return null;
    }
  },

  async clearDriver(): Promise<void> {
    await this.removeItem(STORAGE_KEYS.DRIVER_PROFILE);
  },
};
