import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { X, CornerUpLeft } from 'lucide-react-native';
import { Colors } from '../../theme/colors';

interface ReplyPreviewBarProps {
  replyMessage: {
    id: string;
    sender_name: string;
    content: string;
    isMe?: boolean;
  } | null;
  onCancel: () => void;
}

export function ReplyPreviewBar({ replyMessage, onCancel }: ReplyPreviewBarProps) {
  if (!replyMessage) return null;

  return (
    <View style={styles.container}>
      <View style={styles.accentBar} />
      <View style={styles.contentContainer}>
        <View style={styles.headerRow}>
          <CornerUpLeft size={13} color={Colors.light.primary} />
          <Text style={styles.authorName}>
            {replyMessage.isMe ? 'You' : replyMessage.sender_name}
          </Text>
        </View>
        <Text style={styles.previewText} numberOfLines={1}>
          {replyMessage.content || '[Media]'}
        </Text>
      </View>
      <TouchableOpacity style={styles.closeButton} onPress={onCancel} activeOpacity={0.7}>
        <X size={18} color={Colors.light.textSecondary} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F2F5',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.light.border,
  },
  accentBar: {
    width: 4,
    height: '90%',
    backgroundColor: Colors.light.primary,
    borderRadius: 2,
    marginRight: 8,
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  authorName: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.light.primary,
    marginLeft: 4,
  },
  previewText: {
    fontSize: 13,
    color: Colors.light.textSecondary,
  },
  closeButton: {
    padding: 6,
    marginLeft: 8,
  },
});
