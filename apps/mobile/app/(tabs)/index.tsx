import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { DriverStatus } from '@fleet-pulse/shared';
import { useDriver } from '../../src/context/DriverContext';

export default function DashboardScreen() {
  const {
    driver,
    status,
    isOnline,
    currentCoords,
    activeTrip,
    completedTrips,
    queueCount,
    isSocketConnected,
    isTracking,
    toggleOnline,
    simulateIncomingOffer,
  } = useDriver();

  const handleToggleOnline = (value: boolean) => {
    toggleOnline(value);
  };

  const getStatusColor = () => {
    if (status === DriverStatus.AVAILABLE) return '#10b981';
    if (status === DriverStatus.BUSY) return '#f59e0b';
    return '#64748b';
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Top Bar: Driver Identity & Online Toggle */}
      <View style={styles.topBar}>
        <View>
          <Text style={styles.driverGreeting}>Hello, {driver?.name || 'Driver'}</Text>
          <View style={styles.subInfoRow}>
            <View style={styles.ratingBadge}>
              <Ionicons name="star" size={12} color="#f59e0b" />
              <Text style={styles.ratingText}>{driver?.rating?.toFixed(1) || '5.0'}</Text>
            </View>
            <View
              style={[
                styles.socketBadge,
                isSocketConnected ? styles.socketOnline : styles.socketOffline,
              ]}
            >
              <View
                style={[
                  styles.socketDot,
                  { backgroundColor: isSocketConnected ? '#10b981' : '#f43f5e' },
                ]}
              />
              <Text style={styles.socketText}>
                {isSocketConnected ? 'LIVE SOCKET' : 'OFFLINE'}
              </Text>
            </View>
          </View>
        </View>

        {/* Online / Offline Switch */}
        <View style={styles.toggleWrapper}>
          <Text style={styles.toggleLabel}>{isOnline ? 'ONLINE' : 'OFFLINE'}</Text>
          <Switch
            value={isOnline}
            onValueChange={handleToggleOnline}
            trackColor={{ false: '#334155', true: '#10b981' }}
            thumbColor={isOnline ? '#ffffff' : '#94a3b8'}
          />
        </View>
      </View>

      {/* Hero Status Card */}
      <View style={styles.statusCard}>
        <View style={styles.statusIndicatorRow}>
          <View
            style={[
              styles.statusPulseCircle,
              { backgroundColor: `${getStatusColor()}20`, borderColor: getStatusColor() },
            ]}
          >
            <View
              style={[styles.statusInnerDot, { backgroundColor: getStatusColor() }]}
            />
          </View>
          <View>
            <Text style={styles.statusTitle}>
              {status === DriverStatus.AVAILABLE
                ? 'Ready for Deliveries'
                : status === DriverStatus.BUSY
                ? 'Active Delivery in Progress'
                : 'Vehicle Offline'}
            </Text>
            <Text style={styles.statusSubtitle}>
              {status === DriverStatus.AVAILABLE
                ? 'Listening for nearby dispatch offers in Bengaluru'
                : status === DriverStatus.BUSY
                ? 'Navigating to current pickup/drop location'
                : 'Turn on toggle to start receiving delivery requests'}
            </Text>
          </View>
        </View>

        {activeTrip && (
          <TouchableOpacity
            style={styles.activeTripBanner}
            onPress={() => router.push('/(tabs)/trip')}
          >
            <View style={styles.bannerInfo}>
              <Ionicons name="navigate" size={18} color="#10b981" />
              <Text style={styles.bannerText}>
                Active Trip: {activeTrip.status.toUpperCase()}
              </Text>
            </View>
            <Ionicons name="arrow-forward" size={16} color="#10b981" />
          </TouchableOpacity>
        )}
      </View>

      {/* GPS Telemetry Card */}
      <View style={styles.telemetryCard}>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <Ionicons name="locate" size={16} color="#10b981" />
            <Text style={styles.cardTitle}>GPS TELEMETRY</Text>
          </View>
          <View style={styles.trackingBadge}>
            <Text style={styles.trackingText}>
              {isTracking ? 'BG TRACKING ON' : 'PAUSED'}
            </Text>
          </View>
        </View>

        <View style={styles.telemetryGrid}>
          <View style={styles.telemetryItem}>
            <Text style={styles.telemetryLabel}>Latitude</Text>
            <Text style={styles.telemetryValue}>
              {currentCoords.lat.toFixed(5)}
            </Text>
          </View>
          <View style={styles.telemetryItem}>
            <Text style={styles.telemetryLabel}>Longitude</Text>
            <Text style={styles.telemetryValue}>
              {currentCoords.lng.toFixed(5)}
            </Text>
          </View>
          <View style={styles.telemetryItem}>
            <Text style={styles.telemetryLabel}>Speed</Text>
            <Text style={styles.telemetryValue}>
              {currentCoords.speed ? `${currentCoords.speed.toFixed(0)} km/h` : '0 km/h'}
            </Text>
          </View>
          <View style={styles.telemetryItem}>
            <Text style={styles.telemetryLabel}>Heading</Text>
            <Text style={styles.telemetryValue}>
              {currentCoords.heading ? `${currentCoords.heading.toFixed(0)}°` : '0°'}
            </Text>
          </View>
        </View>
      </View>

      {/* Quick Metrics Grid */}
      <View style={styles.metricsGrid}>
        <View style={styles.metricCard}>
          <View style={styles.metricIconBox}>
            <Ionicons name="checkmark-done" size={18} color="#10b981" />
          </View>
          <Text style={styles.metricValue}>{completedTrips.length}</Text>
          <Text style={styles.metricLabel}>Completed</Text>
        </View>

        <View style={styles.metricCard}>
          <View style={[styles.metricIconBox, { backgroundColor: 'rgba(59, 130, 246, 0.15)' }]}>
            <Ionicons name="cash-outline" size={18} color="#3b82f6" />
          </View>
          <Text style={styles.metricValue}>₹{completedTrips.length * 120}</Text>
          <Text style={styles.metricLabel}>Earnings</Text>
        </View>

        <View style={styles.metricCard}>
          <View style={[styles.metricIconBox, { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}>
            <Ionicons name="layers-outline" size={18} color="#f59e0b" />
          </View>
          <Text style={styles.metricValue}>{queueCount}</Text>
          <Text style={styles.metricLabel}>Buffered</Text>
        </View>
      </View>

      {/* Simulation / Verification Trigger Button */}
      <View style={styles.simCard}>
        <Text style={styles.simTitle}>TEST & VERIFICATION CONTROLS</Text>
        <Text style={styles.simDesc}>
          Simulate an incoming dispatch offer to test the audio/haptic alert, 20s countdown ring, and accept/reject flow.
        </Text>
        <TouchableOpacity
          style={styles.simButton}
          onPress={simulateIncomingOffer}
        >
          <Ionicons name="notifications" size={18} color="#ffffff" />
          <Text style={styles.simButtonText}>Simulate Dispatch Offer (20s)</Text>
        </TouchableOpacity>
      </View>
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
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  driverGreeting: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#f8fafc',
  },
  subInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
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
  socketBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  socketOnline: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  socketOffline: {
    backgroundColor: 'rgba(244, 63, 94, 0.12)',
    borderColor: 'rgba(244, 63, 94, 0.3)',
  },
  socketDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  socketText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#94a3b8',
  },
  toggleWrapper: {
    alignItems: 'center',
  },
  toggleLabel: {
    fontSize: 10,
    color: '#94a3b8',
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statusCard: {
    backgroundColor: '#0f172a',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  statusIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  statusPulseCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusInnerDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  statusTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#f8fafc',
  },
  statusSubtitle: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
    maxWidth: 240,
  },
  activeTripBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    borderRadius: 12,
    padding: 12,
    marginTop: 14,
  },
  bannerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bannerText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#10b981',
  },
  telemetryCard: {
    backgroundColor: '#0f172a',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cardTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#94a3b8',
    letterSpacing: 0.5,
  },
  trackingBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  trackingText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#34d399',
  },
  telemetryGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  telemetryItem: {
    alignItems: 'center',
  },
  telemetryLabel: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '600',
  },
  telemetryValue: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#f8fafc',
    marginTop: 4,
    fontVariant: ['tabular-nums'],
  },
  metricsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#0f172a',
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  metricIconBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  metricValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#f8fafc',
  },
  metricLabel: {
    fontSize: 10,
    color: '#94a3b8',
    marginTop: 2,
  },
  simCard: {
    backgroundColor: '#0f172a',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  simTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#f59e0b',
    letterSpacing: 0.5,
  },
  simDesc: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 4,
    marginBottom: 14,
    lineHeight: 16,
  },
  simButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#d97706',
    borderRadius: 12,
    paddingVertical: 12,
  },
  simButtonText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#ffffff',
  },
});
