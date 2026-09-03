import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet,
  Clipboard,
  ScrollView,
} from 'react-native';
import {
  CornerUpLeft,
  Copy,
  Star,
  StarOff,
  Pencil,
  Trash2,
  Plus,
  X,
} from 'lucide-react-native';
import { Colors } from '../../theme/colors';

const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

const ALL_EMOJIS = [
  '👍', '❤️', '😂', '😮', '😢', '🙏',
  '🔥', '🎉', '👏', '💯', '🤩', '😭',
  '🥳', '😍', '✨', '🙌', '🤝', '😎',
  '🚀', '💡', '💔', '🤔', '👀', '💪',
  '👌', '😜', '🌟', '🥰', '🤗', '😴',
  '🤮', '🤐', '😇', '🎯', '🍕', '⚡',
];

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
  const [showFullPicker, setShowFullPicker] = useState(false);

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

  const handleEmojiSelect = (emoji: string) => {
    onReaction(message.id, emoji);
    setShowFullPicker(false);
    onClose();
  };

  const handleModalClose = () => {
    setShowFullPicker(false);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleModalClose}>
      <TouchableWithoutFeedback onPress={handleModalClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.sheetContainer}>
              {/* 1. Emoji Reaction Dock (or Full Picker) */}
              {!isDeleted && (
                showFullPicker ? (
                  <View style={styles.fullPickerContainer}>
                    <View style={styles.pickerHeader}>
                      <Text style={styles.pickerTitle}>React with Emoji</Text>
                      <TouchableOpacity onPress={() => setShowFullPicker(false)}>
                        <X size={20} color={Colors.light.textSecondary} />
                      </TouchableOpacity>
                    </View>
                    <ScrollView contentContainerStyle={styles.pickerGrid}>
                      {ALL_EMOJIS.map((emoji) => (
                        <TouchableOpacity
                          key={emoji}
                          style={styles.pickerEmojiBtn}
                          activeOpacity={0.6}
                          onPress={() => handleEmojiSelect(emoji)}
                        >
                          <Text style={styles.pickerEmojiText}>{emoji}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                ) : (
                  <View style={styles.reactionDock}>
                    {QUICK_EMOJIS.map((emoji) => (
                      <TouchableOpacity
                        key={emoji}
                        style={styles.reactionBtn}
                        activeOpacity={0.6}
                        onPress={() => handleEmojiSelect(emoji)}
                      >
                        <Text style={styles.reactionEmoji}>{emoji}</Text>
                      </TouchableOpacity>
                    ))}
                    {/* '+' Icon for full picker */}
                    <TouchableOpacity
                      style={styles.plusBtn}
                      activeOpacity={0.6}
                      onPress={() => setShowFullPicker(true)}
                    >
                      <Plus size={20} color={Colors.light.textSecondary} />
                    </TouchableOpacity>
                  </View>
                )
              )}

              {/* 2. Action Menu Items */}
              {!showFullPicker && (
                <View style={styles.menuContainer}>
                  {!isDeleted && (
                    <TouchableOpacity
                      style={styles.menuItem}
                      onPress={() => {
                        onReply(message);
                        handleModalClose();
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
                        handleModalClose();
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
                        handleModalClose();
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
                        handleModalClose();
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
                      handleModalClose();
                    }}
                  >
                    <Trash2 size={20} color={Colors.light.textSecondary} />
                    <Text style={styles.menuText}>Delete for Me</Text>
                  </TouchableOpacity>
                </View>
              )}
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
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: '#F0F2F5',
    borderRadius: 30,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginBottom: 16,
  },
  reactionBtn: {
    padding: 6,
  },
  reactionEmoji: {
    fontSize: 26,
  },
  plusBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4,
  },
  fullPickerContainer: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 12,
    marginBottom: 16,
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  pickerTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.light.textPrimary,
  },
  pickerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  pickerEmojiBtn: {
    width: '16.66%',
    alignItems: 'center',
    paddingVertical: 8,
  },
  pickerEmojiText: {
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
