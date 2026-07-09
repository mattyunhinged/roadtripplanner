import { create } from 'zustand';
import type { Trip, Stop, DriveLeg } from '@/types';
import { hydrateBoardImage, tripForLocalStorage } from '@/lib/boardStore';
import { loadJSON, saveJSON } from '@/lib/storage';
import { applyBudget, createEmptyTrip, recomputeDayTotals, reorderStops } from '@/lib/ai/tripPatch';
import { useChatStore } from './chatStore';
import { useProfileStore } from './profileStore';
import { useKeysStore } from './keysStore';

const LIBRARY_STORAGE = 'trip-library';
const ACTIVE_STORAGE = 'active-trip';

interface TripState {
  activeTrip: Trip | null;
  library: Trip[];
  hydrate: () => void;
  setActiveTrip: (trip: Trip | null) => void;
  updateActiveTrip: (updater: (trip: Trip) => Trip) => void;
  saveActiveToLibrary: () => void;
  loadFromLibrary: (id: string) => void;
  deleteFromLibrary: (id: string) => void;
  removeStop: (stopId: string) => void;
  addStop: (stop: Stop) => void;
  reorderDayStops: (dayIndex: number, orderedIds: string[]) => void;
  setLegs: (legs: DriveLeg[]) => void;
  refreshBudget: () => void;
}

function persistActive(trip: Trip | null) {
  if (trip) saveJSON(ACTIVE_STORAGE, tripForLocalStorage(trip));
  else saveJSON(ACTIVE_STORAGE, null);
}

function persistLibrary(library: Trip[]) {
  saveJSON(
    LIBRARY_STORAGE,
    library.map((t) => tripForLocalStorage(t)),
  );
}

export const useTripStore = create<TripState>((set, get) => ({
  activeTrip: null,
  library: [],

  hydrate: () => {
    try {
      const library = loadJSON<Trip[]>(LIBRARY_STORAGE, []);
      const activeTrip = loadJSON<Trip | null>(ACTIVE_STORAGE, null);
      const safeLibrary = Array.isArray(library) ? library : [];
      set({ library: safeLibrary, activeTrip: activeTrip || null });
      try {
        useChatStore.getState().bindTrip(activeTrip?.id ?? null);
      } catch {
        // chat bind is best-effort
      }
      void (async () => {
        try {
          const hydratedActive = await hydrateBoardImage(activeTrip);
          const hydratedLibrary = await Promise.all(
            safeLibrary.map(async (t) => (await hydrateBoardImage(t)) || t),
          );
          set({
            activeTrip: hydratedActive,
            library: hydratedLibrary,
          });
        } catch {
          // keep unhydrated trip rather than blanking the app
        }
      })();
    } catch {
      set({ library: [], activeTrip: null });
    }
  },

  setActiveTrip: (trip) => {
    set({ activeTrip: trip });
    persistActive(trip);
    useChatStore.getState().bindTrip(trip?.id ?? null);
  },

  updateActiveTrip: (updater) => {
    const current = get().activeTrip;
    if (!current) return;
    const next = updater(current);
    set({ activeTrip: next });
    persistActive(next);
  },

  saveActiveToLibrary: () => {
    const trip = get().activeTrip;
    if (!trip) return;
    const library = get().library.filter((t) => t.id !== trip.id);
    const next = [{ ...trip, updatedAt: new Date().toISOString() }, ...library];
    set({ library: next });
    persistLibrary(next);
  },

  loadFromLibrary: (id) => {
    const trip = get().library.find((t) => t.id === id);
    if (!trip) return;
    get().setActiveTrip({ ...trip });
  },

  deleteFromLibrary: (id) => {
    const library = get().library.filter((t) => t.id !== id);
    set({ library });
    persistLibrary(library);
    if (get().activeTrip?.id === id) {
      get().setActiveTrip(null);
    }
  },

  removeStop: (stopId) => {
    get().updateActiveTrip((trip) => {
      const stops = trip.stops.filter((s) => s.id !== stopId);
      const legs = trip.legs.filter((l) => l.fromStopId !== stopId && l.toStopId !== stopId);
      return recomputeDayTotals({ ...trip, stops, legs });
    });
  },

  addStop: (stop) => {
    get().updateActiveTrip((trip) => {
      const stops = [...trip.stops, stop];
      const days = trip.days.some((d) => d.index === stop.dayIndex)
        ? trip.days
        : [
            ...trip.days,
            {
              index: stop.dayIndex,
              title: `Day ${stop.dayIndex + 1}`,
              stopIds: [],
              drivingHours: 0,
              miles: 0,
              estimatedSpend: 0,
            },
          ];
      return recomputeDayTotals({ ...trip, stops, days });
    });
  },

  reorderDayStops: (dayIndex, orderedIds) => {
    get().updateActiveTrip((trip) => {
      const stops = reorderStops(trip.stops, orderedIds, dayIndex);
      return recomputeDayTotals({ ...trip, stops });
    });
  },

  setLegs: (legs) => {
    get().updateActiveTrip((trip) => recomputeDayTotals({ ...trip, legs }));
  },

  refreshBudget: () => {
    const trip = get().activeTrip;
    if (!trip) return;
    const profile = useProfileStore.getState().profile;
    const mpg =
      useKeysStore.getState().settings.vehicleMpg ?? profile.vehicle?.mpg ?? null;
    get().setActiveTrip(applyBudget(trip, profile, mpg));
  },
}));

export { createEmptyTrip };
