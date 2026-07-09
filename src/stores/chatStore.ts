import { create } from 'zustand';
import { v4 as uuid } from 'uuid';
import type { ChatMessage } from '@/types';
import { loadJSON, saveJSON } from '@/lib/storage';

const CHAT_STORAGE = 'chat';
const CHAT_TRIP_KEY = 'chat-trip-id';

interface ChatState {
  messages: ChatMessage[];
  tripId: string | null;
  streaming: boolean;
  status: string;
  hydrate: () => void;
  /** Switch thread when the active trip changes. */
  bindTrip: (tripId: string | null) => void;
  addMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'> & { id?: string }) => ChatMessage;
  updateMessage: (id: string, content: string, patch?: Partial<Pick<ChatMessage, 'tripPatchApplied'>>) => void;
  setStreaming: (streaming: boolean) => void;
  setStatus: (status: string) => void;
  clear: () => void;
}

function persist(messages: ChatMessage[], tripId: string | null) {
  saveJSON(CHAT_STORAGE, messages);
  saveJSON(CHAT_TRIP_KEY, tripId);
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  tripId: null,
  streaming: false,
  status: '',

  hydrate: () => {
    const messages = loadJSON<ChatMessage[]>(CHAT_STORAGE, []);
    const tripId = loadJSON<string | null>(CHAT_TRIP_KEY, null);
    // Drop empty assistant placeholders left from a crashed stream
    const cleaned = messages.filter((m) => m.role !== 'assistant' || m.content.trim().length > 0);
    set({ messages: cleaned, tripId });
  },

  bindTrip: (tripId) => {
    const current = get().tripId;
    if (current === tripId) return;
    // First bind after chat hydrate — keep the thread if it already belongs to this trip
    if (current == null && tripId != null) {
      const storedTrip = loadJSON<string | null>(CHAT_TRIP_KEY, null);
      if (storedTrip === tripId || storedTrip == null) {
        set({ tripId });
        persist(get().messages, tripId);
        return;
      }
    }
    set({ messages: [], tripId, streaming: false, status: '' });
    persist([], tripId);
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
    persist(messages, get().tripId);
    return full;
  },

  updateMessage: (id, content, patch) => {
    const messages = get().messages.map((m) =>
      m.id === id ? { ...m, content, ...patch } : m,
    );
    set({ messages });
    persist(messages, get().tripId);
  },

  setStreaming: (streaming) => set({ streaming }),
  setStatus: (status) => set({ status }),

  clear: () => {
    set({ messages: [], streaming: false, status: '' });
    persist([], get().tripId);
  },
}));
