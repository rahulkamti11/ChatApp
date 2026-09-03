import React from 'react';
import { View, Text, StyleSheet, Switch, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Shield, Cloud, LogOut, Star, ChevronRight } from 'lucide-react-native';
import { useAuthStore } from '../../store/auth';
import { socketService } from '../../services/socket';
import { Colors } from '../../theme/colors';

export default function SettingsScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const updateUser = useAuthStore((state) => state.updateUser);
  const logout = useAuthStore((state) => state.logout);

  const handleLogout = () => {
    socketService.disconnect();
    logout();
    router.replace('/(auth)/welcome');
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {(user?.displayName || 'U')[0].toUpperCase()}
          </Text>
        </View>
        <View style={styles.profileDetails}>
          <Text style={styles.displayName}>{user?.displayName}</Text>
          <Text style={styles.virtualNumber}>{user?.virtualNumber || '+888-0000-0000'}</Text>
          {user?.username && <Text style={styles.username}>@{user.username}</Text>}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionHeader}>BOOKMARKS</Text>

        <TouchableOpacity
          style={styles.navRow}
          activeOpacity={0.7}
          onPress={() => router.push('/starred-messages')}
        >
          <View style={styles.rowLeft}>
            <Star size={20} color="#F59E0B" />
            <Text style={styles.rowText}>Starred Messages</Text>
          </View>
          <ChevronRight size={18} color={Colors.light.textSecondary} />
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionHeader}>PRIVACY & IDENTITY</Text>

        <View style={styles.row}>
          <View style={styles.rowLeft}>
            <Shield size={20} color={Colors.light.primary} />
            <Text style={styles.rowText}>Show Virtual Mobile Number</Text>
          </View>
          <Switch
            value={user?.showVirtualNumber ?? true}
            onValueChange={(val) => updateUser({ showVirtualNumber: val })}
            trackColor={{ false: '#767577', true: Colors.light.primary }}
          />
        </View>

        <View style={styles.row}>
          <View style={styles.rowLeft}>
            <Cloud size={20} color={Colors.light.primary} />
            <Text style={styles.rowText}>Cloud Text Sync (Free Tier)</Text>
          </View>
          <Switch
            value={user?.cloudSyncEnabled ?? false}
            onValueChange={(val) => updateUser({ cloudSyncEnabled: val })}
            trackColor={{ false: '#767577', true: Colors.light.primary }}
          />
        </View>
      </View>

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.8}>
        <LogOut size={20} color={Colors.light.error} />
        <Text style={styles.logoutText}>Log Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0F2F5',
  },
  profileCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    padding: 16,
    alignItems: 'center',
    marginBottom: 20,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.light.headerBackground,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
  },
  profileDetails: {
    marginLeft: 16,
  },
  displayName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.light.textPrimary,
  },
  virtualNumber: {
    fontSize: 14,
    color: Colors.light.primary,
    fontWeight: '600',
    marginTop: 2,
  },
  username: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  section: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 20,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: 'bold',
    color: Colors.light.textSecondary,
    marginBottom: 12,
  },
  navRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.light.border,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowText: {
    fontSize: 15,
    color: Colors.light.textPrimary,
    marginLeft: 12,
  },
  logoutButton: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutText: {
    color: Colors.light.error,
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
});
