import { StyleSheet, Text, View } from 'react-native';
import {
  FLEET_PULSE_VERSION,
  DriverStatus,
  haversineKm,
} from '@fleet-pulse/shared';

export default function HomeScreen() {
  const sampleDist = Math.round(
    haversineKm({ lat: 12.9716, lng: 77.5946 }, { lat: 13.0827, lng: 80.2707 }),
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Fleet Pulse Driver (v{FLEET_PULSE_VERSION})</Text>
      <Text style={styles.subtitle}>Driver companion application</Text>
      <Text style={styles.status}>Status: {DriverStatus.AVAILABLE}</Text>
      <Text style={styles.smoke}>Bengaluru to Chennai: ~{sampleDist} km</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#f8fafc',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#94a3b8',
    marginBottom: 8,
  },
  status: {
    fontSize: 14,
    color: '#10b981',
    fontWeight: '600',
    marginTop: 4,
  },
  smoke: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
  },
});

