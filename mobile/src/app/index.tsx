import React, { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../store/auth';
import WelcomeScreen from './(auth)/welcome';

export default function IndexScreen() {
  const router = useRouter();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  useEffect(() => {
    if (isAuthenticated) {
      router.replace('/(tabs)/chats');
    }
  }, [isAuthenticated, router]);

  if (isAuthenticated) {
    return (
      <View style={{ flex: 1, backgroundColor: '#128C7E', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#FFFFFF" />
      </View>
    );
  }

  return <WelcomeScreen />;
}

