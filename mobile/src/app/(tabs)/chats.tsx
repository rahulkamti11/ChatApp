import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Modal,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Search, Plus, MessageSquare } from 'lucide-react-native';
import { getLocalDatabase } from '../../db/client';
import { apiRequest } from '../../services/api';
import { useAuthStore } from '../../store/auth';
import { Colors } from '../../theme/colors';

export default function ChatsScreen() {
  const router = useRouter();
  const token = useAuthStore((state) => state.token);
  const currentUser = useAuthStore((state) => state.user);

  const [conversations, setConversations] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isNewChatModalVisible, setIsNewChatModalVisible] = useState(false);
  const [searchUserInput, setSearchUserInput] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    loadLocalConversations();
  }, []);

  const loadLocalConversations = async () => {
    try {
      const db = await getLocalDatabase();
      const rows = await db.getAllAsync(
        'SELECT * FROM local_conversations ORDER BY last_message_at DESC'
      );
      setConversations(rows);
    } catch (err) {
      console.error('[SQLite] Failed to load local conversations:', err);
    }
  };

  const handleSearchUser = async () => {
    if (!searchUserInput.trim()) return;
    setSearching(true);
    try {
      const data = await apiRequest(`/api/user/search?q=${encodeURIComponent(searchUserInput.trim())}`, {}, token);
      setSearchResults(data.users || []);
    } catch (err: any) {
      Alert.alert('Search Error', err.message || 'Failed to search users');
    } finally {
      setSearching(false);
    }
  };

  const handleStartChat = async (targetUser: any) => {
    setIsNewChatModalVisible(false);
    const convId = `conv_${targetUser.id}`;
    
    const db = await getLocalDatabase();
    await db.runAsync(
      `INSERT OR REPLACE INTO local_conversations (
        id, type, other_user_id, other_display_name, other_username, other_avatar_url, updated_at
      ) VALUES (?, 'direct', ?, ?, ?, ?, datetime('now'))`,
      [convId, targetUser.id, targetUser.displayName, targetUser.username, targetUser.avatarUrl]
    );

    await loadLocalConversations();
    router.push({
      pathname: '/chat/[id]',
      params: {
        id: convId,
        otherUserId: targetUser.id,
        otherDisplayName: targetUser.displayName,
      },
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.searchBarContainer}>
        <Search color={Colors.light.textSecondary} size={18} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search chats or messages..."
          placeholderTextColor={Colors.light.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {conversations.length === 0 ? (
        <View style={styles.emptyContainer}>
          <MessageSquare size={64} color="#CBD5E1" />
          <Text style={styles.emptyTitle}>No messages yet</Text>
          <Text style={styles.emptySubtitle}>
            Tap the + button below to find a contact by @username or virtual number and start chatting!
          </Text>
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.chatRow}
              activeOpacity={0.7}
              onPress={() =>
                router.push({
                  pathname: '/chat/[id]',
                  params: {
                    id: item.id,
                    otherUserId: item.other_user_id,
                    otherDisplayName: item.other_display_name,
                  },
                })
              }
            >
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {(item.other_display_name || 'U')[0].toUpperCase()}
                </Text>
              </View>
              <View style={styles.chatDetails}>
                <View style={styles.chatHeader}>
                  <Text style={styles.chatName}>{item.other_display_name}</Text>
                  {item.last_message_at && (
                    <Text style={styles.chatTime}>
                      {new Date(item.last_message_at).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Text>
                  )}
                </View>
                <Text style={styles.lastMessage} numberOfLines={1}>
                  {item.last_message_preview || 'Tap to start conversation'}
                </Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}

      <TouchableOpacity
        style={styles.fab}
        activeOpacity={0.8}
        onPress={() => setIsNewChatModalVisible(true)}
      >
        <Plus color="#FFFFFF" size={26} />
      </TouchableOpacity>

      <Modal visible={isNewChatModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Find Contact</Text>
            <Text style={styles.modalSubtitle}>
              Search by @username or Virtual Mobile Number (+888-XXXX-XXXX)
            </Text>

            <View style={styles.modalSearchRow}>
              <TextInput
                style={styles.modalInput}
                placeholder="Enter @username or +888..."
                placeholderTextColor={Colors.light.textSecondary}
                value={searchUserInput}
                onChangeText={setSearchUserInput}
              />
              <TouchableOpacity style={styles.modalSearchBtn} onPress={handleSearchUser}>
                <Text style={styles.modalSearchBtnText}>Search</Text>
              </TouchableOpacity>
            </View>

            <FlatList
              data={searchResults}
              keyExtractor={(u) => u.id}
              style={{ maxHeight: 200, marginTop: 12 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.searchUserItem}
                  onPress={() => handleStartChat(item)}
                >
                  <Text style={styles.searchUserItemName}>{item.displayName}</Text>
                  <Text style={styles.searchUserItemSub}>
                    {item.username ? `@${item.username}` : item.virtualNumber || ''}
                  </Text>
                </TouchableOpacity>
              )}
            />

            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => setIsNewChatModalVisible(false)}
            >
              <Text style={styles.modalCloseBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F2F5',
    margin: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    height: 40,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: Colors.light.textPrimary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.light.textPrimary,
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  chatRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.light.border,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.light.headerBackground,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  chatDetails: {
    flex: 1,
    marginLeft: 12,
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  chatName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.textPrimary,
  },
  chatTime: {
    fontSize: 12,
    color: Colors.light.textSecondary,
  },
  lastMessage: {
    fontSize: 14,
    color: Colors.light.textSecondary,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.light.primary,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.light.textPrimary,
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    marginBottom: 16,
  },
  modalSearchRow: {
    flexDirection: 'row',
  },
  modalInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 44,
    fontSize: 14,
  },
  modalSearchBtn: {
    backgroundColor: Colors.light.primary,
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderRadius: 8,
    marginLeft: 8,
  },
  modalSearchBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  searchUserItem: {
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.light.border,
  },
  searchUserItemName: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.light.textPrimary,
  },
  searchUserItemSub: {
    fontSize: 12,
    color: Colors.light.textSecondary,
  },
  modalCloseBtn: {
    marginTop: 16,
    alignItems: 'center',
    paddingVertical: 10,
  },
  modalCloseBtnText: {
    color: Colors.light.error,
    fontWeight: '600',
  },
});
