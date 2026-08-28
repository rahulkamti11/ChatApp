import { create } from 'zustand';

interface ChatStore {
  activeConversationId: string | null;
  replyToMessage: { id: string; senderName: string; text: string } | null;
  typingUsers: Record<string, boolean>; // conversationId -> isTyping
  setActiveConversation: (id: string | null) => void;
  setReplyToMessage: (msg: { id: string; senderName: string; text: string } | null) => void;
  setTyping: (conversationId: string, isTyping: boolean) => void;
}

export const useChatStore = create<ChatStore>((set) => ({
  activeConversationId: null,
  replyToMessage: null,
  typingUsers: {},
  setActiveConversation: (id) => set({ activeConversationId: id }),
  setReplyToMessage: (msg) => set({ replyToMessage: msg }),
  setTyping: (conversationId, isTyping) =>
    set((state) => ({
      typingUsers: { ...state.typingUsers, [conversationId]: isTyping },
    })),
}));
