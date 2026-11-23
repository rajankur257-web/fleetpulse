import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from './constants';

export interface QueueLocationPing {
  type: 'LOCATION_PING';
  driverId: string;
  lat: number;
  lng: number;
  heading?: number;
  speed?: number;
  timestamp: number;
}

export interface QueueStatusUpdate {
  type: 'STATUS_UPDATE';
  driverId: string;
  status: string;
  timestamp: number;
}

export type OfflineQueueItem = QueueLocationPing | QueueStatusUpdate;

export class OfflineQueueService {
  private inMemoryQueue: OfflineQueueItem[] = [];
  private isLoaded = false;
  private isFlushing = false;

  async load(): Promise<OfflineQueueItem[]> {
    if (this.isLoaded) return this.inMemoryQueue;
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEYS.OFFLINE_QUEUE);
      if (raw) {
        this.inMemoryQueue = JSON.parse(raw);
      }
    } catch {
      this.inMemoryQueue = [];
    }
    this.isLoaded = true;
    return this.inMemoryQueue;
  }

  async enqueue(item: OfflineQueueItem): Promise<void> {
    await this.load();
    this.inMemoryQueue.push(item);

    // Keep buffer capped at 500 items to avoid storage explosion
    if (this.inMemoryQueue.length > 500) {
      this.inMemoryQueue.shift();
    }

    try {
      await AsyncStorage.setItem(
        STORAGE_KEYS.OFFLINE_QUEUE,
        JSON.stringify(this.inMemoryQueue),
      );
    } catch {
      // Storage write error ignored in background
    }
  }

  async getCount(): Promise<number> {
    await this.load();
    return this.inMemoryQueue.length;
  }

  async clear(): Promise<void> {
    this.inMemoryQueue = [];
    await AsyncStorage.removeItem(STORAGE_KEYS.OFFLINE_QUEUE);
  }

  async flush(
    onSendItem: (item: OfflineQueueItem) => Promise<boolean>,
  ): Promise<{ sent: number; remaining: number }> {
    if (this.isFlushing) {
      return { sent: 0, remaining: this.inMemoryQueue.length };
    }

    this.isFlushing = true;
    await this.load();

    let sentCount = 0;
    const remainingItems: OfflineQueueItem[] = [];

    for (let i = 0; i < this.inMemoryQueue.length; i++) {
      const item = this.inMemoryQueue[i]!;
      try {
        const success = await onSendItem(item);
        if (success) {
          sentCount++;
        } else {
          // If a request fails, keep this item and all remaining
          remainingItems.push(...this.inMemoryQueue.slice(i));
          break;
        }
      } catch {
        remainingItems.push(...this.inMemoryQueue.slice(i));
        break;
      }
    }

    this.inMemoryQueue = remainingItems;
    await AsyncStorage.setItem(
      STORAGE_KEYS.OFFLINE_QUEUE,
      JSON.stringify(this.inMemoryQueue),
    );

    this.isFlushing = false;
    return { sent: sentCount, remaining: this.inMemoryQueue.length };
  }
}

export const offlineQueue = new OfflineQueueService();
