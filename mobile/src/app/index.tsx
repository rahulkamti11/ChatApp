import React, { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../store/auth';
import { socketService } from '../services/socket';
import WelcomeScreen from './(auth)/welcome';

export default function IndexScreen() {
  const router = useRouter();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isHydrated = useAuthStore((state) => state.isHydrated);
  const token = useAuthStore((state) => state.token);
  const hydrateAuth = useAuthStore((state) => state.hydrateAuth);

  useEffect(() => {
    hydrateAuth();
  }, [hydrateAuth]);

  useEffect(() => {
    if (isHydrated && isAuthenticated) {
      if (token && !socketService.isConnected()) {
        socketService.connect(token);
      }
      router.replace('/(tabs)/chats');
    }
  }, [isHydrated, isAuthenticated, token, router]);

  if (!isHydrated || isAuthenticated) {
    return (
      <View style={{ flex: 1, backgroundColor: '#128C7E', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#FFFFFF" />
      </View>
    );
  }

  return <WelcomeScreen />;
}


