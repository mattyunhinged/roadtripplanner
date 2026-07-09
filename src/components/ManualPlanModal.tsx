import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { v4 as uuid } from 'uuid';
import { Button, Input, Label } from '@/components/ui';
import { createEmptyTrip, applyBudget, buildDaysFromStops, mergeLegsIntoTrip } from '@/lib/ai/tripPatch';
import { buildDriveLegs, searchPlace, geocodeAddress } from '@/lib/google/maps';
import { useKeysStore } from '@/stores/keysStore';
import { useProfileStore } from '@/stores/profileStore';
import { useTripStore } from '@/stores/tripStore';
import { useUIStore } from '@/stores/uiStore';
import type { Stop } from '@/types';

export function ManualPlanModal() {
  const open = useUIStore((s) => s.manualOpen);
  const setOpen = useUIStore((s) => s.setManualOpen);
  const showToast = useUIStore((s) => s.showToast);
  const profile = useProfileStore((s) => s.profile);
  const setActiveTrip = useTripStore((s) => s.setActiveTrip);
  const mapsKey = useKeysStore((s) => s.keys?.googleMapsKey);

  const [origin, setOrigin] = useState(profile.home?.address || '');
  const [destination, setDestination] = useState('');
  const [extraDest, setExtraDest] = useState('');
  const [startDate, setStartDate] = useState('');
  const [days, setDays] = useState(3);
  const [travelers, setTravelers] = useState(2);
  const [roundTrip, setRoundTrip] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const originRef = useRef<HTMLInputElement>(null);
  const destRef = useRef<HTMLInputElement>(null);
  const extraRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open || !mapsKey || !window.google?.maps?.places) return;
    const bind = (el: HTMLInputElement | null, setter: (v: string) => void) => {
      if (!el) return;
      const ac = new google.maps.places.Autocomplete(el, {
        fields: ['formatted_address', 'geometry', 'place_id', 'name'],
      });
      ac.addListener('place_changed', () => {
        const place = ac.getPlace();
        setter(place.formatted_address || place.name || '');
      });
    };
    bind(originRef.current, setOrigin);
    bind(destRef.current, setDestination);
    bind(extraRef.current, setExtraDest);
  }, [open, mapsKey]);

  async function createTrip() {
    setBusy(true);
    setError('');
    try {
      const originPlace =
        (await searchPlace(origin)) ||
        (await geocodeAddress(origin)) ||
        (profile.home
          ? {
              placeId: profile.home.placeId || '',
              name: profile.home.address,
              address: profile.home.address,
              location: profile.home.location,
            }
          : null);
      if (!originPlace) throw new Error('Could not resolve origin');

      const destQueries = [destination, extraDest].filter(Boolean);
      if (!destQueries.length) throw new Error('Add at least one destination');

      const destPlaces = [];
      for (const q of destQueries) {
        const place = (await searchPlace(q)) || (await geocodeAddress(q));
        if (place) destPlaces.push(place);
      }
      if (!destPlaces.length) throw new Error('Could not resolve destination');

      const stops: Stop[] = [];
      let order = 0;
      stops.push({
        id: uuid(),
        name: originPlace.name,
        category: 'origin',
        location: originPlace.location,
        placeId: originPlace.placeId,
        address: originPlace.address,
        dayIndex: 0,
        order: order++,
        aiNotes: 'Trip start',
      });

      destPlaces.forEach((place, i) => {
        const dayIndex = Math.min(days - 1, i + 1);
        stops.push({
          id: uuid(),
          name: place.name,
          category: 'destination',
          location: place.location,
          placeId: place.placeId,
          address: place.address,
          dayIndex,
          order: order++,
          aiNotes: 'Manual destination',
        });
      });

      if (roundTrip) {
        stops.push({
          id: uuid(),
          name: originPlace.name,
          category: 'destination',
          location: originPlace.location,
          placeId: originPlace.placeId,
          address: originPlace.address,
          dayIndex: Math.max(0, days - 1),
          order: order++,
          aiNotes: 'Return home',
        });
      }

      // distribute day indices evenly
      const totalStops = stops.length;
      stops.forEach((s, i) => {
        s.dayIndex = Math.min(days - 1, Math.floor((i / Math.max(1, totalStops - 1)) * (days - 1)));
        s.order = i;
      });

      // add placeholder lodging nights
      for (let d = 0; d < days - (roundTrip ? 0 : 1); d++) {
        const anchor = stops.find((s) => s.dayIndex === d) || stops[Math.min(d, stops.length - 1)];
        stops.push({
          id: uuid(),
          name: `Lodging near ${anchor.name}`,
          category: 'lodging',
          location: anchor.location,
          dayIndex: d,
          order: 50 + d,
          aiNotes: 'Add or ask AI to pick lodging',
          costEstimate: 140,
        });
      }

      const dayDefs = Array.from({ length: days }, (_, index) => ({
        index,
        title: `Day ${index + 1}`,
        summary: '',
        date: startDate || undefined,
      }));

      let trip = createEmptyTrip({
        title: `${originPlace.name.split(',')[0]} → ${destPlaces[0].name.split(',')[0]}`,
        vibe: 'Manually planned roadtrip — refine with Autopilot or Ask AI.',
        origin: {
          lat: originPlace.location.lat,
          lng: originPlace.location.lng,
          address: originPlace.address || originPlace.name,
          placeId: originPlace.placeId,
        },
        destinations: destPlaces.map((p) => ({
          lat: p.location.lat,
          lng: p.location.lng,
          address: p.address || p.name,
          placeId: p.placeId,
          name: p.name,
        })),
        roundTrip,
        startDate: startDate || undefined,
        travelers,
        totalDays: days,
        stops,
        days: buildDaysFromStops(stops, dayDefs),
      });

      const legs = await buildDriveLegs(trip.stops, profile.maxDriveHoursPerDay);
      trip = mergeLegsIntoTrip(trip, legs);
      trip = applyBudget(
        trip,
        profile,
        useKeysStore.getState().settings.vehicleMpg ?? profile.vehicle?.mpg ?? null,
      );
      setActiveTrip(trip);
      showToast('Trip scaffold created — add stops or ask AI to flesh it out', 'success');
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create trip');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center bg-[var(--bg-overlay)] p-4 sm:items-center no-print"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => !busy && setOpen(false)}
        >
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="liquid-composer max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[28px] p-6"
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-2xl">Manual planning</h2>
              <button type="button" onClick={() => setOpen(false)} className="rounded-full p-2 hover:bg-[var(--bg-muted)]">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <Label>Origin</Label>
                <input
                  ref={originRef}
                  value={origin}
                  onChange={(e) => setOrigin(e.target.value)}
                  className="h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3"
                />
              </div>
              <div>
                <Label>Destination</Label>
                <input
                  ref={destRef}
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  className="h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3"
                />
              </div>
              <div>
                <Label>Extra destination (optional)</Label>
                <input
                  ref={extraRef}
                  value={extraDest}
                  onChange={(e) => setExtraDest(e.target.value)}
                  className="h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Start date</Label>
                  <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                </div>
                <div>
                  <Label>Days</Label>
                  <Input
                    type="number"
                    min={1}
                    max={21}
                    value={days}
                    onChange={(e) => setDays(Number(e.target.value) || 1)}
                  />
                </div>
                <div>
                  <Label>Travelers</Label>
                  <Input
                    type="number"
                    min={1}
                    max={12}
                    value={travelers}
                    onChange={(e) => setTravelers(Number(e.target.value) || 1)}
                  />
                </div>
                <div className="flex items-end pb-2">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={roundTrip}
                      onChange={(e) => setRoundTrip(e.target.checked)}
                      className="accent-[var(--accent)]"
                    />
                    Round trip
                  </label>
                </div>
              </div>
              {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}
              <Button className="w-full" variant="accent" disabled={busy} onClick={createTrip}>
                {busy ? 'Building…' : 'Create trip scaffold'}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
