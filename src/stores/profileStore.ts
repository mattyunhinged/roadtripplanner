import { create } from 'zustand';
import type { TravelerProfile } from '@/types';
import { DEFAULT_PROFILE } from '@/types';
import { loadJSON, saveJSON } from '@/lib/storage';

const PROFILE_STORAGE = 'profile';

interface ProfileState {
  profile: TravelerProfile;
  hydrate: () => void;
  setProfile: (partial: Partial<TravelerProfile>) => void;
  resetProfile: () => void;
}

export const useProfileStore = create<ProfileState>((set, get) => ({
  profile: DEFAULT_PROFILE,

  hydrate: () => {
    const profile = loadJSON<TravelerProfile>(PROFILE_STORAGE, DEFAULT_PROFILE);
    set({ profile: { ...DEFAULT_PROFILE, ...profile } });
  },

  setProfile: (partial) => {
    const profile = { ...get().profile, ...partial };
    set({ profile });
    saveJSON(PROFILE_STORAGE, profile);
  },

  resetProfile: () => {
    set({ profile: DEFAULT_PROFILE });
    saveJSON(PROFILE_STORAGE, DEFAULT_PROFILE);
  },
}));
