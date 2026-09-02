import React, { useState, useEffect, useRef } from 'react';
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
import { Send, Check, CheckCheck, Clock } from 'lucide-react-native';
import { getMessagesForConversation, insertLocalMessage, updateMessageStatus } from '../../db/queries/messages';
import { socketService } from '../../services/socket';
import { apiRequest } from '../../services/api';
import { flushOutbox } from '../../services/outbox';
import { useAuthStore } from '../../store/auth';
import { Colors } from '../../theme/colors';

function generateMessageId(): string {
  return 'msg_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 10);
}

export default function ChatRoomScreen() {
  const insets = useSafeAreaInsets();
  const { id: conversationId, otherUserId, otherDisplayName } = useLocalSearchParams<{
    id: string;
    otherUserId: string;
    otherDisplayName: string;
  }>();

  const navigation = useNavigation();
  const currentUser = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);

  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', () => setIsKeyboardVisible(true));
    const hideSub = Keyboard.addListener('keyboardDidHide', () => setIsKeyboardVisible(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    navigation.setOptions({
      title: otherDisplayName || 'Chat',
    });

    loadMessages();

    // 1. Ensure WebSocket connection is active
    if (token && !socketService.isConnected()) {
      socketService.connect(token);
    }

    // 2. Flush any pending offline outbox messages
    flushOutbox(token);

    // 3. Mark messages as read by notifying the sender
    if (otherUserId) {
      socketService.send({
        event: 'read_receipt',
        conversationId: conversationId as string,
        senderId: otherUserId,
      });
    }

    // 4. Poll for pending/missed messages from server
    syncMissedMessages();

    // 5. Periodic background sync while chat is actively open
    const pollTimer = setInterval(() => {
      syncMissedMessages();
      flushOutbox(token);
    }, 2500);

    const unsubscribeMsg = socketService.on('message_received', (data: any) => {
      if (data.conversationId === conversationId) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === data.id)) return prev;
          const newMsg = {
            id: data.id,
            conversation_id: data.conversationId,
            sender_id: data.senderId,
            sequence: data.sequence,
            type: data.type || 'text',
            content: data.content,
            status: 'delivered',
            created_at: data.createdAt || new Date().toISOString(),
          };
          return [...prev, newMsg];
        });
        loadMessages();
      }
    });

    const unsubscribeReceipt = socketService.on('delivery_receipt', (data: any) => {
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
      unsubscribeOutbox();
      unsubscribeConn();
    };
  }, [conversationId]);

  const syncMissedMessages = async () => {
    if (!token || !conversationId) return;
    try {
      const data = await apiRequest('/api/messages/sync', {
        method: 'POST',
        body: JSON.stringify({ conversationId, lastSequence: 0 }),
      }, token);

      if (data.messages && data.messages.length > 0) {
        for (const msg of data.messages) {
          await insertLocalMessage({
            id: msg.id,
            conversationId: msg.conversationId,
            senderId: msg.senderId,
            sequence: msg.sequence,
            type: msg.type || 'text',
            content: msg.content,
            status: 'delivered',
            createdAt: msg.createdAt,
          });
        }
        loadMessages();
      }
    } catch (e) {
      // Silent sync catch
    }
  };

  const loadMessages = async () => {
    if (!conversationId) return;
    const list = await getMessagesForConversation(conversationId as string, 100);
    setMessages(list);
  };

  const handleSendMessage = async () => {
    if (!inputText.trim() || !currentUser || !conversationId) return;

    const messageId = generateMessageId();
    const nextSequence = messages.length > 0 ? messages[messages.length - 1].sequence + 1 : 1;
    const createdAt = new Date().toISOString();
    const textToSend = inputText.trim();

    const newMsg = {
      id: messageId,
      conversationId: conversationId as string,
      senderId: currentUser.id,
      sequence: nextSequence,
      type: 'text',
      content: textToSend,
      status: 'pending' as const,
      createdAt,
    };

    // 1. Instantly save to phone's local SQLite database
    await insertLocalMessage(newMsg);
    setInputText('');
    await loadMessages();

    // 2. Try WebSocket delivery first
    const wsSent = socketService.send({
      event: 'send_message',
      id: messageId,
      conversationId: conversationId as string,
      recipientId: otherUserId,
      type: 'text',
      content: textToSend,
    });

    // 3. Fallback to Cloudflare Workers REST API if WebSocket is reconnecting
    if (!wsSent) {
      try {
        const res = await apiRequest('/api/messages/send', {
          method: 'POST',
          body: JSON.stringify({
            id: messageId,
            conversationId: conversationId as string,
            recipientId: otherUserId,
            type: 'text',
            content: textToSend,
          }),
        }, token);

        await updateMessageStatus(messageId, res.status || 'sent');
        await loadMessages();
      } catch (err) {
        console.log('[Message API] Queued locally in SQLite:', err);
      }
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
          return (
            <View style={[styles.bubbleContainer, isMe ? styles.bubbleRight : styles.bubbleLeft]}>
              <View style={[styles.bubble, isMe ? styles.bgSent : styles.bgReceived]}>
                <Text style={[styles.messageText, isMe ? styles.textSent : styles.textReceived]}>
                  {item.content}
                </Text>
                <View style={styles.bubbleFooter}>
                  <Text style={styles.timestamp}>
                    {new Date(item.created_at).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                  {isMe && <View style={styles.statusIcon}>{renderStatusIcon(item.status)}</View>}
                </View>
              </View>
            </View>
          );
        }}
      />

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
          placeholder="Type a message..."
          placeholderTextColor={Colors.light.textSecondary}
          value={inputText}
          onChangeText={setInputText}
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
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.chatBackground,
  },
  messageList: {
    paddingHorizontal: 12,
    paddingVertical: 16,
  },
  bubbleContainer: {
    marginBottom: 8,
    maxWidth: '80%',
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
    shadowOpacity: 0.1,
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
  bubbleFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 4,
  },
  timestamp: {
    fontSize: 10,
    color: Colors.light.textSecondary,
    marginRight: 4,
  },
  statusIcon: {
    marginLeft: 2,
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
