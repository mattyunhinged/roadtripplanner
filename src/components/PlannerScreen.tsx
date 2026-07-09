import { useCallback, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Backpack,
  BookOpen,
  Library,
  MapPinned,
  Plus,
  Save,
  Settings,
  Share2,
  Sparkles,
} from 'lucide-react';
import { v4 as uuid } from 'uuid';
import { BrandLockup, Button } from '@/components/ui';
import { TripMap } from '@/components/TripMap';
import { ItineraryPanel } from '@/components/ItineraryPanel';
import { AutopilotModal } from '@/components/AutopilotModal';
import { ManualPlanModal } from '@/components/ManualPlanModal';
import { ChatDrawer } from '@/components/ChatDrawer';
import { reverseGeocode, searchPlace } from '@/lib/google/maps';
import { recalculateRoutes } from '@/lib/ai/engine';
import { cn } from '@/lib/utils';
import { useTripStore } from '@/stores/tripStore';
import { useUIStore } from '@/stores/uiStore';
import type { Stop } from '@/types';

export function PlannerScreen() {
  const trip = useTripStore((s) => s.activeTrip);
  const addStop = useTripStore((s) => s.addStop);
  const saveActiveToLibrary = useTripStore((s) => s.saveActiveToLibrary);
  const setAutopilotOpen = useUIStore((s) => s.setAutopilotOpen);
  const setManualOpen = useUIStore((s) => s.setManualOpen);
  const setScreen = useUIStore((s) => s.setScreen);
  const mobileSheetExpanded = useUIStore((s) => s.mobileSheetExpanded);
  const setMobileSheetExpanded = useUIStore((s) => s.setMobileSheetExpanded);
  const showToast = useUIStore((s) => s.showToast);
  const [addMode, setAddMode] = useState(false);
  const [search, setSearch] = useState('');

  const onMapClickAdd = useCallback(
    async (lat: number, lng: number) => {
      if (!addMode) return;
      try {
        const place = await reverseGeocode({ lat, lng });
        const dayIndex = trip?.days[trip.days.length - 1]?.index ?? 0;
        const order = trip?.stops.filter((s) => s.dayIndex === dayIndex).length ?? 0;
        const stop: Stop = {
          id: uuid(),
          name: place?.name || 'Custom stop',
          category: 'custom',
          location: { lat, lng },
          placeId: place?.placeId,
          address: place?.address,
          dayIndex,
          order,
          photoUrl: place?.photoUrl,
          photoUrls: place?.photoUrls,
          mapsUrl: place?.mapsUrl,
          aiNotes: 'Added from map click',
        };
        addStop(stop);
        await recalculateRoutes();
        showToast('Stop added', 'success');
        setAddMode(false);
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'Could not add stop', 'error');
      }
    },
    [addMode, addStop, showToast, trip],
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

  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-[var(--bg)]">
      <header className="no-print absolute left-0 right-0 top-0 z-20 map-fade-top px-4 pb-10 pt-4 md:px-6">
        <div className="flex items-center justify-between gap-3">
          <BrandLockup />
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="accent"
              className="shadow-lg"
              onClick={() => setAutopilotOpen(true)}
            >
              <Sparkles className="h-4 w-4" /> Autopilot
            </Button>
            <Button size="sm" variant="secondary" className="hidden sm:inline-flex" onClick={() => setManualOpen(true)}>
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
          <TripMap onMapClickAdd={onMapClickAdd} />

          <div className="no-print absolute left-4 top-24 z-10 flex max-w-md flex-col gap-2 md:left-6">
            <div className="liquid-composer flex gap-2 rounded-2xl p-2">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addFromSearch()}
                placeholder="Search places to add…"
                className="relative z-10 h-10 flex-1 bg-transparent px-2 text-sm outline-none"
              />
              <Button size="sm" variant="secondary" className="relative z-10" onClick={addFromSearch}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <button
              type="button"
              onClick={() => setAddMode((v) => !v)}
              className={cn(
                'glass-panel w-fit rounded-full px-3 py-1.5 text-xs',
                addMode && 'ring-2 ring-[var(--accent)]',
              )}
            >
              {addMode ? 'Click map to drop a stop…' : 'Click map to add stop'}
            </button>
          </div>

          {trip && (
            <div className="no-print absolute right-4 top-24 z-10 hidden flex-col gap-2 md:flex">
              <Button
                size="sm"
                variant="secondary"
                className="glass-panel"
                onClick={() => {
                  saveActiveToLibrary();
                  showToast('Trip saved to library', 'success');
                }}
              >
                <Save className="h-4 w-4" /> Save
              </Button>
              <Button size="sm" variant="secondary" className="glass-panel" onClick={() => setScreen('export')}>
                <Share2 className="h-4 w-4" /> Export
              </Button>
              <Button size="sm" variant="secondary" className="glass-panel" onClick={() => setScreen('packing')}>
                <Backpack className="h-4 w-4" /> Packing
              </Button>
            </div>
          )}
        </div>

        {/* Desktop itinerary */}
        <aside className="no-print glass-strong hidden w-[var(--panel-width)] shrink-0 border-l border-[var(--glass-border)] md:block">
          <ItineraryPanel />
        </aside>
      </div>

      {/* Mobile bottom sheet */}
      <motion.div
        className="no-print absolute inset-x-0 bottom-0 z-20 md:hidden"
        animate={{ height: mobileSheetExpanded ? '70%' : 120 }}
        transition={{ type: 'spring', stiffness: 280, damping: 30 }}
      >
        <div className="flex h-full flex-col overflow-hidden rounded-t-3xl glass-strong border border-[var(--glass-border)] shadow-2xl">
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
          <div className="flex gap-2 border-t border-[var(--glass-border-inner)] p-3">
            <Button size="sm" variant="accent" className="flex-1" onClick={() => setAutopilotOpen(true)}>
              <Sparkles className="h-4 w-4" /> Autopilot
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setManualOpen(true)}>
              <BookOpen className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setScreen('library')}>
              <Library className="h-4 w-4" />
            </Button>
            {trip && (
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
            )}
          </div>
        </div>
      </motion.div>

      <AutopilotModal />
      <ManualPlanModal />
      <ChatDrawer />
    </div>
  );
}
