import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Colors } from '../theme/colors';
import { getLocalDatabase } from '../db/client';

export default function RootLayout() {
  useEffect(() => {
    getLocalDatabase().catch((err) =>
      console.error('[SQLite] Failed to initialize database:', err)
    );
  }, []);

  return (
    <>
      <StatusBar style="light" backgroundColor={Colors.light.headerBackground} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: Colors.light.headerBackground },
          headerTintColor: '#FFFFFF',
          headerTitleStyle: { fontWeight: 'bold' },
          contentStyle: { backgroundColor: '#FFFFFF' },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="chat/[id]"
          options={{ title: 'Chat' }}
        />
      </Stack>
    </>
  );
}
