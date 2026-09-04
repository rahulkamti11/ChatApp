import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Modal,
  Alert,
  RefreshControl,
  Pressable,
} from 'react-native';
import { useRouter, useFocusEffect, useNavigation } from 'expo-router';
import {
  Search,
  Plus,
  MessageSquare,
  MoreVertical,
  Settings as SettingsIcon,
  Bookmark,
  Star,
  UserPlus,
  X,
} from 'lucide-react-native';
import { getLocalDatabase } from '../../db/client';
import { apiRequest } from '../../services/api';
import { useAuthStore } from '../../store/auth';
import { socketService } from '../../services/socket';
import { Colors } from '../../theme/colors';
import { getDirectConversationId } from '../../utils/conversation';

export default function ChatsScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const token = useAuthStore((state) => state.token);
  const currentUser = useAuthStore((state) => state.user);

  const [conversations, setConversations] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [isNewChatModalVisible, setIsNewChatModalVisible] = useState(false);
  const [searchUserInput, setSearchUserInput] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Setup custom top-right header buttons in tab screen
  useEffect(() => {
    navigation.setOptions({
      headerTitle: isSearchActive ? '' : 'Qwink',
      headerRight: () => (
        <View style={styles.headerRightContainer}>
          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={() => {
              setIsSearchActive((prev) => !prev);
              if (isSearchActive) setSearchQuery('');
            }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            {isSearchActive ? (
              <X color="#FFFFFF" size={22} />
            ) : (
              <Search color="#FFFFFF" size={22} />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={() => setIsMenuVisible(true)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <MoreVertical color="#FFFFFF" size={22} />
          </TouchableOpacity>
        </View>
      ),
    });
  }, [navigation, isSearchActive]);

  useFocusEffect(
    useCallback(() => {
      loadLocalConversations();
    }, [])
  );

  useEffect(() => {
    loadLocalConversations();

    const unsubMsg = socketService.on('message_received', () => {
      loadLocalConversations();
    });

    const unsubReceipt = socketService.on('delivery_receipt', () => {
      loadLocalConversations();
    });

    const unsubEdited = socketService.on('message_edited', () => {
      loadLocalConversations();
    });

    const unsubDeleted = socketService.on('message_deleted', () => {
      loadLocalConversations();
    });

    const unsubOutbox = socketService.on('outbox_flushed', () => {
      loadLocalConversations();
    });

    return () => {
      unsubMsg();
      unsubReceipt();
      unsubEdited();
      unsubDeleted();
      unsubOutbox();
    };
  }, []);

  // Resilient & self-healing conversation loader
  const loadLocalConversations = async () => {
    try {
      const db = await getLocalDatabase();
      let rows: any[] = await db.getAllAsync(
        'SELECT * FROM local_conversations ORDER BY COALESCE(last_message_at, updated_at, "") DESC'
      );

      // Self-healing: Check if any orphaned message conversations exist in local_messages
      try {
        const messageThreads: any[] = await db.getAllAsync(
          'SELECT conversation_id, MAX(created_at) as max_at, content as latest_content FROM local_messages GROUP BY conversation_id'
        );

        if (messageThreads && messageThreads.length > 0) {
          const existingIds = new Set(rows.map((r) => r.id));
          let healed = false;

          for (const thread of messageThreads) {
            if (!existingIds.has(thread.conversation_id)) {
              if (currentUser && (thread.conversation_id === `conv_self_${currentUser.id}` || thread.conversation_id.includes(currentUser.id))) {
                const isSelf = thread.conversation_id === `conv_self_${currentUser.id}`;
                const otherId = isSelf
                  ? currentUser.id
                  : thread.conversation_id.replace('conv_', '').split('_').find((p: string) => p !== currentUser.id);

                const otherName = isSelf ? 'Saved Messages (You)' : otherId || 'Chat';

                await db.runAsync(
                  `INSERT OR IGNORE INTO local_conversations (
                    id, type, other_user_id, other_display_name, last_message_preview, last_message_at, unread_count, updated_at
                  ) VALUES (?, 'direct', ?, ?, ?, ?, 0, datetime('now'))`,
                  [thread.conversation_id, otherId, otherName, thread.latest_content, thread.max_at]
                );
                healed = true;
              }
            }
          }

          if (healed) {
            rows = await db.getAllAsync(
              'SELECT * FROM local_conversations ORDER BY COALESCE(last_message_at, updated_at, "") DESC'
            );
          }
        }
      } catch (selfHealErr) {}

      try {
        if (currentUser) {
          const corruptedRows: any[] = await db.getAllAsync(
            `SELECT id FROM local_conversations WHERE other_user_id = ? AND id != ?`,
            [currentUser.id, `conv_self_${currentUser.id}`]
          );
          let needsReload = false;
          for (const row of corruptedRows) {
            const correctOtherId = row.id.replace('conv_', '').split('_').find((p: string) => p !== currentUser.id);
            if (correctOtherId) {
              await db.runAsync(
                `UPDATE local_conversations SET other_user_id = ? WHERE id = ?`,
                [correctOtherId, row.id]
              );
              needsReload = true;
            }
          }
          if (needsReload) {
            rows = await db.getAllAsync(
              'SELECT * FROM local_conversations ORDER BY COALESCE(last_message_at, updated_at, "") DESC'
            );
          }
        }
      } catch (e) {}

      setConversations(rows);
    } catch (err) {
      console.error('[SQLite] Failed to load local conversations:', err);
    } finally {
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadLocalConversations();
  };

  const handleOpenSelfChat = async () => {
    if (!currentUser) return;
    setIsMenuVisible(false);
    const selfConvId = `conv_self_${currentUser.id}`;

    const db = await getLocalDatabase();
    await db.runAsync(
      `INSERT OR IGNORE INTO local_conversations (
        id, type, other_user_id, other_display_name, unread_count, updated_at
      ) VALUES (?, 'direct', ?, ?, 0, datetime('now'))`,
      [selfConvId, currentUser.id, 'Saved Messages (You)']
    );

    await loadLocalConversations();

    router.push({
      pathname: '/chat/[id]',
      params: {
        id: selfConvId,
        otherUserId: currentUser.id,
        otherDisplayName: 'Saved Messages (You)',
      },
    });
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
    if (!currentUser) return;
    setIsNewChatModalVisible(false);

    // If starting chat with self
    if (targetUser.id === currentUser.id) {
      handleOpenSelfChat();
      return;
    }

    const convId = getDirectConversationId(currentUser.id, targetUser.id);
    const db = await getLocalDatabase();
    
    const existing: any = await db.getFirstAsync(
      `SELECT * FROM local_conversations WHERE id = ?`,
      [convId]
    );

    if (!existing) {
      await db.runAsync(
        `INSERT INTO local_conversations (
          id, type, other_user_id, other_display_name, other_username, other_avatar_url, unread_count, updated_at
        ) VALUES (?, 'direct', ?, ?, ?, ?, 0, datetime('now'))`,
        [convId, targetUser.id, targetUser.displayName, targetUser.username, targetUser.avatarUrl]
      );
    } else {
      await db.runAsync(
        `UPDATE local_conversations SET
          other_display_name = ?,
          other_username = ?,
          other_avatar_url = ?
        WHERE id = ?`,
        [targetUser.displayName, targetUser.username, targetUser.avatarUrl, convId]
      );
    }

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

  const filteredConversations = conversations.filter((c) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (c.other_display_name && c.other_display_name.toLowerCase().includes(q)) ||
      (c.other_username && c.other_username.toLowerCase().includes(q)) ||
      (c.last_message_preview && c.last_message_preview.toLowerCase().includes(q))
    );
  });

  return (
    <View style={styles.container}>
      {/* Expandable Search Bar */}
      {isSearchActive && (
        <View style={styles.searchBarContainer}>
          <Search color={Colors.light.textSecondary} size={18} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search chats, contacts, notes..."
            placeholderTextColor={Colors.light.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={16} color={Colors.light.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Conversations List */}
      {filteredConversations.length === 0 ? (
        <View style={styles.emptyContainer}>
          <MessageSquare size={64} color="#CBD5E1" />
          <Text style={styles.emptyTitle}>
            {searchQuery ? 'No matching chats found' : 'No messages yet'}
          </Text>
          <Text style={styles.emptySubtitle}>
            {searchQuery
              ? 'Try searching with a different name or keyword.'
              : 'Tap the + button below or open the menu to start chatting with contacts or write notes to yourself!'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredConversations}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[Colors.light.primary]}
              tintColor={Colors.light.primary}
            />
          }
          renderItem={({ item }) => {
            const isSelf =
              item.id.startsWith('conv_self_') ||
              (currentUser && item.other_user_id === currentUser.id);

            return (
              <TouchableOpacity
                style={styles.chatRow}
                activeOpacity={0.7}
                onPress={() =>
                  router.push({
                    pathname: '/chat/[id]',
                    params: {
                      id: item.id,
                      otherUserId: item.other_user_id,
                      otherDisplayName: isSelf
                        ? 'Saved Messages (You)'
                        : item.other_display_name,
                    },
                  })
                }
              >
                <View
                  style={[
                    styles.avatar,
                    isSelf && { backgroundColor: '#0284C7' },
                  ]}
                >
                  {isSelf ? (
                    <Bookmark size={22} color="#FFFFFF" />
                  ) : (
                    <Text style={styles.avatarText}>
                      {(item.other_display_name || 'U')[0].toUpperCase()}
                    </Text>
                  )}
                </View>

                <View style={styles.chatDetails}>
                  <View style={styles.chatHeader}>
                    <Text style={styles.chatName}>
                      {isSelf ? 'Saved Messages' : item.other_display_name}
                      {isSelf && <Text style={styles.selfBadge}> (You)</Text>}
                    </Text>
                    {item.last_message_at && (
                      <Text
                        style={[
                          styles.chatTime,
                          item.unread_count > 0 && styles.chatTimeActive,
                        ]}
                      >
                        {new Date(item.last_message_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </Text>
                    )}
                  </View>

                  <View style={styles.chatFooterRow}>
                    <Text
                      style={[
                        styles.lastMessage,
                        item.unread_count > 0 && styles.lastMessageUnread,
                      ]}
                      numberOfLines={1}
                    >
                      {item.last_message_preview ||
                        (isSelf ? 'Notes to self & personal cloud' : 'Tap to start conversation')}
                    </Text>

                    {item.unread_count > 0 && (
                      <View style={styles.unreadBadge}>
                        <Text style={styles.unreadBadgeText}>
                          {item.unread_count > 99 ? '99+' : item.unread_count}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}

      {/* Floating Action Button */}
      <TouchableOpacity
        style={styles.fab}
        activeOpacity={0.8}
        onPress={() => setIsNewChatModalVisible(true)}
      >
        <Plus color="#FFFFFF" size={26} />
      </TouchableOpacity>

      {/* Top Right Hamburger / 3-Dot Dropdown Menu */}
      <Modal visible={isMenuVisible} transparent animationType="fade">
        <Pressable
          style={styles.menuOverlay}
          onPress={() => setIsMenuVisible(false)}
        >
          <View style={styles.menuCard}>
            {/* New Chat */}
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setIsMenuVisible(false);
                setIsNewChatModalVisible(true);
              }}
            >
              <UserPlus size={18} color={Colors.light.primary} />
              <Text style={styles.menuItemText}>New Chat</Text>
            </TouchableOpacity>

            {/* Saved Messages / Notes to Self */}
            <TouchableOpacity
              style={styles.menuItem}
              onPress={handleOpenSelfChat}
            >
              <Bookmark size={18} color="#0284C7" />
              <Text style={styles.menuItemText}>Saved Messages (Notes)</Text>
            </TouchableOpacity>

            {/* Starred Messages */}
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setIsMenuVisible(false);
                router.push('/starred-messages');
              }}
            >
              <Star size={18} color="#D97706" />
              <Text style={styles.menuItemText}>Starred Messages</Text>
            </TouchableOpacity>

            <View style={styles.menuDivider} />

            {/* Settings */}
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setIsMenuVisible(false);
                router.push('/settings');
              }}
            >
              <SettingsIcon size={18} color={Colors.light.textPrimary} />
              <Text style={styles.menuItemText}>Settings</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* New Chat / Find Contact Modal */}
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
                autoFocus
              />
              <TouchableOpacity
                style={styles.modalSearchBtn}
                onPress={handleSearchUser}
                disabled={searching}
              >
                <Text style={styles.modalSearchBtnText}>
                  {searching ? '...' : 'Search'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Quick Option: Message Yourself */}
            <TouchableOpacity
              style={styles.selfNoteRow}
              onPress={() => {
                setIsNewChatModalVisible(false);
                handleOpenSelfChat();
              }}
            >
              <View style={styles.selfNoteAvatar}>
                <Bookmark size={18} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.selfNoteTitle}>Message Yourself (Notes)</Text>
                <Text style={styles.selfNoteSub}>Save messages, links & media</Text>
              </View>
            </TouchableOpacity>

            <FlatList
              data={searchResults}
              keyExtractor={(u) => u.id}
              style={{ maxHeight: 200, marginTop: 8 }}
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
  headerRightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
  headerIconBtn: {
    padding: 8,
    marginLeft: 4,
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F2F5',
    marginHorizontal: 12,
    marginTop: 10,
    marginBottom: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
    height: 42,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: '#111B21',
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
  selfBadge: {
    fontSize: 13,
    color: '#0284C7',
    fontWeight: 'normal',
  },
  chatTime: {
    fontSize: 12,
    color: Colors.light.textSecondary,
  },
  chatTimeActive: {
    color: Colors.light.primary,
    fontWeight: '600',
  },
  chatFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lastMessage: {
    flex: 1,
    fontSize: 14,
    color: Colors.light.textSecondary,
    marginRight: 8,
  },
  lastMessageUnread: {
    color: Colors.light.textPrimary,
    fontWeight: '600',
  },
  unreadBadge: {
    backgroundColor: '#25D366',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  unreadBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold',
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
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.2)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 56,
    paddingRight: 16,
  },
  menuCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 6,
    width: 210,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  menuItemText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.light.textPrimary,
    marginLeft: 12,
  },
  menuDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 4,
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
    color: '#111B21',
    backgroundColor: '#FFFFFF',
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
  selfNoteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F9FF',
    padding: 10,
    borderRadius: 8,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  selfNoteAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#0284C7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  selfNoteTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#0369A1',
  },
  selfNoteSub: {
    fontSize: 11,
    color: '#0284C7',
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
