import React from 'react';
import { Redirect } from 'expo-router';
import { useAuthStore } from '../store/auth';

export default function IndexScreen() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  if (isAuthenticated) {
    return <Redirect href="/(tabs)/chats" />;
  }

  return <Redirect href="/(auth)/welcome" />;
}
