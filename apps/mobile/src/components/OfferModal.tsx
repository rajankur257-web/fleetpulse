import React, { useEffect, useState } from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { haversineKm } from '@fleet-pulse/shared';
import { useDriver } from '../context/DriverContext';
import { OFFER_TIMEOUT_SECONDS } from '../lib/constants';

export function OfferModal() {
  const { incomingOffer, acceptIncomingOffer, rejectIncomingOffer, currentCoords } =
    useDriver();

  const [timeLeft, setTimeLeft] = useState(OFFER_TIMEOUT_SECONDS);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!incomingOffer) {
      setTimeLeft(OFFER_TIMEOUT_SECONDS);
      setIsSubmitting(false);
      return;
    }

    const totalSeconds = incomingOffer.timeoutSeconds || OFFER_TIMEOUT_SECONDS;
    setTimeLeft(totalSeconds);

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [incomingOffer]);

  if (!incomingOffer) return null;

  const pickup = {
    lat: incomingOffer.pickupLat ?? currentCoords.lat + 0.005,
    lng: incomingOffer.pickupLng ?? currentCoords.lng + 0.005,
  };

  const drop = {
    lat: incomingOffer.dropLat ?? currentCoords.lat + 0.025,
    lng: incomingOffer.dropLng ?? currentCoords.lng + 0.02,
  };

  const distanceToPickupKm = haversineKm(currentCoords, pickup);
  const tripDistanceKm = haversineKm(pickup, drop);
  const estimatedFare = Math.round(50 + tripDistanceKm * 15);

  const handleAccept = async () => {
    setIsSubmitting(true);
    await acceptIncomingOffer();
    setIsSubmitting(false);
  };

  const handleDecline = async () => {
    setIsSubmitting(true);
    await rejectIncomingOffer('Declined by driver');
    setIsSubmitting(false);
  };

  const progressPercent = Math.max(
    0,
    (timeLeft / (incomingOffer.timeoutSeconds || OFFER_TIMEOUT_SECONDS)) * 100,
  );

  return (
    <Modal
      transparent
      animationType="slide"
      visible={!!incomingOffer}
      onRequestClose={handleDecline}
    >
      <View style={styles.backdrop}>
        <View style={styles.modalCard}>
          {/* Header Banner & Countdown Timer */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <View style={styles.pulseBadge}>
                <Text style={styles.pulseText}>NEW DELIVERY OFFER</Text>
              </View>
              <View style={styles.timerBadge}>
                <Ionicons name="time-outline" size={14} color="#f59e0b" />
                <Text style={styles.timerText}>{timeLeft}s</Text>
              </View>
            </View>

            {/* Countdown Progress Bar */}
            <View style={styles.progressBarBg}>
              <View
                style={[
                  styles.progressBarFill,
                  { width: `${progressPercent}%` },
                  timeLeft <= 5 ? styles.progressDanger : null,
                ]}
              />
            </View>
          </View>

          {/* Fare & Distance Highlight */}
          <View style={styles.fareContainer}>
            <View>
              <Text style={styles.fareLabel}>Estimated Payout</Text>
              <Text style={styles.fareValue}>₹{estimatedFare}</Text>
            </View>
            <View style={styles.tripMeta}>
              <Text style={styles.metaLabel}>Trip Distance</Text>
              <Text style={styles.metaValue}>{tripDistanceKm.toFixed(1)} km</Text>
            </View>
            <View style={styles.tripMeta}>
              <Text style={styles.metaLabel}>To Pickup</Text>
              <Text style={styles.metaValue}>{distanceToPickupKm.toFixed(1)} km</Text>
            </View>
          </View>

          {/* Route Details */}
          <View style={styles.routeContainer}>
            {/* Pickup */}
            <View style={styles.pointRow}>
              <View style={styles.iconContainerPickup}>
                <Ionicons name="radio-button-on" size={16} color="#10b981" />
              </View>
              <View style={styles.pointInfo}>
                <Text style={styles.pointLabel}>PICKUP LOCATION</Text>
                <Text style={styles.pointCoords}>
                  Lat {pickup.lat.toFixed(4)}, Lng {pickup.lng.toFixed(4)}
                </Text>
              </View>
            </View>

            {/* Connector line */}
            <View style={styles.connector} />

            {/* Dropoff */}
            <View style={styles.pointRow}>
              <View style={styles.iconContainerDrop}>
                <Ionicons name="location" size={16} color="#3b82f6" />
              </View>
              <View style={styles.pointInfo}>
                <Text style={styles.pointLabel}>DELIVERY DROPOFF</Text>
                <Text style={styles.pointCoords}>
                  Lat {drop.lat.toFixed(4)}, Lng {drop.lng.toFixed(4)}
                </Text>
              </View>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={[styles.declineButton, isSubmitting && styles.buttonDisabled]}
              onPress={handleDecline}
              disabled={isSubmitting}
            >
              <Ionicons name="close" size={20} color="#f43f5e" />
              <Text style={styles.declineText}>DECLINE</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.acceptButton, isSubmitting && styles.buttonDisabled]}
              onPress={handleAccept}
              disabled={isSubmitting}
            >
              <Ionicons name="checkmark" size={22} color="#ffffff" />
              <Text style={styles.acceptText}>
                {isSubmitting ? 'ACCEPTING...' : 'ACCEPT OFFER'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.85)',
    justifyContent: 'flex-end',
    padding: 16,
  },
  modalCard: {
    backgroundColor: '#0f172a',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#1e293b',
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 20,
  },
  header: {
    marginBottom: 16,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  pulseBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  pulseText: {
    color: '#34d399',
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  timerText: {
    color: '#fbbf24',
    fontSize: 13,
    fontWeight: 'bold',
    fontVariant: ['tabular-nums'],
  },
  progressBarBg: {
    height: 6,
    backgroundColor: '#1e293b',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#10b981',
    borderRadius: 3,
  },
  progressDanger: {
    backgroundColor: '#ef4444',
  },
  fareContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  fareLabel: {
    fontSize: 11,
    color: '#94a3b8',
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  fareValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#10b981',
    marginTop: 2,
  },
  tripMeta: {
    alignItems: 'flex-end',
  },
  metaLabel: {
    fontSize: 10,
    color: '#94a3b8',
    textTransform: 'uppercase',
  },
  metaValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#f8fafc',
    marginTop: 2,
  },
  routeContainer: {
    backgroundColor: '#020617',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  pointRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconContainerPickup: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainerDrop: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pointInfo: {
    flex: 1,
  },
  pointLabel: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  pointCoords: {
    fontSize: 13,
    color: '#f8fafc',
    fontWeight: '600',
    marginTop: 2,
  },
  connector: {
    width: 2,
    height: 20,
    backgroundColor: '#334155',
    marginLeft: 13,
    marginVertical: 4,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  declineButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(244, 63, 94, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.3)',
  },
  declineText: {
    color: '#f43f5e',
    fontSize: 14,
    fontWeight: 'bold',
  },
  acceptButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#10b981',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  acceptText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});
