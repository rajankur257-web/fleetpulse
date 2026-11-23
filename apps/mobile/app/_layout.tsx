import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DriverProvider } from '../src/context/DriverContext';
import { OfferModal } from '../src/components/OfferModal';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <DriverProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerStyle: {
              backgroundColor: '#020617',
            },
            headerTintColor: '#f8fafc',
            headerTitleStyle: {
              fontWeight: 'bold',
            },
            contentStyle: {
              backgroundColor: '#020617',
            },
          }}
        >
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="login" options={{ title: 'Driver Sign In', headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        </Stack>
        <OfferModal />
      </DriverProvider>
    </SafeAreaProvider>
  );
}
