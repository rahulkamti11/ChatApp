import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Star, MessageSquare } from 'lucide-react-native';
import { getStarredMessages } from '../db/queries/messages';
import { Colors } from '../theme/colors';

export default function StarredMessagesScreen() {
  const router = useRouter();
  const [starredMessages, setStarredMessages] = useState<any[]>([]);

  useEffect(() => {
    loadStarred();
  }, []);

  const loadStarred = async () => {
    const list = await getStarredMessages();
    setStarredMessages(list);
  };

  return (
    <View style={styles.container}>
      {starredMessages.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Star size={64} color="#CBD5E1" />
          <Text style={styles.emptyTitle}>No starred messages</Text>
          <Text style={styles.emptySubtitle}>
            Tap and hold any message in a chat and tap "Star" to bookmark it here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={starredMessages}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              activeOpacity={0.7}
              onPress={() =>
                router.push({
                  pathname: '/chat/[id]',
                  params: {
                    id: item.conversation_id,
                    otherDisplayName: item.other_display_name || 'Chat',
                  },
                })
              }
            >
              <View style={styles.cardHeader}>
                <Text style={styles.authorName}>
                  {item.other_display_name || 'Contact'}
                </Text>
                <Text style={styles.timestamp}>
                  {new Date(item.created_at).toLocaleDateString([], {
                    month: 'short',
                    day: 'numeric',
                  })}{' '}
                  {new Date(item.created_at).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
              </View>
              <Text style={styles.content}>{item.content}</Text>
              <View style={styles.cardFooter}>
                <Star size={14} color="#F59E0B" fill="#F59E0B" />
                <Text style={styles.tapToView}>Tap to view in chat</Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0F2F5',
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
  card: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 12,
    marginTop: 10,
    padding: 14,
    borderRadius: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  authorName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.light.primary,
  },
  timestamp: {
    fontSize: 11,
    color: Colors.light.textSecondary,
  },
  content: {
    fontSize: 15,
    color: Colors.light.textPrimary,
    lineHeight: 20,
    marginBottom: 8,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 0.5,
    borderTopColor: '#F1F5F9',
    paddingTop: 6,
  },
  tapToView: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    marginLeft: 6,
  },
});
