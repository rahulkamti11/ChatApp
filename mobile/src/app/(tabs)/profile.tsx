import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  User,
  Edit2,
  Bookmark,
  Star,
  Settings as SettingsIcon,
  LogOut,
  ChevronRight,
  Shield,
  Smile,
  Check,
} from 'lucide-react-native';
import { useAuthStore } from '../../store/auth';
import { socketService } from '../../services/socket';
import { Colors } from '../../theme/colors';

const STATUS_PRESETS = [
  '✨ Available',
  '⚡ Busy',
  '💼 At work',
  '🔋 Battery about to die',
  '🎧 In a call',
  '✈️ Traveling',
  '😴 Sleeping',
  '🚀 Coding with Qwink',
];

export default function ProfileScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const updateUser = useAuthStore((state) => state.updateUser);
  const logout = useAuthStore((state) => state.logout);

  const [isEditNameModalVisible, setIsEditNameModalVisible] = useState(false);
  const [newDisplayName, setNewDisplayName] = useState(user?.displayName || '');

  const [isEditBioModalVisible, setIsEditBioModalVisible] = useState(false);
  const [newBio, setNewBio] = useState(user?.statusBio || 'Hey there! I am using Qwink.');

  const handleSaveDisplayName = () => {
    if (!newDisplayName.trim()) {
      Alert.alert('Invalid Name', 'Display name cannot be empty.');
      return;
    }
    updateUser({ displayName: newDisplayName.trim() });
    setIsEditNameModalVisible(false);
  };

  const handleSaveBio = (bioText: string) => {
    updateUser({ statusBio: bioText.trim() });
    setIsEditBioModalVisible(false);
  };

  const handleSelectPreset = (preset: string) => {
    updateUser({ statusBio: preset });
  };

  const handleOpenSelfChat = () => {
    if (!user) return;
    const selfConvId = `conv_self_${user.id}`;
    router.push({
      pathname: '/chat/[id]',
      params: {
        id: selfConvId,
        otherUserId: user.id,
        otherDisplayName: 'Saved Messages (You)',
      },
    });
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
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Profile Header Card */}
      <View style={styles.profileHeaderCard}>
        <View style={styles.avatarWrapper}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(user?.displayName || 'U')[0].toUpperCase()}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.nameRow}
          onPress={() => {
            setNewDisplayName(user?.displayName || '');
            setIsEditNameModalVisible(true);
          }}
          activeOpacity={0.7}
        >
          <Text style={styles.displayName}>{user?.displayName || 'User'}</Text>
          <Edit2 size={16} color={Colors.light.primary} style={styles.editIcon} />
        </TouchableOpacity>

        <View style={styles.virtualNumberBadge}>
          <Shield size={14} color="#16A34A" />
          <Text style={styles.virtualNumberText}>
            {user?.virtualNumber || '+888-0000-0000'}
          </Text>
        </View>

        {user?.username && (
          <Text style={styles.usernameText}>@{user.username}</Text>
        )}
      </View>

      {/* Bio / Status / About Section */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>ABOUT / STATUS</Text>
          <TouchableOpacity
            onPress={() => {
              setNewBio(user?.statusBio || 'Hey there! I am using Qwink.');
              setIsEditBioModalVisible(true);
            }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Edit2 size={16} color={Colors.light.primary} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.bioTextContainer}
          activeOpacity={0.7}
          onPress={() => {
            setNewBio(user?.statusBio || 'Hey there! I am using Qwink.');
            setIsEditBioModalVisible(true);
          }}
        >
          <Smile size={20} color={Colors.light.primary} style={{ marginRight: 10 }} />
          <Text style={styles.bioText}>
            {user?.statusBio || 'Hey there! I am using Qwink.'}
          </Text>
        </TouchableOpacity>

        {/* Quick Status Chips */}
        <Text style={styles.presetLabel}>Quick Presets</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.presetsScrollView}
        >
          {STATUS_PRESETS.map((preset) => {
            const isSelected = user?.statusBio === preset;
            return (
              <TouchableOpacity
                key={preset}
                style={[styles.presetChip, isSelected && styles.presetChipActive]}
                onPress={() => handleSelectPreset(preset)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.presetChipText,
                    isSelected && styles.presetChipTextActive,
                  ]}
                >
                  {preset}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Quick Shortcuts */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>QUICK ACTIONS</Text>

        {/* Saved Messages / Notes to Self */}
        <TouchableOpacity
          style={styles.actionRow}
          activeOpacity={0.7}
          onPress={handleOpenSelfChat}
        >
          <View style={[styles.iconSquare, { backgroundColor: '#E0F2FE' }]}>
            <Bookmark size={20} color="#0284C7" />
          </View>
          <View style={styles.actionContent}>
            <Text style={styles.actionTitle}>Saved Messages</Text>
            <Text style={styles.actionSubtitle}>Your personal notes & media cloud</Text>
          </View>
          <ChevronRight size={18} color={Colors.light.textSecondary} />
        </TouchableOpacity>

        {/* Starred Messages */}
        <TouchableOpacity
          style={styles.actionRow}
          activeOpacity={0.7}
          onPress={() => router.push('/starred-messages')}
        >
          <View style={[styles.iconSquare, { backgroundColor: '#FEF3C7' }]}>
            <Star size={20} color="#D97706" />
          </View>
          <View style={styles.actionContent}>
            <Text style={styles.actionTitle}>Starred Messages</Text>
            <Text style={styles.actionSubtitle}>Bookmarked messages from chats</Text>
          </View>
          <ChevronRight size={18} color={Colors.light.textSecondary} />
        </TouchableOpacity>

        {/* App Settings */}
        <TouchableOpacity
          style={[styles.actionRow, { borderBottomWidth: 0 }]}
          activeOpacity={0.7}
          onPress={() => router.push('/settings')}
        >
          <View style={[styles.iconSquare, { backgroundColor: '#F3E8FF' }]}>
            <SettingsIcon size={20} color="#9333EA" />
          </View>
          <View style={styles.actionContent}>
            <Text style={styles.actionTitle}>Settings</Text>
            <Text style={styles.actionSubtitle}>Privacy, Sync, and App info</Text>
          </View>
          <ChevronRight size={18} color={Colors.light.textSecondary} />
        </TouchableOpacity>
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

      <Text style={styles.versionFooter}>Qwink v0.2.1 • End-to-End Private</Text>

      {/* Edit Display Name Modal */}
      <Modal visible={isEditNameModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalHeading}>Edit Your Name</Text>
            <TextInput
              style={styles.modalInput}
              value={newDisplayName}
              onChangeText={setNewDisplayName}
              placeholder="Enter your name"
              autoFocus
              maxLength={35}
            />
            <View style={styles.modalButtonRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setIsEditNameModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSaveBtn}
                onPress={handleSaveDisplayName}
              >
                <Text style={styles.modalSaveText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Bio Modal */}
      <Modal visible={isEditBioModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalHeading}>Edit Status / Bio</Text>
            <TextInput
              style={[styles.modalInput, styles.modalBioInput]}
              value={newBio}
              onChangeText={setNewBio}
              placeholder="What's on your mind?"
              multiline
              numberOfLines={3}
              maxLength={120}
              autoFocus
            />
            <View style={styles.modalButtonRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setIsEditBioModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSaveBtn}
                onPress={() => handleSaveBio(newBio)}
              >
                <Text style={styles.modalSaveText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0F2F5',
  },
  contentContainer: {
    paddingBottom: 30,
  },
  profileHeaderCard: {
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
    marginBottom: 16,
  },
  avatarWrapper: {
    position: 'relative',
    marginBottom: 12,
  },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: Colors.light.headerBackground,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 34,
    fontWeight: 'bold',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  displayName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: Colors.light.textPrimary,
  },
  editIcon: {
    marginLeft: 8,
  },
  virtualNumberBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 8,
  },
  virtualNumberText: {
    fontSize: 13,
    color: '#15803D',
    fontWeight: '700',
    marginLeft: 6,
    letterSpacing: 0.5,
  },
  usernameText: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    marginTop: 6,
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: Colors.light.textSecondary,
    letterSpacing: 0.8,
  },
  bioTextContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  bioText: {
    flex: 1,
    fontSize: 15,
    color: Colors.light.textPrimary,
    lineHeight: 20,
  },
  presetLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.light.textSecondary,
    marginTop: 14,
    marginBottom: 8,
  },
  presetsScrollView: {
    gap: 8,
    paddingVertical: 2,
  },
  presetChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  presetChipActive: {
    backgroundColor: '#E0F2FE',
    borderColor: Colors.light.primary,
  },
  presetChipText: {
    fontSize: 13,
    color: Colors.light.textPrimary,
  },
  presetChipTextActive: {
    color: Colors.light.primary,
    fontWeight: '600',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#F1F5F9',
  },
  iconSquare: {
    width: 38,
    height: 38,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  actionContent: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.light.textPrimary,
  },
  actionSubtitle: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    marginTop: 2,
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
  versionFooter: {
    textAlign: 'center',
    color: Colors.light.textSecondary,
    fontSize: 12,
    marginTop: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 360,
    elevation: 5,
  },
  modalHeading: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.light.textPrimary,
    marginBottom: 14,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#111B21',
    backgroundColor: '#F8FAFC',
    marginBottom: 16,
  },
  modalBioInput: {
    height: 80,
    textAlignVertical: 'top',
  },
  modalButtonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  modalCancelBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  modalCancelText: {
    color: Colors.light.textSecondary,
    fontWeight: '600',
    fontSize: 15,
  },
  modalSaveBtn: {
    backgroundColor: Colors.light.primary,
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 8,
  },
  modalSaveText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 15,
  },
});
