import { useCallback, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Backpack,
  BookOpen,
  ImageIcon,
  Library,
  MapPinned,
  Plus,
  Save,
  Settings,
  Share2,
  Sparkles,
} from 'lucide-react';
import { v4 as uuid } from 'uuid';
import { BrandLockup, Button, Spinner } from '@/components/ui';
import { TripMap } from '@/components/TripMap';
import { ItineraryPanel } from '@/components/ItineraryPanel';
import { AutopilotModal } from '@/components/AutopilotModal';
import { TripWizard } from '@/components/TripWizard';
import { ManualPlanModal } from '@/components/ManualPlanModal';
import { ChatDrawer } from '@/components/ChatDrawer';
import { generateTripBoard } from '@/lib/ai/engine';
import { reverseGeocode, searchPlace } from '@/lib/google/maps';
import { recalculateRoutes } from '@/lib/ai/engine';
import { cn } from '@/lib/utils';
import { useKeysStore } from '@/stores/keysStore';
import { useProfileStore } from '@/stores/profileStore';
import { useTripStore } from '@/stores/tripStore';
import { useUIStore } from '@/stores/uiStore';
import type { Stop } from '@/types';

export function PlannerScreen() {
  const trip = useTripStore((s) => s.activeTrip);
  const displayName = useProfileStore((s) => s.profile.displayName);
  const guests = useProfileStore((s) => s.profile.guests);
  const firstName = displayName.trim().split(/\s+/)[0] || '';
  const crewCount = 1 + (guests?.length || 0);
  const addStop = useTripStore((s) => s.addStop);
  const saveActiveToLibrary = useTripStore((s) => s.saveActiveToLibrary);
  const setTripWizardOpen = useUIStore((s) => s.setTripWizardOpen);
  const setAutopilotOpen = useUIStore((s) => s.setAutopilotOpen);
  const setManualOpen = useUIStore((s) => s.setManualOpen);
  const setScreen = useUIStore((s) => s.setScreen);
  const mobileSheetExpanded = useUIStore((s) => s.mobileSheetExpanded);
  const setMobileSheetExpanded = useUIStore((s) => s.setMobileSheetExpanded);
  const showToast = useUIStore((s) => s.showToast);
  const clearProgress = useUIStore((s) => s.clearAutopilotProgress);
  const provider = useKeysStore((s) => s.keys?.aiProvider);
  const [addMode, setAddMode] = useState(false);
  const [search, setSearch] = useState('');
  const [posterBusy, setPosterBusy] = useState(false);

  const onMapClickAdd = useCallback(
    async (lat: number, lng: number) => {
      if (!addMode) return;
      const active = useTripStore.getState().activeTrip;
      if (!active) {
        showToast('Create or open a trip before dropping pins', 'info');
        setAddMode(false);
        return;
      }
      // Leave pin mode immediately so double-clicks don't stack
      setAddMode(false);
      try {
        let place = await reverseGeocode({ lat, lng });
        // Enrich with Places details/photos when possible
        if (place?.name) {
          const richer = await searchPlace(place.name, { lat, lng });
          if (richer) place = { ...place, ...richer, location: { lat, lng } };
        }
        const dayIndex = active.days[active.days.length - 1]?.index ?? 0;
        const order = active.stops.filter((s) => s.dayIndex === dayIndex).length ?? 0;
        const stop: Stop = {
          id: uuid(),
          name: place?.name || `Pinned stop (${lat.toFixed(3)}, ${lng.toFixed(3)})`,
          category: 'custom',
          location: { lat, lng },
          placeId: place?.placeId,
          address: place?.address,
          dayIndex,
          order,
          photoUrl: place?.photoUrl,
          photoUrls: place?.photoUrls,
          mapsUrl: place?.mapsUrl || `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
          aiNotes: 'Added from map pin',
        };
        addStop(stop);
        useUIStore.getState().setSelectedStopId(stop.id);
        if (active.stops.length + 1 >= 2) {
          await recalculateRoutes();
        }
        showToast(`Pinned ${stop.name}`, 'success');
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'Could not add stop', 'error');
      }
    },
    [addMode, addStop, showToast],
  );

  async function addFromSearch() {
    if (!search.trim()) return;
    try {
      const place = await searchPlace(search.trim(), trip?.origin);
      if (!place) throw new Error('No place found');
      const dayIndex = trip?.days[0]?.index ?? 0;
      const order = trip?.stops.filter((s) => s.dayIndex === dayIndex).length ?? 0;
      addStop({
        id: uuid(),
        name: place.name,
        category: 'attraction',
        location: place.location,
        placeId: place.placeId,
        address: place.address,
        dayIndex,
        order,
        rating: place.rating,
        priceLevel: place.priceLevel,
        hours: place.hours,
        photoUrl: place.photoUrl,
        photoUrls: place.photoUrls,
        mapsUrl: place.mapsUrl,
        aiNotes: 'Added via search',
      });
      await recalculateRoutes();
      setSearch('');
      showToast(`Added ${place.name}`, 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Search failed', 'error');
    }
  }

  async function makePoster() {
    if (!trip) return;
    if (provider !== 'openai') {
      showToast('Poster needs an OpenAI key — switch in Settings', 'info');
      setScreen('settings');
      return;
    }
    setPosterBusy(true);
    try {
      await generateTripBoard(trip);
      showToast('Poster ready — check Export', 'success');
      setScreen('export');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Poster failed', 'error');
    } finally {
      setPosterBusy(false);
      window.setTimeout(() => clearProgress(), 500);
    }
  }

  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-[var(--bg)]">
      <header className="no-print absolute left-0 right-0 top-0 z-20 map-fade-top px-4 pb-10 pt-4 md:px-6">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <BrandLockup />
            {firstName && (
              <p className="mt-1 truncate text-sm text-[var(--fg-muted)]">
                Hey {firstName}
                {crewCount > 1 ? ` · crew of ${crewCount}` : ''}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="accent"
              onClick={() => setTripWizardOpen(true)}
            >
              <Sparkles className="h-4 w-4" /> New trip
            </Button>
            <Button
              size="sm"
              variant="secondary"
              className="hidden sm:inline-flex"
              onClick={() => setAutopilotOpen(true)}
            >
              Quick Autopilot
            </Button>
            <Button
              size="sm"
              variant="secondary"
              className="hidden sm:inline-flex"
              onClick={() => setManualOpen(true)}
            >
              <MapPinned className="h-4 w-4" /> Manual
            </Button>
            <Button size="sm" variant="ghost" className="hidden md:inline-flex" onClick={() => setScreen('library')}>
              <Library className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setScreen('settings')}>
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <div className="relative min-h-0 min-w-0 flex-1">
          <TripMap onMapClickAdd={onMapClickAdd} pinMode={addMode} />

          <div className="no-print absolute left-4 top-24 z-10 flex max-w-md flex-col gap-2 md:left-6">
            <div className="flex gap-2 rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-2 shadow-[var(--shadow-soft)]">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addFromSearch()}
                placeholder="Search places to add…"
                className="h-10 flex-1 bg-transparent px-2 text-sm outline-none placeholder:text-[var(--fg-subtle)]"
              />
              <Button size="sm" variant="secondary" onClick={addFromSearch}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <button
              type="button"
              disabled={!trip}
              onClick={() => setAddMode((v) => !v)}
              className={cn(
                'w-fit rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-1.5 text-xs shadow-sm disabled:opacity-40',
                addMode && 'ring-2 ring-[var(--accent)]',
              )}
            >
              {addMode ? 'tap the map…' : 'tap map to drop a stop'}
            </button>
          </div>

          {trip && (
            <div className="no-print absolute right-4 top-24 z-10 hidden w-44 flex-col gap-2 md:flex">
              <Button
                size="sm"
                variant="accent"
                className="justify-start"
                onClick={() => {
                  saveActiveToLibrary();
                  showToast('Trip saved', 'success');
                }}
              >
                <Save className="h-4 w-4" /> Save this trip
              </Button>
              <Button
                size="sm"
                variant="secondary"
                className="justify-start"
                disabled={posterBusy}
                onClick={makePoster}
              >
                {posterBusy ? <Spinner className="h-4 w-4" /> : <ImageIcon className="h-4 w-4" />}
                {trip.boardImageUrl ? 'Regen poster' : 'Generate poster'}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                className="justify-start"
                onClick={() => setScreen('export')}
              >
                <Share2 className="h-4 w-4" /> Export / board
              </Button>
              <Button
                size="sm"
                variant="secondary"
                className="justify-start"
                onClick={() => setScreen('packing')}
              >
                <Backpack className="h-4 w-4" /> Packing
              </Button>
            </div>
          )}
        </div>

        <aside className="no-print hidden w-[var(--panel-width)] shrink-0 border-l border-[var(--border)] bg-[var(--bg-elevated)] md:block">
          <ItineraryPanel />
        </aside>
      </div>

      <motion.div
        className="no-print absolute inset-x-0 bottom-0 z-20 md:hidden"
        animate={{ height: mobileSheetExpanded ? '70%' : 132 }}
        transition={{ type: 'spring', stiffness: 280, damping: 30 }}
      >
        <div className="flex h-full flex-col overflow-hidden rounded-t-3xl border border-[var(--border)] bg-[var(--bg-elevated)] shadow-[var(--shadow-soft)]">
          <button
            type="button"
            className="flex w-full flex-col items-center px-4 pt-3"
            onClick={() => setMobileSheetExpanded(!mobileSheetExpanded)}
          >
            <div className="h-1.5 w-10 rounded-full bg-[var(--border-strong)]" />
            <div className="mt-2 w-full text-left">
              <div className="font-display text-lg">{trip?.title || 'Your itinerary'}</div>
              <div className="text-xs text-[var(--fg-subtle)]">
                {trip
                  ? `${trip.totalDays} days · ${Math.round(trip.totalMiles)} mi`
                  : 'Swipe up for details'}
              </div>
            </div>
          </button>
          <div className="min-h-0 flex-1 overflow-hidden">
            {mobileSheetExpanded && <ItineraryPanel />}
          </div>
          <div className="flex gap-2 border-t border-[var(--border)] p-3">
            <Button size="sm" variant="accent" className="flex-1" onClick={() => setTripWizardOpen(true)}>
              <Sparkles className="h-4 w-4" /> New trip
            </Button>
            {trip && (
              <>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    saveActiveToLibrary();
                    showToast('Saved', 'success');
                  }}
                >
                  <Save className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="secondary" disabled={posterBusy} onClick={makePoster}>
                  {posterBusy ? <Spinner className="h-4 w-4" /> : <ImageIcon className="h-4 w-4" />}
                </Button>
              </>
            )}
            <Button size="sm" variant="secondary" onClick={() => setManualOpen(true)}>
              <BookOpen className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setScreen('library')}>
              <Library className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </motion.div>

      <TripWizard />
      <AutopilotModal />
      <ManualPlanModal />
      <ChatDrawer />
    </div>
  );
}
