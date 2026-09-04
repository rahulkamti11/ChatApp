import React from 'react';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MessageSquare, Phone, User } from 'lucide-react-native';
import { Colors } from '../../theme/colors';

export default function TabsLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors.light.primary,
        tabBarInactiveTintColor: Colors.light.textSecondary,
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor: Colors.light.border,
          height: 60 + insets.bottom,
          paddingBottom: Math.max(insets.bottom, 8),
          paddingTop: 8,
        },
        headerStyle: {
          backgroundColor: Colors.light.headerBackground,
        },
        headerTintColor: '#FFFFFF',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      }}
    >
      <Tabs.Screen
        name="chats"
        options={{
          title: 'Qwink',
          tabBarLabel: 'Chats',
          tabBarIcon: ({ color, size }: { color: string; size: number }) => <MessageSquare color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="calls"
        options={{
          title: 'Calls',
          tabBarLabel: 'Calls',
          tabBarIcon: ({ color, size }: { color: string; size: number }) => <Phone color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarLabel: 'Profile',
          tabBarIcon: ({ color, size }: { color: string; size: number }) => <User color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}

