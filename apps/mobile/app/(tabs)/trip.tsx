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
import { RequestStatus, haversineKm } from '@fleet-pulse/shared';
import { useDriver } from '../../src/context/DriverContext';

export default function ActiveTripScreen() {
  const { activeTrip, currentCoords, advanceTripStatus } = useDriver();
  const [isUpdating, setIsUpdating] = useState(false);

  if (!activeTrip) {
    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyIconBox}>
          <Ionicons name="bicycle-outline" size={48} color="#64748b" />
        </View>
        <Text style={styles.emptyTitle}>No Active Delivery</Text>
        <Text style={styles.emptySubtitle}>
          You do not have any assigned delivery right now. Keep your vehicle status online on the dashboard to receive offers.
        </Text>
        <TouchableOpacity
          style={styles.goToDashButton}
          onPress={() => router.push('/(tabs)')}
        >
          <Text style={styles.goToDashText}>Back to Dashboard</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isAssigned = activeTrip.status === RequestStatus.ASSIGNED;
  const isPickedUp = activeTrip.status === RequestStatus.PICKED_UP;

  const pickup = {
    lat: activeTrip.pickupLat,
    lng: activeTrip.pickupLng,
  };

  const drop = {
    lat: activeTrip.dropLat,
    lng: activeTrip.dropLng,
  };

  const distToPickup = haversineKm(currentCoords, pickup);
  const distToDrop = haversineKm(currentCoords, drop);
  const totalTripDist = haversineKm(pickup, drop);

  const targetCoords = isAssigned ? pickup : drop;
  const distanceRemaining = isAssigned ? distToPickup : distToDrop;

  const handleAdvance = async () => {
    setIsUpdating(true);
    await advanceTripStatus();
    setIsUpdating(false);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header Bar */}
      <View style={styles.header}>
        <View>
          <Text style={styles.orderNumber}>ORDER #{activeTrip.id.slice(-6).toUpperCase()}</Text>
          <Text style={styles.orderStatus}>
            {isAssigned ? 'EN ROUTE TO PICKUP' : 'IN TRANSIT TO DROPOFF'}
          </Text>
        </View>

        <View style={styles.statusBadge}>
          <Text style={styles.statusBadgeText}>
            {activeTrip.status.toUpperCase()}
          </Text>
        </View>
      </View>

      {/* Lifecycle Progress Steps */}
      <View style={styles.stepsContainer}>
        <View style={styles.stepItem}>
          <View style={[styles.stepCircle, styles.stepActive]}>
            <Ionicons name="checkmark" size={14} color="#ffffff" />
          </View>
          <Text style={styles.stepLabel}>Assigned</Text>
        </View>
        <View
          style={[
            styles.stepLine,
            isPickedUp ? styles.stepLineActive : null,
          ]}
        />
        <View style={styles.stepItem}>
          <View
            style={[
              styles.stepCircle,
              isPickedUp ? styles.stepActive : styles.stepInactive,
            ]}
          >
            {isPickedUp ? (
              <Ionicons name="checkmark" size={14} color="#ffffff" />
            ) : (
              <Text style={styles.stepNumber}>2</Text>
            )}
          </View>
          <Text style={styles.stepLabel}>Picked Up</Text>
        </View>
        <View style={styles.stepLine} />
        <View style={styles.stepItem}>
          <View style={[styles.stepCircle, styles.stepInactive]}>
            <Text style={styles.stepNumber}>3</Text>
          </View>
          <Text style={styles.stepLabel}>Delivered</Text>
        </View>
      </View>

      {/* Navigation Card */}
      <View style={styles.navCard}>
        <View style={styles.navHeader}>
          <Ionicons name="navigate-circle" size={20} color="#10b981" />
          <Text style={styles.navTitle}>
            {isAssigned ? 'NAVIGATING TO PICKUP POINT' : 'NAVIGATING TO DROPOFF POINT'}
          </Text>
        </View>

        <View style={styles.distanceRow}>
          <View>
            <Text style={styles.distLabel}>Distance Remaining</Text>
            <Text style={styles.distValue}>{distanceRemaining.toFixed(1)} km</Text>
          </View>
          <View style={styles.etaBox}>
            <Text style={styles.etaLabel}>Est. Arrival</Text>
            <Text style={styles.etaValue}>
              ~{Math.max(2, Math.round(distanceRemaining * 2.5))} mins
            </Text>
          </View>
        </View>

        <View style={styles.targetCoordsRow}>
          <Ionicons name="pin" size={14} color="#94a3b8" />
          <Text style={styles.targetCoordsText}>
            Target: {targetCoords.lat.toFixed(5)}, {targetCoords.lng.toFixed(5)}
          </Text>
        </View>
      </View>

      {/* Route Detail Card */}
      <View style={styles.routeCard}>
        <Text style={styles.routeCardTitle}>TRIP OVERVIEW</Text>

        <View style={styles.routeRow}>
          <View style={styles.pickupDot} />
          <View style={styles.routeTextCol}>
            <Text style={styles.routePointLabel}>Pickup Location</Text>
            <Text style={styles.routePointCoords}>
              {pickup.lat.toFixed(4)}, {pickup.lng.toFixed(4)}
            </Text>
          </View>
        </View>

        <View style={styles.connectorLine} />

        <View style={styles.routeRow}>
          <View style={styles.dropDot} />
          <View style={styles.routeTextCol}>
            <Text style={styles.routePointLabel}>Dropoff Destination</Text>
            <Text style={styles.routePointCoords}>
              {drop.lat.toFixed(4)}, {drop.lng.toFixed(4)}
            </Text>
          </View>
        </View>

        <View style={styles.tripDivider} />

        <View style={styles.tripSummaryRow}>
          <Text style={styles.summaryLabel}>Total Delivery Distance:</Text>
          <Text style={styles.summaryValue}>{totalTripDist.toFixed(1)} km</Text>
        </View>
        <View style={styles.tripSummaryRow}>
          <Text style={styles.summaryLabel}>Delivery Payout:</Text>
          <Text style={[styles.summaryValue, { color: '#10b981' }]}>
            ₹{Math.round(50 + totalTripDist * 15)}
          </Text>
        </View>
      </View>

      {/* Big Action Button */}
      <TouchableOpacity
        style={[
          styles.actionButton,
          isAssigned ? styles.pickupActionBtn : styles.deliverActionBtn,
          isUpdating && styles.buttonDisabled,
        ]}
        onPress={handleAdvance}
        disabled={isUpdating}
      >
        <Ionicons
          name={isAssigned ? 'cube' : 'checkmark-done'}
          size={20}
          color="#ffffff"
        />
        <Text style={styles.actionButtonText}>
          {isUpdating
            ? 'UPDATING...'
            : isAssigned
            ? 'CONFIRM ORDER PICKED UP'
            : 'CONFIRM ORDER DELIVERED'}
        </Text>
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
  emptyContainer: {
    flex: 1,
    backgroundColor: '#020617',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
  },
  emptyIconBox: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(100, 116, 139, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#f8fafc',
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  goToDashButton: {
    marginTop: 24,
    backgroundColor: '#10b981',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  goToDashText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: 'bold',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderNumber: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#64748b',
    letterSpacing: 0.5,
  },
  orderStatus: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#f8fafc',
    marginTop: 2,
  },
  statusBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#10b981',
  },
  stepsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0f172a',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  stepItem: {
    alignItems: 'center',
  },
  stepCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepActive: {
    backgroundColor: '#10b981',
  },
  stepInactive: {
    backgroundColor: '#1e293b',
  },
  stepNumber: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#64748b',
  },
  stepLabel: {
    fontSize: 10,
    color: '#94a3b8',
    marginTop: 4,
    fontWeight: '600',
  },
  stepLine: {
    flex: 1,
    height: 2,
    backgroundColor: '#1e293b',
    marginHorizontal: 8,
    marginBottom: 14,
  },
  stepLineActive: {
    backgroundColor: '#10b981',
  },
  navCard: {
    backgroundColor: '#0f172a',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  navHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  navTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#10b981',
    letterSpacing: 0.5,
  },
  distanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  distLabel: {
    fontSize: 11,
    color: '#94a3b8',
  },
  distValue: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#f8fafc',
    marginTop: 2,
  },
  etaBox: {
    alignItems: 'flex-end',
  },
  etaLabel: {
    fontSize: 11,
    color: '#94a3b8',
  },
  etaValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#f59e0b',
    marginTop: 2,
  },
  targetCoordsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#020617',
    padding: 10,
    borderRadius: 10,
  },
  targetCoordsText: {
    fontSize: 11,
    color: '#94a3b8',
    fontVariant: ['tabular-nums'],
  },
  routeCard: {
    backgroundColor: '#0f172a',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  routeCardTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#64748b',
    letterSpacing: 0.5,
    marginBottom: 14,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  pickupDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#10b981',
  },
  dropDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#3b82f6',
  },
  connectorLine: {
    width: 2,
    height: 20,
    backgroundColor: '#334155',
    marginLeft: 5,
    marginVertical: 4,
  },
  routeTextCol: {
    flex: 1,
  },
  routePointLabel: {
    fontSize: 10,
    color: '#94a3b8',
    fontWeight: 'bold',
  },
  routePointCoords: {
    fontSize: 13,
    color: '#f8fafc',
    fontWeight: '600',
    marginTop: 2,
  },
  tripDivider: {
    height: 1,
    backgroundColor: '#1e293b',
    marginVertical: 14,
  },
  tripSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#94a3b8',
  },
  summaryValue: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#f8fafc',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  pickupActionBtn: {
    backgroundColor: '#6366f1',
  },
  deliverActionBtn: {
    backgroundColor: '#10b981',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#ffffff',
    letterSpacing: 0.5,
  },
});
