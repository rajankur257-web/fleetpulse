import React, { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useDriver } from '../../src/context/DriverContext';
import { API_BASE_URL, SOCKET_URL } from '../../src/lib/constants';

export default function ProfileScreen() {
  const {
    driver,
    status,
    queueCount,
    isSocketConnected,
    flushOfflineQueue,
    logout,
  } = useDriver();

  const [isFlushing, setIsFlushing] = useState(false);
  const [flushResult, setFlushResult] = useState<string | null>(null);

  const handleFlush = async () => {
    setIsFlushing(true);
    const sent = await flushOfflineQueue();
    setIsFlushing(false);
    setFlushResult(`Flushed ${sent} buffered pings.`);
    setTimeout(() => setFlushResult(null), 3000);
  };

  const handleLogout = async () => {
    await logout();
    router.replace('/login');
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.avatarCircle}>
          <Ionicons name="person" size={32} color="#10b981" />
        </View>
        <Text style={styles.driverName}>{driver?.name || 'Driver'}</Text>
        <Text style={styles.driverPhone}>{driver?.phone || '+91 9800000000'}</Text>
        <View style={styles.statusPill}>
          <Text style={styles.statusPillText}>{status.toUpperCase()}</Text>
        </View>
      </View>

      {/* Driver Information Card */}
      <View style={styles.card}>
        <Text style={styles.cardSectionTitle}>DRIVER CREDENTIALS</Text>

        <View style={styles.row}>
          <Text style={styles.label}>Driver ID</Text>
          <Text style={styles.value}>{driver?.id.slice(0, 16)}...</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Rating</Text>
          <Text style={[styles.value, { color: '#f59e0b' }]}>
            ★ {driver?.rating?.toFixed(1) || '5.0'}
          </Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Daily Completed Trips</Text>
          <Text style={styles.value}>{driver?.dailyTrips || 0}</Text>
        </View>
      </View>

      {/* Network & Offline Telemetry Buffer Card */}
      <View style={styles.card}>
        <Text style={styles.cardSectionTitle}>CONNECTIVITY & OFFLINE BUFFER</Text>

        <View style={styles.row}>
          <Text style={styles.label}>Socket.IO Realtime</Text>
          <View style={styles.connStatus}>
            <View
              style={[
                styles.dot,
                { backgroundColor: isSocketConnected ? '#10b981' : '#f43f5e' },
              ]}
            />
            <Text
              style={[
                styles.value,
                { color: isSocketConnected ? '#10b981' : '#f43f5e' },
              ]}
            >
              {isSocketConnected ? 'CONNECTED' : 'DISCONNECTED'}
            </Text>
          </View>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>API Base URL</Text>
          <Text style={styles.valueSub}>{API_BASE_URL}</Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Socket Endpoint</Text>
          <Text style={styles.valueSub}>{SOCKET_URL}</Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.row}>
          <View>
            <Text style={styles.label}>Offline Buffered Events</Text>
            <Text style={styles.hint}>Buffered pings waiting to sync</Text>
          </View>
          <Text style={styles.queueCountValue}>{queueCount}</Text>
        </View>

        {flushResult && (
          <Text style={styles.flushSuccess}>{flushResult}</Text>
        )}

        <TouchableOpacity
          style={[styles.flushButton, isFlushing && styles.buttonDisabled]}
          onPress={handleFlush}
          disabled={isFlushing || queueCount === 0}
        >
          <Ionicons name="sync" size={16} color="#ffffff" />
          <Text style={styles.flushButtonText}>
            {isFlushing ? 'SYNCING QUEUE...' : 'SYNC OFFLINE BUFFER NOW'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Logout Button */}
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={18} color="#f43f5e" />
        <Text style={styles.logoutText}>SIGN OUT</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
  },
  content: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 40,
    gap: 16,
  },
  header: {
    alignItems: 'center',
    marginBottom: 8,
  },
  avatarCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  driverName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#f8fafc',
  },
  driverPhone: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 2,
  },
  statusPill: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 8,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#10b981',
  },
  card: {
    backgroundColor: '#0f172a',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  cardSectionTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#64748b',
    letterSpacing: 0.5,
    marginBottom: 14,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  label: {
    fontSize: 13,
    color: '#94a3b8',
  },
  hint: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 2,
  },
  value: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#f8fafc',
  },
  valueSub: {
    fontSize: 11,
    color: '#64748b',
    fontVariant: ['tabular-nums'],
  },
  connStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  divider: {
    height: 1,
    backgroundColor: '#1e293b',
    marginVertical: 10,
  },
  queueCountValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#f59e0b',
  },
  flushSuccess: {
    fontSize: 12,
    color: '#10b981',
    fontWeight: '600',
    textAlign: 'center',
    marginVertical: 6,
  },
  flushButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#334155',
    borderRadius: 12,
    paddingVertical: 12,
    marginTop: 10,
  },
  flushButtonText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(244, 63, 94, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.3)',
    borderRadius: 16,
    paddingVertical: 14,
    marginTop: 10,
  },
  logoutText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#f43f5e',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});
