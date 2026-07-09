import { create } from 'zustand';
import { v4 as uuid } from 'uuid';
import type { ChatMessage } from '@/types';
import { loadJSON, saveJSON } from '@/lib/storage';

const CHAT_STORAGE = 'chat';

interface ChatState {
  messages: ChatMessage[];
  streaming: boolean;
  hydrate: () => void;
  addMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'> & { id?: string }) => ChatMessage;
  updateMessage: (id: string, content: string) => void;
  setStreaming: (streaming: boolean) => void;
  clear: () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  streaming: false,

  hydrate: () => {
    const messages = loadJSON<ChatMessage[]>(CHAT_STORAGE, []);
    set({ messages });
  },

  addMessage: (message) => {
    const full: ChatMessage = {
      id: message.id || uuid(),
      role: message.role,
      content: message.content,
      timestamp: new Date().toISOString(),
      tripPatchApplied: message.tripPatchApplied,
    };
    const messages = [...get().messages, full];
    set({ messages });
    saveJSON(CHAT_STORAGE, messages);
    return full;
  },

  updateMessage: (id, content) => {
    const messages = get().messages.map((m) => (m.id === id ? { ...m, content } : m));
    set({ messages });
    saveJSON(CHAT_STORAGE, messages);
  },

  setStreaming: (streaming) => set({ streaming }),

  clear: () => {
    set({ messages: [] });
    saveJSON(CHAT_STORAGE, []);
  },
}));
