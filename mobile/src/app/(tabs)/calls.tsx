import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { PhoneCall } from 'lucide-react-native';
import { Colors } from '../../theme/colors';

export default function CallsScreen() {
  return (
    <View style={styles.container}>
      <PhoneCall size={64} color="#CBD5E1" />
      <Text style={styles.title}>No recent calls</Text>
      <Text style={styles.subtitle}>
        WebRTC audio & video call logs will appear here.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.light.textPrimary,
    marginTop: 16,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    textAlign: 'center',
  },
});
