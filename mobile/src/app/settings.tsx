import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import {
  Shield,
  Cloud,
  LogOut,
  Star,
  ChevronRight,
  Trash2,
  Info,
  Lock,
  HardDrive,
} from 'lucide-react-native';
import { useAuthStore } from '../store/auth';
import { socketService } from '../services/socket';
import { getLocalDatabase } from '../db/client';
import { Colors } from '../theme/colors';

export default function SettingsScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const updateUser = useAuthStore((state) => state.updateUser);
  const logout = useAuthStore((state) => state.logout);

  const [messageCount, setMessageCount] = useState<number>(0);

  useEffect(() => {
    (async () => {
      try {
        const db = await getLocalDatabase();
        const res: any = await db.getFirstAsync(
          'SELECT COUNT(*) as cnt FROM local_messages'
        );
        if (res && res.cnt !== undefined) {
          setMessageCount(res.cnt);
        }
      } catch (err) {}
    })();
  }, []);

  const handleClearCache = async () => {
    Alert.alert(
      'Clear Storage Cache',
      'This will optimize local storage cache. Your messages and media will remain intact.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Optimize',
          onPress: async () => {
            try {
              const db = await getLocalDatabase();
              await db.execAsync('VACUUM;');
              Alert.alert('Success', 'Local cache optimized successfully.');
            } catch (err) {
              Alert.alert('Error', 'Failed to clear cache.');
            }
          },
        },
      ]
    );
  };

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out of Qwink?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: () => {
          socketService.disconnect();
          logout();
          router.replace('/(auth)/welcome');
        },
      },
    ]);
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Settings',
          headerStyle: { backgroundColor: Colors.light.headerBackground },
          headerTintColor: '#FFFFFF',
          headerTitleStyle: { fontWeight: 'bold' },
        }}
      />
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
        {/* User preview header */}
        <View style={styles.userCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(user?.displayName || 'U')[0].toUpperCase()}
            </Text>
          </View>
          <View style={styles.userDetails}>
            <Text style={styles.displayName}>{user?.displayName}</Text>
            <Text style={styles.virtualNumber}>
              {user?.virtualNumber || '+888-0000-0000'}
            </Text>
            {user?.username && (
              <Text style={styles.username}>@{user.username}</Text>
            )}
          </View>
        </View>

        {/* Privacy & Identity */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>PRIVACY & SECURITY</Text>

          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <Shield size={20} color={Colors.light.primary} />
              <View style={styles.rowTextContainer}>
                <Text style={styles.rowText}>Show Virtual Mobile Number</Text>
                <Text style={styles.rowSubtext}>Display +888 number on profile & chats</Text>
              </View>
            </View>
            <Switch
              value={user?.showVirtualNumber ?? true}
              onValueChange={(val) => updateUser({ showVirtualNumber: val })}
              trackColor={{ false: '#CBD5E1', true: Colors.light.primary }}
            />
          </View>

          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <Cloud size={20} color={Colors.light.primary} />
              <View style={styles.rowTextContainer}>
                <Text style={styles.rowText}>Cloud Text Sync</Text>
                <Text style={styles.rowSubtext}>Sync encrypted messages across devices</Text>
              </View>
            </View>
            <Switch
              value={user?.cloudSyncEnabled ?? false}
              onValueChange={(val) => updateUser({ cloudSyncEnabled: val })}
              trackColor={{ false: '#CBD5E1', true: Colors.light.primary }}
            />
          </View>

          <View style={[styles.row, { borderBottomWidth: 0 }]}>
            <View style={styles.rowLeft}>
              <Lock size={20} color="#16A34A" />
              <View style={styles.rowTextContainer}>
                <Text style={styles.rowText}>End-to-End Encryption</Text>
                <Text style={styles.rowSubtext}>All 1-on-1 messages & calls secured</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Storage & Data */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>STORAGE & DATA</Text>

          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <HardDrive size={20} color="#6366F1" />
              <View style={styles.rowTextContainer}>
                <Text style={styles.rowText}>Stored Messages</Text>
                <Text style={styles.rowSubtext}>{messageCount} messages in local database</Text>
              </View>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.row, { borderBottomWidth: 0 }]}
            activeOpacity={0.7}
            onPress={handleClearCache}
          >
            <View style={styles.rowLeft}>
              <Trash2 size={20} color="#DC2626" />
              <View style={styles.rowTextContainer}>
                <Text style={[styles.rowText, { color: '#DC2626' }]}>
                  Optimize Storage Cache
                </Text>
                <Text style={styles.rowSubtext}>Clean temporary files & index DB</Text>
              </View>
            </View>
            <ChevronRight size={18} color={Colors.light.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Bookmarks */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>BOOKMARKS</Text>

          <TouchableOpacity
            style={[styles.row, { borderBottomWidth: 0 }]}
            activeOpacity={0.7}
            onPress={() => router.push('/starred-messages')}
          >
            <View style={styles.rowLeft}>
              <Star size={20} color="#F59E0B" />
              <View style={styles.rowTextContainer}>
                <Text style={styles.rowText}>Starred Messages</Text>
                <Text style={styles.rowSubtext}>View all pinned & bookmarked notes</Text>
              </View>
            </View>
            <ChevronRight size={18} color={Colors.light.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* About App */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>ABOUT</Text>

          <View style={[styles.row, { borderBottomWidth: 0 }]}>
            <View style={styles.rowLeft}>
              <Info size={20} color={Colors.light.primary} />
              <View style={styles.rowTextContainer}>
                <Text style={styles.rowText}>Qwink App Version</Text>
                <Text style={styles.rowSubtext}>v0.2.1 (Build 2026.09)</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Log Out */}
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
          activeOpacity={0.8}
        >
          <LogOut size={20} color={Colors.light.error} />
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0F2F5',
  },
  contentContainer: {
    paddingVertical: 16,
    paddingBottom: 36,
  },
  userCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: Colors.light.headerBackground,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: 'bold',
  },
  userDetails: {
    marginLeft: 14,
    flex: 1,
  },
  displayName: {
    fontSize: 17,
    fontWeight: 'bold',
    color: Colors.light.textPrimary,
  },
  virtualNumber: {
    fontSize: 13,
    color: Colors.light.primary,
    fontWeight: '600',
    marginTop: 2,
  },
  username: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: 'bold',
    color: Colors.light.textSecondary,
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 11,
    borderBottomWidth: 0.5,
    borderBottomColor: '#F1F5F9',
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  rowTextContainer: {
    marginLeft: 12,
    flex: 1,
  },
  rowText: {
    fontSize: 15,
    fontWeight: '500',
    color: Colors.light.textPrimary,
  },
  rowSubtext: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    marginTop: 1,
  },
  logoutButton: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginHorizontal: 16,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FEE2E2',
    marginTop: 8,
  },
  logoutText: {
    color: Colors.light.error,
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
});
