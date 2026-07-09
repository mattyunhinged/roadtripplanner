import { create } from 'zustand';
import type { AIProviderId, ApiKeys, AppSettings } from '@/types';
import { DEFAULT_SETTINGS } from '@/types';
import { loadJSON, removeKey, saveJSON } from '@/lib/storage';
import { detectProvider } from '@/lib/utils';

const KEYS_STORAGE = 'keys';
const SETTINGS_STORAGE = 'settings';

interface KeysState {
  keys: ApiKeys | null;
  settings: AppSettings;
  ready: boolean;
  setKeys: (keys: ApiKeys) => void;
  updateKeys: (partial: Partial<ApiKeys>) => void;
  clearKeys: () => void;
  setSettings: (partial: Partial<AppSettings>) => void;
  hydrate: () => void;
  currentModel: () => string;
  detectAndSetProvider: (aiKey: string) => AIProviderId | null;
}

export const useKeysStore = create<KeysState>((set, get) => ({
  keys: null,
  settings: DEFAULT_SETTINGS,
  ready: false,

  hydrate: () => {
    const persisted = loadJSON<ApiKeys | null>(KEYS_STORAGE, null);
    const settings = loadJSON<AppSettings>(SETTINGS_STORAGE, DEFAULT_SETTINGS);
    set({
      keys: persisted,
      settings: { ...DEFAULT_SETTINGS, ...settings },
      ready: true,
    });
  },

  setKeys: (keys) => {
    set({ keys });
    if (keys.persist) saveJSON(KEYS_STORAGE, keys);
    else removeKey(KEYS_STORAGE);
  },

  updateKeys: (partial) => {
    const current = get().keys;
    if (!current) return;
    const next = { ...current, ...partial };
    get().setKeys(next);
  },

  clearKeys: () => {
    set({ keys: null });
    removeKey(KEYS_STORAGE);
  },

  setSettings: (partial) => {
    const settings = { ...get().settings, ...partial };
    set({ settings });
    saveJSON(SETTINGS_STORAGE, settings);
    if (partial.theme) {
      document.documentElement.classList.toggle('dark', partial.theme === 'dark');
    }
  },

  currentModel: () => {
    const { keys, settings } = get();
    if (!keys) return settings.openaiModel;
    return keys.aiProvider === 'openai' ? settings.openaiModel : settings.anthropicModel;
  },

  detectAndSetProvider: (aiKey) => {
    const detected = detectProvider(aiKey);
    return detected;
  },
}));
