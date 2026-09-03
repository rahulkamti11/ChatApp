import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet,
  Clipboard,
} from 'react-native';
import {
  CornerUpLeft,
  Copy,
  Star,
  StarOff,
  Pencil,
  Trash2,
  Smile,
} from 'lucide-react-native';
import { Colors } from '../../theme/colors';

const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

interface MessageActionModalProps {
  visible: boolean;
  message: any | null;
  currentUserId?: string;
  onClose: () => void;
  onReaction: (messageId: string, emoji: string) => void;
  onReply: (message: any) => void;
  onToggleStar: (messageId: string, isStarred: boolean) => void;
  onEdit: (message: any) => void;
  onDelete: (messageId: string, forEveryone: boolean) => void;
}

export function MessageActionModal({
  visible,
  message,
  currentUserId,
  onClose,
  onReaction,
  onReply,
  onToggleStar,
  onEdit,
  onDelete,
}: MessageActionModalProps) {
  if (!message) return null;

  const isMe = message.sender_id === currentUserId;
  const isDeleted = message.is_deleted === 1;
  const messageAgeMs = Date.now() - new Date(message.created_at).getTime();
  const canEdit = isMe && !isDeleted && messageAgeMs < 30 * 60 * 1000 && message.type === 'text';
  const isStarred = message.is_starred === 1;

  const handleCopy = () => {
    if (message.content) {
      Clipboard.setString(message.content);
    }
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.sheetContainer}>
              {/* 1. Quick Emoji Reaction Dock */}
              {!isDeleted && (
                <View style={styles.reactionDock}>
                  {QUICK_EMOJIS.map((emoji) => (
                    <TouchableOpacity
                      key={emoji}
                      style={styles.reactionBtn}
                      activeOpacity={0.6}
                      onPress={() => {
                        onReaction(message.id, emoji);
                        onClose();
                      }}
                    >
                      <Text style={styles.reactionEmoji}>{emoji}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* 2. Action Menu Items */}
              <View style={styles.menuContainer}>
                {!isDeleted && (
                  <TouchableOpacity
                    style={styles.menuItem}
                    onPress={() => {
                      onReply(message);
                      onClose();
                    }}
                  >
                    <CornerUpLeft size={20} color={Colors.light.textPrimary} />
                    <Text style={styles.menuText}>Reply</Text>
                  </TouchableOpacity>
                )}

                {message.content && !isDeleted && (
                  <TouchableOpacity style={styles.menuItem} onPress={handleCopy}>
                    <Copy size={20} color={Colors.light.textPrimary} />
                    <Text style={styles.menuText}>Copy Text</Text>
                  </TouchableOpacity>
                )}

                {!isDeleted && (
                  <TouchableOpacity
                    style={styles.menuItem}
                    onPress={() => {
                      onToggleStar(message.id, !isStarred);
                      onClose();
                    }}
                  >
                    {isStarred ? (
                      <StarOff size={20} color="#F59E0B" />
                    ) : (
                      <Star size={20} color={Colors.light.textPrimary} />
                    )}
                    <Text style={styles.menuText}>{isStarred ? 'Unstar' : 'Star'}</Text>
                  </TouchableOpacity>
                )}

                {canEdit && (
                  <TouchableOpacity
                    style={styles.menuItem}
                    onPress={() => {
                      onEdit(message);
                      onClose();
                    }}
                  >
                    <Pencil size={20} color={Colors.light.primary} />
                    <Text style={[styles.menuText, { color: Colors.light.primary }]}>Edit Message</Text>
                  </TouchableOpacity>
                )}

                {isMe && !isDeleted && (
                  <TouchableOpacity
                    style={styles.menuItem}
                    onPress={() => {
                      onDelete(message.id, true);
                      onClose();
                    }}
                  >
                    <Trash2 size={20} color={Colors.light.error} />
                    <Text style={[styles.menuText, { color: Colors.light.error }]}>
                      Delete for Everyone
                    </Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={[styles.menuItem, { borderBottomWidth: 0 }]}
                  onPress={() => {
                    onDelete(message.id, false);
                    onClose();
                  }}
                >
                  <Trash2 size={20} color={Colors.light.textSecondary} />
                  <Text style={styles.menuText}>Delete for Me</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 28,
  },
  reactionDock: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#F0F2F5',
    borderRadius: 30,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  reactionBtn: {
    padding: 6,
  },
  reactionEmoji: {
    fontSize: 26,
  },
  menuContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.light.border,
  },
  menuText: {
    fontSize: 16,
    color: Colors.light.textPrimary,
    marginLeft: 16,
    fontWeight: '500',
  },
});
