import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Driver, DriverStatus } from '@fleet-pulse/shared';
import { useDriver } from '../src/context/DriverContext';
import { fetchDrivers } from '../src/lib/api';
import { BENGALURU_CENTER } from '../src/lib/constants';

export default function LoginScreen() {
  const { login } = useDriver();
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  useEffect(() => {
    async function loadDrivers() {
      setIsLoading(true);
      const list = await fetchDrivers();
      if (list.length > 0) {
        setDrivers(list);
      } else {
        // Fallback demo drivers if API backend is starting
        const mockDrivers: Driver[] = Array.from({ length: 10 }).map((_, i) => ({
          id: `driver-demo-${i + 1}`,
          name: `Driver #${i + 1}`,
          phone: `+91980000${String(1001 + i)}`,
          status: DriverStatus.AVAILABLE,
          lat: BENGALURU_CENTER.lat + (i * 0.005 - 0.02),
          lng: BENGALURU_CENTER.lng + (i * 0.005 - 0.02),
          rating: 4.8,
          dailyTrips: 3,
        }));
        setDrivers(mockDrivers);
      }
      setIsLoading(false);
    }
    loadDrivers();
  }, []);

  const handleSelectDriver = async (selected: Driver) => {
    setIsLoggingIn(true);
    await login(selected);
    setIsLoggingIn(false);
    router.replace('/(tabs)');
  };

  return (
    <View style={styles.container}>
      {/* Brand Header */}
      <View style={styles.header}>
        <View style={styles.iconCircle}>
          <Ionicons name="flash" size={32} color="#10b981" />
        </View>
        <Text style={styles.title}>FLEET PULSE</Text>
        <Text style={styles.subtitle}>Driver Companion Portal</Text>
        <Text style={styles.hint}>
          Select your driver account to begin dispatch tracking
        </Text>
      </View>

      {/* Driver List */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#10b981" />
          <Text style={styles.loadingText}>Fetching active fleet drivers...</Text>
        </View>
      ) : (
        <FlatList
          data={drivers}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          renderItem={({ item, index }) => (
            <TouchableOpacity
              style={styles.driverCard}
              onPress={() => handleSelectDriver(item)}
              disabled={isLoggingIn}
            >
              <View style={styles.driverAvatar}>
                <Text style={styles.avatarText}>#{index + 1}</Text>
              </View>

              <View style={styles.driverInfo}>
                <View style={styles.driverNameRow}>
                  <Text style={styles.driverName}>{item.name}</Text>
                  <View style={styles.ratingBadge}>
                    <Ionicons name="star" size={12} color="#f59e0b" />
                    <Text style={styles.ratingText}>{item.rating?.toFixed(1) || '5.0'}</Text>
                  </View>
                </View>
                <Text style={styles.driverPhone}>{item.phone}</Text>
              </View>

              <Ionicons name="chevron-forward" size={20} color="#64748b" />
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
    paddingTop: 60,
    paddingHorizontal: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#f8fafc',
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: 14,
    color: '#94a3b8',
    marginTop: 2,
  },
  hint: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 8,
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    color: '#94a3b8',
  },
  listContainer: {
    paddingBottom: 30,
    gap: 10,
  },
  driverCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  driverAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#818cf8',
  },
  driverInfo: {
    flex: 1,
  },
  driverNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  driverName: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#f8fafc',
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  ratingText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#fbbf24',
  },
  driverPhone: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
});
