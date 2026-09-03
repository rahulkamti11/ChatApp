import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from 'react-native';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Send, Check, CheckCheck, Clock, Star, X } from 'lucide-react-native';
import {
  getMessagesForConversation,
  insertLocalMessage,
  updateMessageStatus,
  editLocalMessage,
  deleteLocalMessage,
  updateMessageReaction,
  toggleStarMessage,
  resetConversationUnread,
} from '../../db/queries/messages';
import { getLocalDatabase } from '../../db/client';
import { socketService } from '../../services/socket';
import { apiRequest } from '../../services/api';
import { flushOutbox } from '../../services/outbox';
import { useAuthStore } from '../../store/auth';
import { Colors } from '../../theme/colors';
import { ReplyPreviewBar } from '../../components/chat/ReplyPreviewBar';
import { MessageActionModal } from '../../components/chat/MessageActionModal';
import { SwipeableMessageBubble } from '../../components/chat/SwipeableMessageBubble';

function generateMessageId(): string {
  return 'msg_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 10);
}

export default function ChatRoomScreen() {
  const insets = useSafeAreaInsets();
  const { id: rawConversationId, otherUserId: paramOtherUserId, otherDisplayName: paramOtherDisplayName } = useLocalSearchParams<{
    id: string;
    otherUserId: string;
    otherDisplayName: string;
  }>();

  const conversationId = rawConversationId as string;
  const navigation = useNavigation();
  const currentUser = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);

  // Fallback otherUserId resolution if route param is missing
  const [resolvedOtherUserId, setResolvedOtherUserId] = useState<string>(paramOtherUserId || '');
  const [resolvedDisplayName, setResolvedDisplayName] = useState<string>(paramOtherDisplayName || 'Chat');

  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [presenceText, setPresenceText] = useState<string>('');
  
  // Phase 3 Interaction States
  const [replyMessage, setReplyMessage] = useState<any | null>(null);
  const [editingMessage, setEditingMessage] = useState<any | null>(null);
  const [selectedActionMessage, setSelectedActionMessage] = useState<any | null>(null);
  const [isActionModalVisible, setIsActionModalVisible] = useState(false);

  const flatListRef = useRef<FlatList>(null);
  const typingTimeoutRef = useRef<any>(null);
  const lastTypingSentRef = useRef<number>(0);

  // Resolve otherUserId and otherDisplayName reliably from conversationId or SQLite
  useEffect(() => {
    async function resolveContact() {
      let targetUserId = paramOtherUserId;
      let targetName = paramOtherDisplayName;

      if (!targetUserId && conversationId && currentUser) {
        // Extract from conv_userIdA_userIdB
        const parts = conversationId.replace('conv_', '').split('_');
        targetUserId = parts.find((p) => p !== currentUser.id) || '';
      }

      if (conversationId) {
        try {
          const db = await getLocalDatabase();
          const convRow: any = await db.getFirstAsync(
            'SELECT other_user_id, other_display_name FROM local_conversations WHERE id = ?',
            [conversationId]
          );
          if (convRow) {
            if (!targetUserId && convRow.other_user_id) {
              targetUserId = convRow.other_user_id;
            }
            if (!targetName && convRow.other_display_name) {
              targetName = convRow.other_display_name;
            }
          }
        } catch (e) {}
      }

      if (targetUserId) setResolvedOtherUserId(targetUserId);
      if (targetName) setResolvedDisplayName(targetName);
    }

    resolveContact();
  }, [conversationId, paramOtherUserId, paramOtherDisplayName, currentUser]);

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', () => setIsKeyboardVisible(true));
    const hideSub = Keyboard.addListener('keyboardDidHide', () => setIsKeyboardVisible(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Update navigation header title and dynamic subtitle
  useEffect(() => {
    let subtitle = '';
    if (isTyping) {
      subtitle = 'typing...';
    } else if (presenceText) {
      subtitle = presenceText;
    }

    navigation.setOptions({
      headerTitle: () => (
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitleText} numberOfLines={1}>
            {resolvedDisplayName || 'Chat'}
          </Text>
          {subtitle ? (
            <Text
              style={[
                styles.headerSubtitleText,
                isTyping ? styles.typingSubtitle : undefined,
              ]}
              numberOfLines={1}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>
      ),
    });
  }, [resolvedDisplayName, isTyping, presenceText]);

  const emitReadReceipt = useCallback(() => {
    if (!token || !conversationId) return;

    // 1. Reset local unread counter
    resetConversationUnread(conversationId);

    // 2. Emit WS read_receipt to sender
    const targetUserId = resolvedOtherUserId || paramOtherUserId;
    if (targetUserId) {
      socketService.send({
        event: 'read_receipt',
        conversationId,
        senderId: targetUserId,
      });

      // REST fallback
      apiRequest('/api/messages/read', {
        method: 'POST',
        body: JSON.stringify({
          conversationId,
          senderId: targetUserId,
        }),
      }, token).catch(() => {});
    }
  }, [conversationId, resolvedOtherUserId, paramOtherUserId, token]);

  const loadMessages = async () => {
    if (!conversationId) return;
    const list = await getMessagesForConversation(conversationId, 100);
    setMessages(list);
  };

  useEffect(() => {
    loadMessages();

    // 1. Ensure WebSocket connection is active
    if (token && !socketService.isConnected()) {
      socketService.connect(token);
    }

    // 2. Flush outbox
    flushOutbox(token);

    // 3. Mark messages as read immediately on entry
    emitReadReceipt();

    // 4. Query presence
    const targetUserId = resolvedOtherUserId || paramOtherUserId;
    if (targetUserId) {
      socketService.send({
        event: 'presence_query',
        targetUserId,
      });
    }

    // 5. Initial sync
    syncMissedMessages();

    // 6. Background periodic poll while active
    const pollTimer = setInterval(() => {
      syncMissedMessages();
      flushOutbox(token);
    }, 2500);

    // LISTENERS
    const unsubscribeMsg = socketService.on('message_received', (data: any) => {
      if (data.conversationId === conversationId) {
        emitReadReceipt();
        loadMessages();
      }
    });

    const unsubscribeReceipt = socketService.on('delivery_receipt', (data: any) => {
      if (data.conversationId === conversationId) {
        loadMessages();
      }
    });

    const unsubscribeTypingStart = socketService.on('typing_start', (data: any) => {
      if (data.conversationId === conversationId) {
        setIsTyping(true);
      }
    });

    const unsubscribeTypingStop = socketService.on('typing_stop', (data: any) => {
      if (data.conversationId === conversationId) {
        setIsTyping(false);
      }
    });

    const unsubscribePresence = socketService.on('user_presence', (data: any) => {
      const activeOtherId = resolvedOtherUserId || paramOtherUserId;
      if (data.userId === activeOtherId) {
        if (data.isOnline) {
          setPresenceText('Online');
        } else if (data.lastSeenAt) {
          const d = new Date(data.lastSeenAt);
          setPresenceText(`Last seen ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`);
        } else {
          setPresenceText('');
        }
      }
    });

    const unsubscribeReaction = socketService.on('message_reaction', (data: any) => {
      if (data.conversationId === conversationId) {
        loadMessages();
      }
    });

    const unsubscribeEdited = socketService.on('message_edited', (data: any) => {
      if (data.conversationId === conversationId) {
        loadMessages();
      }
    });

    const unsubscribeDeleted = socketService.on('message_deleted', (data: any) => {
      if (data.conversationId === conversationId) {
        loadMessages();
      }
    });

    const unsubscribeOutbox = socketService.on('outbox_flushed', () => {
      loadMessages();
    });

    const unsubscribeConn = socketService.on('connection_change', (data: any) => {
      if (data.status === 'connected') {
        flushOutbox(token, () => loadMessages());
      }
    });

    return () => {
      clearInterval(pollTimer);
      unsubscribeMsg();
      unsubscribeReceipt();
      unsubscribeTypingStart();
      unsubscribeTypingStop();
      unsubscribePresence();
      unsubscribeReaction();
      unsubscribeEdited();
      unsubscribeDeleted();
      unsubscribeOutbox();
      unsubscribeConn();
    };
  }, [conversationId, resolvedOtherUserId, paramOtherUserId, token, emitReadReceipt]);

  // Multi-event synchronization dispatcher
  const syncMissedMessages = async () => {
    if (!token || !conversationId) return;
    try {
      const data = await apiRequest('/api/messages/sync', {
        method: 'POST',
        body: JSON.stringify({ conversationId, lastSequence: 0 }),
      }, token);

      if (data.messages && data.messages.length > 0) {
        for (const item of data.messages) {
          if (item.event === 'message_reaction') {
            await updateMessageReaction(item.messageId, item.userId, item.emoji, item.action || 'add');
          } else if (item.event === 'message_edited') {
            await editLocalMessage(item.messageId, item.content, item.editedAt);
          } else if (item.event === 'message_deleted') {
            await deleteLocalMessage(item.messageId, item.deleteType === 'for_everyone');
          } else {
            // Standard new message
            await insertLocalMessage({
              id: item.id,
              conversationId: item.conversationId,
              senderId: item.senderId,
              sequence: item.sequence,
              type: item.type || 'text',
              content: item.content,
              mediaUrl: item.mediaUrl,
              replyToId: item.replyToId,
              status: 'delivered',
              createdAt: item.createdAt,
              isIncoming: true,
            });
          }

          // Send ACK to remove processed item from pending_messages
          socketService.send({
            event: 'ack',
            messageId: item.id || item.messageId,
            conversationId: item.conversationId,
            senderId: item.senderId || item.userId,
          });
        }
        emitReadReceipt();
        loadMessages();
      }
    } catch (e) {
      // Silent sync catch
    }
  };

  // Debounced Typing Dispatcher
  const handleInputChange = (text: string) => {
    setInputText(text);

    const targetUserId = resolvedOtherUserId || paramOtherUserId;
    if (!targetUserId || !conversationId) return;

    const now = Date.now();
    if (now - lastTypingSentRef.current > 2000) {
      lastTypingSentRef.current = now;
      socketService.send({
        event: 'typing_start',
        conversationId,
        recipientId: targetUserId,
      });
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      socketService.send({
        event: 'typing_stop',
        conversationId,
        recipientId: targetUserId,
      });
    }, 1500);
  };

  const handleSendMessage = async () => {
    if (!inputText.trim() || !currentUser || !conversationId) return;

    const textToSend = inputText.trim();
    const targetUserId = resolvedOtherUserId || paramOtherUserId;

    // 1. IF EDITING EXISTING MESSAGE
    if (editingMessage) {
      const editedAt = new Date().toISOString();
      await editLocalMessage(editingMessage.id, textToSend, editedAt);
      setInputText('');
      setEditingMessage(null);
      await loadMessages();

      socketService.send({
        event: 'edit_message',
        messageId: editingMessage.id,
        conversationId,
        recipientId: targetUserId,
        content: textToSend,
        editedAt,
      });

      apiRequest('/api/messages/edit', {
        method: 'POST',
        body: JSON.stringify({
          messageId: editingMessage.id,
          conversationId,
          recipientId: targetUserId,
          content: textToSend,
        }),
      }, token).catch(() => {});
      return;
    }

    // 2. IF SENDING A NEW MESSAGE
    const messageId = generateMessageId();
    const nextSequence = messages.length > 0 ? messages[messages.length - 1].sequence + 1 : 1;
    const createdAt = new Date().toISOString();
    const replyTargetId = replyMessage ? replyMessage.id : null;

    const newMsg = {
      id: messageId,
      conversationId,
      senderId: currentUser.id,
      sequence: nextSequence,
      type: 'text',
      content: textToSend,
      replyToId: replyTargetId,
      status: 'pending' as const,
      createdAt,
      isIncoming: false,
    };

    // Save locally
    await insertLocalMessage(newMsg);
    setInputText('');
    setReplyMessage(null);
    await loadMessages();

    // Stop typing broadcast
    if (targetUserId) {
      socketService.send({
        event: 'typing_stop',
        conversationId,
        recipientId: targetUserId,
      });
    }

    // Try WebSocket delivery
    const wsSent = socketService.send({
      event: 'send_message',
      id: messageId,
      conversationId,
      recipientId: targetUserId,
      type: 'text',
      content: textToSend,
      replyToId: replyTargetId,
    });

    if (!wsSent) {
      try {
        const res = await apiRequest('/api/messages/send', {
          method: 'POST',
          body: JSON.stringify({
            id: messageId,
            conversationId,
            recipientId: targetUserId,
            type: 'text',
            content: textToSend,
            replyToId: replyTargetId,
          }),
        }, token);

        await updateMessageStatus(messageId, res.status || 'sent');
        await loadMessages();
      } catch (err) {
        console.log('[Message API] Queued locally in SQLite');
      }
    }
  };

  // Phase 3 Actions
  const handleMessageLongPress = (item: any) => {
    setSelectedActionMessage(item);
    setIsActionModalVisible(true);
  };

  const handleReaction = async (messageId: string, emoji: string) => {
    if (!currentUser) return;
    const targetUserId = resolvedOtherUserId || paramOtherUserId;
    await updateMessageReaction(messageId, currentUser.id, emoji, 'add');
    await loadMessages();

    socketService.send({
      event: 'message_reaction',
      messageId,
      conversationId,
      recipientId: targetUserId,
      emoji,
      action: 'add',
    });

    apiRequest('/api/messages/reaction', {
      method: 'POST',
      body: JSON.stringify({
        messageId,
        conversationId,
        recipientId: targetUserId,
        emoji,
        action: 'add',
      }),
    }, token).catch(() => {});
  };

  const handleToggleReactionPill = async (messageId: string, emoji: string, userIds: string[]) => {
    if (!currentUser) return;
    const targetUserId = resolvedOtherUserId || paramOtherUserId;
    const hasMyReaction = userIds.includes(currentUser.id);
    const action = hasMyReaction ? 'remove' : 'add';

    await updateMessageReaction(messageId, currentUser.id, emoji, action);
    await loadMessages();

    socketService.send({
      event: 'message_reaction',
      messageId,
      conversationId,
      recipientId: targetUserId,
      emoji,
      action,
    });

    apiRequest('/api/messages/reaction', {
      method: 'POST',
      body: JSON.stringify({
        messageId,
        conversationId,
        recipientId: targetUserId,
        emoji,
        action,
      }),
    }, token).catch(() => {});
  };

  const handleReply = (message: any) => {
    setReplyMessage({
      id: message.id,
      sender_name: message.sender_id === currentUser?.id ? 'You' : resolvedDisplayName || 'Contact',
      content: message.content,
      isMe: message.sender_id === currentUser?.id,
    });
  };

  const handleToggleStar = async (messageId: string, isStarred: boolean) => {
    if (!conversationId) return;
    await toggleStarMessage(messageId, conversationId, isStarred);
    await loadMessages();
  };

  const handleEdit = (message: any) => {
    setEditingMessage(message);
    setInputText(message.content || '');
  };

  const handleDelete = async (messageId: string, forEveryone: boolean) => {
    const targetUserId = resolvedOtherUserId || paramOtherUserId;
    await deleteLocalMessage(messageId, forEveryone);
    await loadMessages();

    if (forEveryone) {
      socketService.send({
        event: 'delete_message',
        messageId,
        conversationId,
        recipientId: targetUserId,
        deleteType: 'for_everyone',
      });

      apiRequest('/api/messages/delete', {
        method: 'POST',
        body: JSON.stringify({
          messageId,
          conversationId,
          recipientId: targetUserId,
          deleteType: 'for_everyone',
        }),
      }, token).catch(() => {});
    }
  };

  const scrollToMessage = (msgId: string) => {
    const index = messages.findIndex((m) => m.id === msgId);
    if (index !== -1) {
      flatListRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.5 });
    }
  };

  const renderStatusIcon = (status: string) => {
    switch (status) {
      case 'read':
        return <CheckCheck size={16} color={Colors.light.checkBlue} />;
      case 'delivered':
        return <CheckCheck size={16} color={Colors.light.checkGray} />;
      case 'sent':
        return <Check size={16} color={Colors.light.checkGray} />;
      case 'pending':
        return <Clock size={13} color={Colors.light.checkGray} />;
      default:
        return <Clock size={13} color={Colors.light.checkGray} />;
    }
  };

  const renderQuotedSnippet = (replyToId: string) => {
    const quoted = messages.find((m) => m.id === replyToId);
    if (!quoted) return null;

    const isQuotedMe = quoted.sender_id === currentUser?.id;
    return (
      <TouchableOpacity
        style={styles.quotedContainer}
        activeOpacity={0.8}
        onPress={() => scrollToMessage(replyToId)}
      >
        <View style={styles.quotedAccentBar} />
        <View style={styles.quotedContent}>
          <Text style={styles.quotedAuthor}>
            {isQuotedMe ? 'You' : resolvedDisplayName || 'Contact'}
          </Text>
          <Text style={styles.quotedText} numberOfLines={1}>
            {quoted.is_deleted === 1 ? '🚫 This message was deleted' : quoted.content || '[Media]'}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderReactions = (item: any) => {
    if (!item.reactions) return null;
    let reactionsMap: Record<string, string[]> = {};
    try {
      reactionsMap = JSON.parse(item.reactions);
    } catch (e) {
      return null;
    }

    const emojis = Object.keys(reactionsMap);
    if (emojis.length === 0) return null;

    return (
      <View style={styles.reactionPillsRow}>
        {emojis.map((emoji) => {
          const userIds = reactionsMap[emoji];
          const hasMyReaction = currentUser ? userIds.includes(currentUser.id) : false;
          return (
            <TouchableOpacity
              key={emoji}
              style={[
                styles.reactionPill,
                hasMyReaction && styles.reactionPillActive,
              ]}
              activeOpacity={0.7}
              onPress={() => handleToggleReactionPill(item.id, emoji, userIds)}
            >
              <Text style={styles.reactionPillEmoji}>{emoji}</Text>
              {userIds.length > 1 && (
                <Text style={styles.reactionPillCount}>{userIds.length}</Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messageList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        renderItem={({ item }) => {
          const isMe = item.sender_id === currentUser?.id;
          const isDeleted = item.is_deleted === 1;

          return (
            <SwipeableMessageBubble
              onSwipeReply={() => handleReply(item)}
              disabled={isDeleted}
            >
              <TouchableOpacity
                activeOpacity={0.9}
                onLongPress={() => handleMessageLongPress(item)}
                style={[styles.bubbleContainer, isMe ? styles.bubbleRight : styles.bubbleLeft]}
              >
                <View style={[styles.bubble, isMe ? styles.bgSent : styles.bgReceived]}>
                  {/* 1. Quoted Message Preview if replying */}
                  {item.reply_to_id && renderQuotedSnippet(item.reply_to_id)}

                  {/* 2. Message Content */}
                  <Text
                    style={[
                      styles.messageText,
                      isMe ? styles.textSent : styles.textReceived,
                      isDeleted && styles.deletedText,
                    ]}
                  >
                    {isDeleted ? '🚫 This message was deleted' : item.content}
                  </Text>

                  {/* 3. Footer: Timestamp, Edited tag, Star, Status */}
                  <View style={styles.bubbleFooter}>
                    {item.is_starred === 1 && (
                      <Star size={11} color="#F59E0B" fill="#F59E0B" style={styles.starIcon} />
                    )}
                    {item.is_edited === 1 && !isDeleted && (
                      <Text style={styles.editedTag}>edited</Text>
                    )}
                    <Text style={styles.timestamp}>
                      {new Date(item.created_at).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Text>
                    {isMe && !isDeleted && (
                      <View style={styles.statusIcon}>{renderStatusIcon(item.status)}</View>
                    )}
                  </View>
                </View>

                {/* 4. Emoji Reaction Pills below bubble */}
                {renderReactions(item)}
              </TouchableOpacity>
            </SwipeableMessageBubble>
          );
        }}
      />

      {/* Editing Message Banner */}
      {editingMessage && (
        <View style={styles.editingBanner}>
          <View style={styles.editingBannerContent}>
            <Text style={styles.editingBannerTitle}>Editing message</Text>
            <Text style={styles.editingBannerSub} numberOfLines={1}>
              {editingMessage.content}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => {
              setEditingMessage(null);
              setInputText('');
            }}
          >
            <X size={18} color={Colors.light.textSecondary} />
          </TouchableOpacity>
        </View>
      )}

      {/* Quoted Message Preview Bar */}
      <ReplyPreviewBar replyMessage={replyMessage} onCancel={() => setReplyMessage(null)} />

      {/* Input Field */}
      <View
        style={[
          styles.inputContainer,
          {
            paddingBottom: isKeyboardVisible ? 8 : Math.max(insets.bottom, 8),
          },
        ]}
      >
        <TextInput
          style={styles.input}
          placeholder={editingMessage ? 'Edit your message...' : 'Type a message...'}
          placeholderTextColor={Colors.light.textSecondary}
          value={inputText}
          onChangeText={handleInputChange}
          multiline
        />
        <TouchableOpacity
          style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
          onPress={handleSendMessage}
          disabled={!inputText.trim()}
        >
          <Send size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Message Action Modal (Reaction dock with '+', reply, edit, star, delete) */}
      <MessageActionModal
        visible={isActionModalVisible}
        message={selectedActionMessage}
        currentUserId={currentUser?.id}
        onClose={() => setIsActionModalVisible(false)}
        onReaction={handleReaction}
        onReply={handleReply}
        onToggleStar={handleToggleStar}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.chatBackground,
  },
  headerTitleContainer: {
    justifyContent: 'center',
  },
  headerTitleText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  headerSubtitleText: {
    fontSize: 12,
    color: '#E0F2FE',
    marginTop: 1,
  },
  typingSubtitle: {
    color: '#A7F3D0',
    fontStyle: 'italic',
    fontWeight: '600',
  },
  messageList: {
    paddingHorizontal: 12,
    paddingVertical: 16,
  },
  bubbleContainer: {
    marginBottom: 10,
    maxWidth: '82%',
  },
  bubbleLeft: {
    alignSelf: 'flex-start',
  },
  bubbleRight: {
    alignSelf: 'flex-end',
  },
  bubble: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 1,
  },
  bgSent: {
    backgroundColor: Colors.light.bubbleSent,
    borderBottomRightRadius: 2,
  },
  bgReceived: {
    backgroundColor: Colors.light.bubbleReceived,
    borderBottomLeftRadius: 2,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  textSent: {
    color: Colors.light.textPrimary,
  },
  textReceived: {
    color: Colors.light.textPrimary,
  },
  deletedText: {
    fontStyle: 'italic',
    color: '#8696A0',
  },
  bubbleFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 4,
  },
  starIcon: {
    marginRight: 4,
  },
  editedTag: {
    fontSize: 10,
    color: Colors.light.textSecondary,
    fontStyle: 'italic',
    marginRight: 4,
  },
  timestamp: {
    fontSize: 10,
    color: Colors.light.textSecondary,
    marginRight: 4,
  },
  statusIcon: {
    marginLeft: 2,
  },
  quotedContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    borderRadius: 6,
    padding: 6,
    marginBottom: 6,
  },
  quotedAccentBar: {
    width: 3,
    backgroundColor: Colors.light.primary,
    borderRadius: 2,
    marginRight: 6,
  },
  quotedContent: {
    flex: 1,
  },
  quotedAuthor: {
    fontSize: 11,
    fontWeight: 'bold',
    color: Colors.light.primary,
    marginBottom: 1,
  },
  quotedText: {
    fontSize: 12,
    color: Colors.light.textSecondary,
  },
  reactionPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: -6,
    marginBottom: 2,
    paddingHorizontal: 4,
  },
  reactionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginRight: 4,
    marginTop: 2,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 1,
    borderWidth: 0.5,
    borderColor: '#E2E8F0',
  },
  reactionPillActive: {
    backgroundColor: '#E0F2FE',
    borderColor: Colors.light.primary,
  },
  reactionPillEmoji: {
    fontSize: 12,
  },
  reactionPillCount: {
    fontSize: 10,
    color: Colors.light.textSecondary,
    marginLeft: 3,
    fontWeight: 'bold',
  },
  editingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#FDE68A',
  },
  editingBannerContent: {
    flex: 1,
  },
  editingBannerTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#B45309',
  },
  editingBannerSub: {
    fontSize: 13,
    color: '#92400E',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 0.5,
    borderTopColor: Colors.light.border,
  },
  input: {
    flex: 1,
    backgroundColor: '#F0F2F5',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    fontSize: 15,
    maxHeight: 100,
    color: Colors.light.textPrimary,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.light.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
});
