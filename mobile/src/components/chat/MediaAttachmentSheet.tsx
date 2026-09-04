import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet,
} from 'react-native';
import {
  Camera,
  Image as ImageIcon,
  Music,
  FileText,
  X,
} from 'lucide-react-native';
import { Colors } from '../../theme/colors';

interface MediaAttachmentSheetProps {
  visible: boolean;
  onClose: () => void;
  onSelectOption: (type: 'camera' | 'gallery' | 'audio' | 'files') => void;
}

export function MediaAttachmentSheet({
  visible,
  onClose,
  onSelectOption,
}: MediaAttachmentSheetProps) {
  const options = [
    {
      type: 'camera' as const,
      label: 'Camera',
      icon: Camera,
      color: '#EC4899', // Pink
      bgColor: '#FDF2F8',
    },
    {
      type: 'gallery' as const,
      label: 'Gallery',
      icon: ImageIcon,
      color: '#8B5CF6', // Purple
      bgColor: '#F5F3FF',
    },
    {
      type: 'audio' as const,
      label: 'Audio',
      icon: Music,
      color: '#F59E0B', // Amber
      bgColor: '#FEF3C7',
    },
    {
      type: 'files' as const,
      label: 'Files',
      icon: FileText,
      color: '#3B82F6', // Blue
      bgColor: '#EFF6FF',
    },
  ];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.sheet}>
              <View style={styles.header}>
                <Text style={styles.title}>Share Content</Text>
                <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                  <X size={20} color={Colors.light.textSecondary} />
                </TouchableOpacity>
              </View>

              <View style={styles.grid}>
                {options.map((opt) => {
                  const IconComp = opt.icon;
                  return (
                    <TouchableOpacity
                      key={opt.type}
                      style={styles.optionItem}
                      activeOpacity={0.7}
                      onPress={() => {
                        onSelectOption(opt.type);
                        onClose();
                      }}
                    >
                      <View style={[styles.iconContainer, { backgroundColor: opt.bgColor }]}>
                        <IconComp size={28} color={opt.color} />
                      </View>
                      <Text style={styles.optionLabel}>{opt.label}</Text>
                    </TouchableOpacity>
                  );
                })}
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
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  title: {
    fontSize: 17,
    fontWeight: 'bold',
    color: Colors.light.textPrimary,
  },
  closeBtn: {
    padding: 4,
  },
  grid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 8,
  },
  optionItem: {
    alignItems: 'center',
    width: 72,
  },
  iconContainer: {
    width: 58,
    height: 58,
    borderRadius: 29,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  optionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.light.textPrimary,
  },
});
