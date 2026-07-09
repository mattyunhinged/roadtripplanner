import { create } from 'zustand';
import type { TravelerProfile, ActivityTag, TripGuest } from '@/types';
import { DEFAULT_PROFILE } from '@/types';
import { loadJSON, saveJSON } from '@/lib/storage';

const PROFILE_STORAGE = 'profile';

function migrateGuests(raw: unknown): TripGuest[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((g) => {
      if (!g || typeof g !== 'object') return null;
      const guest = g as Partial<TripGuest>;
      if (!guest.name || !guest.ageRange) return null;
      return {
        id: typeof guest.id === 'string' && guest.id ? guest.id : crypto.randomUUID(),
        name: String(guest.name).trim(),
        ageRange: guest.ageRange,
      } as TripGuest;
    })
    .filter((g): g is TripGuest => !!g && !!g.name);
}

function migrateProfile(raw: Partial<TravelerProfile> | null): TravelerProfile {
  const base = { ...DEFAULT_PROFILE, ...(raw || {}) };
  const tags: ActivityTag[] = Array.isArray(base.activityTags) && base.activityTags.length
    ? base.activityTags
    : Array.isArray(base.interests)
      ? (base.interests as ActivityTag[])
      : [];
  return {
    ...DEFAULT_PROFILE,
    ...base,
    displayName: typeof base.displayName === 'string' ? base.displayName.trim() : '',
    guests: migrateGuests(base.guests),
    activityTags: tags,
    interests: tags,
    ageGroup: base.ageGroup || 'young_adult',
    highwayPreference: base.highwayPreference || 'mix',
    vehicle: base.vehicle || null,
  };
}

interface ProfileState {
  profile: TravelerProfile;
  hydrate: () => void;
  setProfile: (partial: Partial<TravelerProfile>) => void;
  resetProfile: () => void;
}

export const useProfileStore = create<ProfileState>((set, get) => ({
  profile: DEFAULT_PROFILE,

  hydrate: () => {
    const raw = loadJSON<Partial<TravelerProfile> | null>(PROFILE_STORAGE, null);
    set({ profile: migrateProfile(raw) });
  },

  setProfile: (partial) => {
    const merged = { ...get().profile, ...partial };
    if (partial.activityTags) {
      merged.interests = partial.activityTags;
    }
    if (partial.interests && !partial.activityTags) {
      merged.activityTags = partial.interests;
    }
    const profile = migrateProfile(merged);
    set({ profile });
    saveJSON(PROFILE_STORAGE, profile);
  },

  resetProfile: () => {
    set({ profile: DEFAULT_PROFILE });
    saveJSON(PROFILE_STORAGE, DEFAULT_PROFILE);
  },
}));
