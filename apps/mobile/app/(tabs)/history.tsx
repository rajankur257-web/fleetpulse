import React from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { haversineKm } from '@fleet-pulse/shared';
import { useDriver } from '../../src/context/DriverContext';

export default function HistoryScreen() {
  const { completedTrips } = useDriver();

  const totalEarnings = completedTrips.reduce((acc, trip) => {
    const dist = haversineKm(
      { lat: trip.pickupLat, lng: trip.pickupLng },
      { lat: trip.dropLat, lng: trip.dropLng },
    );
    return acc + Math.round(50 + dist * 15);
  }, 0);

  return (
    <View style={styles.container}>
      {/* Header Summary */}
      <View style={styles.header}>
        <Text style={styles.pageTitle}>TRIP HISTORY</Text>
        <Text style={styles.pageSubtitle}>Completed deliveries & earnings</Text>

        <View style={styles.summaryCard}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Total Trips</Text>
            <Text style={styles.summaryValue}>{completedTrips.length}</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Total Earnings</Text>
            <Text style={[styles.summaryValue, { color: '#10b981' }]}>
              ₹{totalEarnings}
            </Text>
          </View>
        </View>
      </View>

      {/* List */}
      {completedTrips.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="time-outline" size={44} color="#64748b" />
          <Text style={styles.emptyText}>No completed deliveries yet today.</Text>
        </View>
      ) : (
        <FlatList
          data={completedTrips}
          keyExtractor={(item, index) => `${item.id}-${index}`}
          contentContainerStyle={styles.listContainer}
          renderItem={({ item }) => {
            const dist = haversineKm(
              { lat: item.pickupLat, lng: item.pickupLng },
              { lat: item.dropLat, lng: item.dropLng },
            );
            const payout = Math.round(50 + dist * 15);

            return (
              <View style={styles.tripCard}>
                <View style={styles.tripCardHeader}>
                  <View style={styles.orderBadge}>
                    <Text style={styles.orderId}>
                      ORDER #{item.id.slice(-6).toUpperCase()}
                    </Text>
                  </View>
                  <Text style={styles.payoutText}>+₹{payout}</Text>
                </View>

                <View style={styles.tripDetailsRow}>
                  <View style={styles.detailItem}>
                    <Ionicons name="map-outline" size={13} color="#94a3b8" />
                    <Text style={styles.detailText}>{dist.toFixed(1)} km</Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Ionicons name="checkmark-circle" size={13} color="#10b981" />
                    <Text style={[styles.detailText, { color: '#10b981' }]}>
                      Delivered
                    </Text>
                  </View>
                </View>
              </View>
            );
          }}
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
    marginBottom: 20,
  },
  pageTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#f8fafc',
  },
  pageSubtitle: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 2,
  },
  summaryCard: {
    flexDirection: 'row',
    backgroundColor: '#0f172a',
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryDivider: {
    width: 1,
    backgroundColor: '#1e293b',
  },
  summaryLabel: {
    fontSize: 11,
    color: '#94a3b8',
    textTransform: 'uppercase',
  },
  summaryValue: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#f8fafc',
    marginTop: 4,
  },
  listContainer: {
    paddingBottom: 30,
    gap: 12,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyText: {
    fontSize: 13,
    color: '#64748b',
  },
  tripCard: {
    backgroundColor: '#0f172a',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  tripCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderBadge: {
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  orderId: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#818cf8',
  },
  payoutText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#10b981',
  },
  tripDetailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: 12,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  detailText: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '500',
  },
});
