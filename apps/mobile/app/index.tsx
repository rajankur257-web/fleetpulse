import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useDriver } from '../src/context/DriverContext';

export default function IndexScreen() {
  const { driver } = useDriver();

  useEffect(() => {
    const timer = setTimeout(() => {
      if (driver) {
        router.replace('/(tabs)');
      } else {
        router.replace('/login');
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [driver]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#10b981" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
