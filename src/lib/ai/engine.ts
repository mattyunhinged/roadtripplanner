import { v4 as uuid } from 'uuid';
import { getAIProvider, extractJSON } from '@/lib/ai/provider';
import { AUTOPILOT_SYSTEM, autopilotUserPrompt, COPILOT_SYSTEM, askAiPrompt, PACKING_SYSTEM, profilePrompt, tripContextPrompt } from '@/lib/ai/prompts';
import { draftTripSchema, tripEditResponseSchema, packingListSchema, type DraftTrip } from '@/lib/ai/schemas';
import {
  applyBudget,
  buildDaysFromStops,
  createEmptyTrip,
  draftStopToStop,
  mergeLegsIntoTrip,
  recomputeDayTotals,
} from '@/lib/ai/tripPatch';
import {
  buildDriveLegs,
  findFuelAlongRoute,
  geocodeAddress,
  searchPlace,
} from '@/lib/google/maps';
import type { AutopilotProgress, PackingItem, Stop, TravelerProfile, Trip } from '@/types';
import { useKeysStore } from '@/stores/keysStore';
import { useProfileStore } from '@/stores/profileStore';
import { useTripStore } from '@/stores/tripStore';
import { useUIStore } from '@/stores/uiStore';
import { friendlyError } from '@/lib/utils';

function progress(step: string, detail: string, percent: number) {
  useUIStore.getState().setAutopilotProgress({ step, detail, percent });
}

async function resolveDraftTrip(draft: DraftTrip, profile: TravelerProfile): Promise<Trip> {
  const home = profile.home;
  const originQuery = draft.originQuery || home?.address || 'United States';
  progress('Mapping the start', `Geocoding ${originQuery}…`, 20);

  let originPlace = home
    ? {
        placeId: home.placeId,
        name: home.address,
        address: home.address,
        location: home.location,
      }
    : await geocodeAddress(originQuery);

  if (!originPlace) {
    originPlace = await searchPlace(originQuery);
  }
  if (!originPlace) {
    throw new Error('Could not resolve trip origin. Check your home address or prompt.');
  }

  const destinations = [];
  for (const q of draft.destinationQueries) {
    progress('Choosing destinations', `Looking up ${q}…`, 28);
    const place = (await searchPlace(q)) || (await geocodeAddress(q));
    if (place) {
      destinations.push({
        ...place.location,
        address: place.address || place.name,
        placeId: place.placeId,
        name: place.name,
      });
    }
  }

  const stops: Stop[] = [];
  const total = draft.stops.length || 1;

  for (let i = 0; i < draft.stops.length; i++) {
    const draftStop = draft.stops[i];
    progress(
      'Finding real places',
      draft.progressHints?.[Math.min(i, (draft.progressHints.length || 1) - 1)] ||
        `Resolving ${draftStop.name}…`,
      30 + Math.round((i / total) * 40),
    );

    const near = draftStop.approximateLocation || originPlace.location;
    let resolved =
      (await searchPlace(draftStop.searchQuery, near)) ||
      (await searchPlace(draftStop.name, near)) ||
      null;

    if (!resolved && draftStop.approximateLocation) {
      resolved = {
        placeId: '',
        name: draftStop.name,
        location: draftStop.approximateLocation,
        address: draftStop.name,
      };
    }

    if (!resolved) {
      // keep approximate so trip still works
      resolved = {
        placeId: '',
        name: draftStop.name,
        location: near,
        address: draftStop.searchQuery,
      };
    }

    stops.push(
      draftStopToStop(draftStop, {
        name: resolved.name,
        location: resolved.location,
        placeId: resolved.placeId,
        address: resolved.address,
        rating: resolved.rating,
        priceLevel: resolved.priceLevel,
        hours: resolved.hours,
        photoUrl: resolved.photoUrl,
        website: resolved.website,
        phone: resolved.phone,
        costEstimate: draftStop.costEstimate,
      }),
    );
  }

  // Ensure origin exists as first stop if missing
  if (!stops.some((s) => s.category === 'origin')) {
    stops.unshift({
      id: uuid(),
      name: originPlace.name,
      category: 'origin',
      location: originPlace.location,
      placeId: originPlace.placeId,
      address: originPlace.address,
      dayIndex: 0,
      order: 0,
      aiNotes: 'Trip start',
    });
  }

  progress('Plotting the route', 'Calling Google Directions for real drive times…', 75);

  const maxHours = profile.maxDriveHoursPerDay;
  let legs = await buildDriveLegs(stops, maxHours);

  // Fuel suggestions on long legs
  progress('Fuel & timing', 'Adding fuel stops on long legs…', 85);
  const fuelStops: Stop[] = [];
  for (const leg of legs.filter((l) => l.fuelSuggested)) {
    const from = stops.find((s) => s.id === leg.fromStopId);
    const to = stops.find((s) => s.id === leg.toStopId);
    if (!from || !to) continue;
    const fuel = await findFuelAlongRoute(from.location, to.location);
    if (!fuel) continue;
    const fuelStop: Stop = {
      id: uuid(),
      name: fuel.name,
      category: 'fuel',
      location: fuel.location,
      placeId: fuel.placeId,
      address: fuel.address,
      dayIndex: leg.dayIndex,
      order: from.order + 0.5,
      rating: fuel.rating,
      photoUrl: fuel.photoUrl,
      aiNotes: 'Suggested fuel stop for a long driving leg',
      costEstimate: 50,
    };
    fuelStops.push(fuelStop);
  }

  let allStops = [...stops, ...fuelStops]
    .map((s, idx) => ({ ...s, order: s.order }))
    .sort((a, b) => a.dayIndex - b.dayIndex || a.order - b.order);

  // Normalize orders per day
  const byDay = new Map<number, Stop[]>();
  for (const s of allStops) {
    const list = byDay.get(s.dayIndex) || [];
    list.push(s);
    byDay.set(s.dayIndex, list);
  }
  allStops = [];
  for (const [dayIndex, list] of [...byDay.entries()].sort((a, b) => a[0] - b[0])) {
    list
      .sort((a, b) => a.order - b.order)
      .forEach((s, order) => allStops.push({ ...s, dayIndex, order }));
  }

  if (fuelStops.length) {
    legs = await buildDriveLegs(allStops, maxHours);
  }

  const days = buildDaysFromStops(allStops, draft.days);
  const mpg = useKeysStore.getState().settings.vehicleMpg ?? draft.assumedMpg ?? null;

  let trip = createEmptyTrip({
    title: draft.title,
    vibe: draft.vibe,
    prompt: undefined,
    origin: {
      lat: originPlace.location.lat,
      lng: originPlace.location.lng,
      address: originPlace.address || originPlace.name,
      placeId: originPlace.placeId,
    },
    destinations,
    roundTrip: draft.roundTrip,
    travelers: profile.partyType === 'solo' ? 1 : profile.partyType === 'family' ? 4 : 2,
    days,
    stops: allStops,
    legs,
    totalDays: draft.totalDays,
  });

  trip = mergeLegsIntoTrip(trip, legs);
  trip = applyBudget(trip, profile, mpg);
  return trip;
}

export async function runAutopilot(userPrompt: string): Promise<Trip> {
  const keys = useKeysStore.getState().keys;
  if (!keys) throw new Error('Add your API keys first.');
  const profile = useProfileStore.getState().profile;
  const model = useKeysStore.getState().currentModel();
  const provider = getAIProvider(keys.aiProvider);

  try {
    progress('Warming up Autopilot', 'Reading your traveler profile…', 5);

    const hints = [
      'Sketching destinations that match your vibe…',
      'Balancing drive days against your max hours…',
      'Picking lodging and dinner stops…',
    ];
    hints.forEach((h, i) => {
      window.setTimeout(() => {
        if (useUIStore.getState().autopilotProgress) {
          progress('Planning', h, 8 + i * 3);
        }
      }, 400 * (i + 1));
    });

    const content = await provider.complete(keys.aiKey, model, {
      messages: [
        { role: 'system', content: AUTOPILOT_SYSTEM },
        {
          role: 'user',
          content: autopilotUserPrompt({
            prompt: userPrompt,
            profile,
            mpg: useKeysStore.getState().settings.vehicleMpg,
          }),
        },
      ],
      jsonMode: true,
      temperature: 0.8,
      maxTokens: 8000,
    });

    progress('Draft ready', 'Validating itinerary structure…', 18);
    const raw = extractJSON<unknown>(content);
    const draft = draftTripSchema.parse(raw);

    if (draft.progressHints?.length) {
      progress('On the road', draft.progressHints[0], 22);
    }

    const trip = await resolveDraftTrip(draft, profile);
    trip.prompt = userPrompt;

    progress('Almost there', 'Syncing map and budget…', 95);
    useTripStore.getState().setActiveTrip(trip);
    useUIStore.getState().setDayFilter('all');
    progress('Trip ready', trip.title, 100);
    return trip;
  } catch (error) {
    throw new Error(friendlyError(error, 'Autopilot could not finish this trip'));
  } finally {
    window.setTimeout(() => useUIStore.getState().setAutopilotProgress(null), 800);
  }
}

export async function runTripEdit(userMessage: string, focusStop?: Stop): Promise<string> {
  const keys = useKeysStore.getState().keys;
  if (!keys) throw new Error('Add your API keys first.');
  const trip = useTripStore.getState().activeTrip;
  const profile = useProfileStore.getState().profile;
  const model = useKeysStore.getState().currentModel();
  const provider = getAIProvider(keys.aiProvider);

  const content = await provider.complete(keys.aiKey, model, {
    messages: [
      { role: 'system', content: COPILOT_SYSTEM },
      {
        role: 'user',
        content: `${askAiPrompt('copilot', userMessage, trip, focusStop)}\n\nTraveler:\n${profilePrompt(profile)}`,
      },
    ],
    jsonMode: true,
    temperature: 0.6,
  });

  const parsed = tripEditResponseSchema.parse(extractJSON(content));
  await applyEditResponse(parsed);
  return parsed.message;
}

export async function runAskAi(kind: string, context: string, stop?: Stop): Promise<string> {
  return runTripEdit(`${kind}: ${context}`, stop);
}

async function applyEditResponse(
  parsed: ReturnType<typeof tripEditResponseSchema.parse>,
): Promise<void> {
  const profile = useProfileStore.getState().profile;
  const store = useTripStore.getState();

  if (parsed.action === 'replace' && parsed.fullTrip) {
    const trip = await resolveDraftTrip(parsed.fullTrip, profile);
    store.setActiveTrip(trip);
    return;
  }

  if (parsed.action === 'reply' && !parsed.stopsToAdd && !parsed.stopIdsToRemove && !parsed.stopUpdates && !parsed.reorder && !parsed.packingList) {
    return;
  }

  const current = store.activeTrip;
  if (!current) {
    if (parsed.fullTrip) {
      const trip = await resolveDraftTrip(parsed.fullTrip, profile);
      store.setActiveTrip(trip);
    }
    return;
  }

  let trip: Trip = { ...current, stops: [...current.stops], days: [...current.days] };

  if (parsed.title) trip.title = parsed.title;
  if (parsed.vibe) trip.vibe = parsed.vibe;

  if (parsed.stopIdsToRemove?.length) {
    const remove = new Set(parsed.stopIdsToRemove);
    trip.stops = trip.stops.filter((s) => !remove.has(s.id));
  }

  if (parsed.stopUpdates?.length) {
    for (const update of parsed.stopUpdates) {
      const idx = trip.stops.findIndex((s) => s.id === update.id);
      if (idx < 0) continue;
      let stop = { ...trip.stops[idx], ...update };
      if (update.searchQuery) {
        const resolved = await searchPlace(update.searchQuery, stop.location);
        if (resolved) {
          stop = {
            ...stop,
            name: resolved.name,
            location: resolved.location,
            placeId: resolved.placeId,
            address: resolved.address,
            rating: resolved.rating,
            priceLevel: resolved.priceLevel,
            hours: resolved.hours,
            photoUrl: resolved.photoUrl,
            website: resolved.website,
            phone: resolved.phone,
          };
        }
      }
      trip.stops[idx] = stop;
    }
  }

  if (parsed.stopsToAdd?.length) {
    for (const draft of parsed.stopsToAdd) {
      const near = draft.approximateLocation || trip.origin;
      const resolved = (await searchPlace(draft.searchQuery, near)) || (await searchPlace(draft.name, near));
      trip.stops.push(
        draftStopToStop(draft, resolved || { location: near, name: draft.name }),
      );
    }
  }

  if (parsed.reorder?.length) {
    for (const group of parsed.reorder) {
      const ordered = group.stopIds
        .map((id, order) => {
          const stop = trip.stops.find((s) => s.id === id);
          return stop ? { ...stop, dayIndex: group.dayIndex, order } : null;
        })
        .filter(Boolean) as Stop[];
      const others = trip.stops.filter((s) => !group.stopIds.includes(s.id));
      trip.stops = [...others, ...ordered];
    }
  }

  if (parsed.packingList?.length) {
    trip.packingList = parsed.packingList.map((item) => ({
      id: uuid(),
      label: item.label,
      category: item.category,
      packed: false,
    }));
  }

  trip.days = buildDaysFromStops(trip.stops, trip.days.map((d) => ({ index: d.index, title: d.title, summary: d.summary, date: d.date })));
  const legs = await buildDriveLegs(trip.stops, profile.maxDriveHoursPerDay);
  trip = mergeLegsIntoTrip(trip, legs);
  trip = applyBudget(trip, profile, useKeysStore.getState().settings.vehicleMpg);
  store.setActiveTrip(recomputeDayTotals(trip));
}

export async function generatePackingList(): Promise<PackingItem[]> {
  const keys = useKeysStore.getState().keys;
  if (!keys) throw new Error('Add your API keys first.');
  const trip = useTripStore.getState().activeTrip;
  if (!trip) throw new Error('Create a trip first.');
  const profile = useProfileStore.getState().profile;
  const model = useKeysStore.getState().currentModel();
  const provider = getAIProvider(keys.aiProvider);

  const content = await provider.complete(keys.aiKey, model, {
    messages: [
      { role: 'system', content: PACKING_SYSTEM },
      {
        role: 'user',
        content: `Create a packing list.\n${tripContextPrompt(trip)}\n${profilePrompt(profile)}\nSeason/context from vibe: ${trip.vibe}`,
      },
    ],
    jsonMode: true,
  });

  const parsed = packingListSchema.parse(extractJSON(content));
  const items = parsed.items.map((item) => ({
    id: uuid(),
    label: item.label,
    category: item.category,
    packed: false,
  }));

  useTripStore.getState().updateActiveTrip((t) => ({ ...t, packingList: items }));
  return items;
}

export async function recalculateRoutes(): Promise<void> {
  const trip = useTripStore.getState().activeTrip;
  if (!trip || trip.stops.length < 2) return;
  const profile = useProfileStore.getState().profile;
  const legs = await buildDriveLegs(trip.stops, profile.maxDriveHoursPerDay);
  let next = mergeLegsIntoTrip(trip, legs);
  next = applyBudget(next, profile, useKeysStore.getState().settings.vehicleMpg);
  useTripStore.getState().setActiveTrip(next);
}
