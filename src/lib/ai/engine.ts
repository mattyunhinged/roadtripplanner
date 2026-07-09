import { v4 as uuid } from 'uuid';
import { getAIProvider, extractJSON } from '@/lib/ai/provider';
import {
  AUTOPILOT_SYSTEM,
  autopilotUserPrompt,
  COPILOT_SYSTEM,
  askAiPrompt,
  PACKING_SYSTEM,
  profilePrompt,
  tripContextPrompt,
} from '@/lib/ai/prompts';
import {
  draftTripSchema,
  tripEditResponseSchema,
  packingListSchema,
  type DraftTrip,
} from '@/lib/ai/schemas';
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
  placeMapsUrl,
  searchPlace,
} from '@/lib/google/maps';
import type { AutopilotPhase, PackingItem, Stop, TravelerProfile, Trip, TripPrefs } from '@/types';
import { useKeysStore } from '@/stores/keysStore';
import { useProfileStore } from '@/stores/profileStore';
import { useTripStore } from '@/stores/tripStore';
import { useUIStore } from '@/stores/uiStore';
import { friendlyError } from '@/lib/utils';

function log(
  text: string,
  opts: {
    phase?: AutopilotPhase;
    kind?: 'status' | 'thought' | 'place' | 'route' | 'success' | 'warn';
    step?: string;
    percent?: number;
    streamPreview?: string;
  } = {},
) {
  useUIStore.getState().pushAutopilotLog(text, opts);
}

function progress(step: string, detail: string, percent: number, phase?: AutopilotPhase) {
  log(detail, { step, percent, phase, kind: 'status' });
}

function extractPartialHints(buffer: string): string[] {
  const hints: string[] = [];
  const title = buffer.match(/"title"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/);
  if (title?.[1]) hints.push(`naming it “${title[1].slice(0, 48)}”…`);
  const vibe = buffer.match(/"vibe"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/);
  if (vibe?.[1]) hints.push(`vibe check: ${vibe[1].slice(0, 72)}`);
  const stopNames = [...buffer.matchAll(/"name"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/g)].map(
    (m) => m[1],
  );
  if (stopNames.length) {
    const latest = stopNames[stopNames.length - 1];
    hints.push(`eyeing ${latest}`);
  }
  const days = buffer.match(/"totalDays"\s*:\s*(\d+)/);
  if (days?.[1]) hints.push(`shaping a ${days[1]}-day arc…`);
  if (buffer.includes('"isSideQuest": true') || buffer.includes('"isSideQuest":true')) {
    hints.push('sneaking in a side quest…');
  }
  return hints;
}

async function resolveDraftTrip(draft: DraftTrip, profile: TravelerProfile): Promise<Trip> {
  const home = profile.home;
  const originQuery = draft.originQuery || home?.address || 'United States';
  progress('pinning home', `geocoding ${originQuery}…`, 22, 'places');

  let originPlace = home
    ? {
        placeId: home.placeId,
        name: home.address,
        address: home.address,
        location: home.location,
        photoUrl: undefined as string | undefined,
        photoUrls: undefined as string[] | undefined,
        mapsUrl: placeMapsUrl({
          placeId: home.placeId,
          address: home.address,
          location: home.location,
        }),
      }
    : await geocodeAddress(originQuery);

  if (!originPlace) {
    originPlace = await searchPlace(originQuery);
  }
  if (!originPlace) {
    throw new Error('Could not resolve trip origin. Check your home address or prompt.');
  }

  log(`start locked · ${originPlace.address || originPlace.name}`, {
    phase: 'places',
    kind: 'place',
    percent: 25,
  });

  const destinations = [];
  for (const q of draft.destinationQueries) {
    progress('scouting destinations', `looking up ${q}…`, 28, 'places');
    const place = (await searchPlace(q)) || (await geocodeAddress(q));
    if (place) {
      destinations.push({
        ...place.location,
        address: place.address || place.name,
        placeId: place.placeId,
        name: place.name,
      });
      log(`found · ${place.name}`, { phase: 'places', kind: 'place', percent: 30 });
    }
  }

  const stops: Stop[] = [];
  const total = draft.stops.length || 1;

  for (let i = 0; i < draft.stops.length; i++) {
    const draftStop = draft.stops[i];
    const hint =
      draft.progressHints?.[Math.min(i, (draft.progressHints.length || 1) - 1)] ||
      `Resolving ${draftStop.name}…`;
    progress('finding real places', hint, 32 + Math.round((i / total) * 38), 'places');

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
        mapsUrl: placeMapsUrl({
          name: draftStop.name,
          location: draftStop.approximateLocation,
        }),
      };
    }

    if (!resolved) {
      resolved = {
        placeId: '',
        name: draftStop.name,
        location: near,
        address: draftStop.searchQuery,
        mapsUrl: placeMapsUrl({ name: draftStop.name, location: near }),
      };
      log(`approx pin for ${draftStop.name} (Places was shy)`, {
        phase: 'places',
        kind: 'warn',
        percent: 32 + Math.round((i / total) * 38),
      });
    } else {
      log(
        `${draftStop.isSideQuest ? '✦ side quest · ' : ''}${resolved.photoUrl ? '📷 ' : ''}${resolved.name}${resolved.rating ? ` · ★ ${resolved.rating.toFixed(1)}` : ''}`,
        { phase: 'places', kind: 'place', percent: 32 + Math.round((i / total) * 38) },
      );
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
        photoUrls: resolved.photoUrls,
        mapsUrl: resolved.mapsUrl,
        website: resolved.website,
        phone: resolved.phone,
        costEstimate: draftStop.costEstimate,
      }),
    );
  }

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
      photoUrl: originPlace.photoUrl,
      photoUrls: originPlace.photoUrls,
      mapsUrl: originPlace.mapsUrl || placeMapsUrl(originPlace),
    });
  }

  progress('drawing the route', 'Google Directions doing the math…', 75, 'routing');

  const maxHours = profile.maxDriveHoursPerDay;
  let legs = await buildDriveLegs(stops, maxHours);
  log(`${legs.length} driving legs locked`, { phase: 'routing', kind: 'route', percent: 78 });

  const over = legs.filter((l) => l.exceedsMaxDrive);
  if (over.length) {
    log(`heads up · ${over.length} leg(s) over your ${maxHours}h/day max`, {
      phase: 'routing',
      kind: 'warn',
      percent: 80,
    });
  }

  progress(
    profile.vehicle?.fuelType === 'electric' ? 'charge check' : 'fuel check',
    profile.vehicle?.fuelType === 'electric'
      ? 'scouting EV-friendly towns on long legs…'
      : 'dropping fuel stops on the long hauls…',
    85,
    'routing',
  );
  const fuelStops: Stop[] = [];
  const fuelQuery =
    profile.vehicle?.fuelType === 'electric'
      ? 'EV charging station'
      : profile.vehicle?.fuelType === 'diesel'
        ? 'diesel gas station'
        : 'gas station';
  for (const leg of legs.filter((l) => l.fuelSuggested)) {
    const from = stops.find((s) => s.id === leg.fromStopId);
    const to = stops.find((s) => s.id === leg.toStopId);
    if (!from || !to) continue;
    const mid = {
      lat: (from.location.lat + to.location.lat) / 2,
      lng: (from.location.lng + to.location.lng) / 2,
    };
    const fuel =
      (await searchPlace(fuelQuery, mid)) || (await findFuelAlongRoute(from.location, to.location));
    if (!fuel) continue;
    log(
      `${profile.vehicle?.fuelType === 'electric' ? 'charge' : 'fuel'} · ${fuel.name}`,
      { phase: 'routing', kind: 'place', percent: 88 },
    );
    fuelStops.push({
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
      photoUrls: fuel.photoUrls,
      mapsUrl: fuel.mapsUrl,
      aiNotes:
        profile.vehicle?.fuelType === 'electric'
          ? 'Charge stop for a long EV leg'
          : 'Suggested fuel stop for a long driving leg',
      costEstimate: profile.vehicle?.fuelType === 'electric' ? 25 : 50,
    });
  }

  let allStops = [...stops, ...fuelStops].sort(
    (a, b) => a.dayIndex - b.dayIndex || a.order - b.order,
  );

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

  progress('running the numbers', 'fuel · stay · eats · fun…', 92, 'budget');

  const days = buildDaysFromStops(allStops, draft.days);
  const mpg =
    useKeysStore.getState().settings.vehicleMpg ??
    profile.vehicle?.mpg ??
    draft.assumedMpg ??
    null;

  let trip = createEmptyTrip({
    title: draft.title,
    vibe: draft.vibe,
    origin: {
      lat: originPlace.location.lat,
      lng: originPlace.location.lng,
      address: originPlace.address || originPlace.name,
      placeId: originPlace.placeId,
    },
    destinations,
    roundTrip: draft.roundTrip,
    travelers: Math.max(1, 1 + (profile.guests?.length || 0)),
    days,
    stops: allStops,
    legs,
    totalDays: draft.totalDays,
  });

  trip = mergeLegsIntoTrip(trip, legs);
  trip = applyBudget(trip, profile, mpg);
  log(`~$${Math.round(trip.budget.total)} · ${Math.round(trip.totalMiles)} mi`, {
    phase: 'budget',
    kind: 'success',
    percent: 94,
  });
  return trip;
}

export async function runAutopilot(
  userPrompt: string,
  prefs?: Partial<TripPrefs>,
): Promise<Trip> {
  const keys = useKeysStore.getState().keys;
  if (!keys) throw new Error('Add your API keys first.');
  const profile = useProfileStore.getState().profile;
  const model = useKeysStore.getState().currentModel();
  const provider = getAIProvider(keys.aiProvider);
  const effectiveMpg =
    useKeysStore.getState().settings.vehicleMpg ?? profile.vehicle?.mpg ?? null;

  useUIStore.getState().setAutopilotProgress({
    step: 'warming up',
    detail: 'reading your traveler profile…',
    percent: 2,
    phase: 'thinking',
    log: [],
  });

  try {
    log('skimming your traveler profile…', {
      phase: 'thinking',
      kind: 'status',
      step: 'warming up',
      percent: 4,
    });
    if (profile.displayName) {
      log(`hey ${profile.displayName} — cooking your route…`, {
        phase: 'thinking',
        kind: 'thought',
        percent: 5,
      });
    }
    log(
      `${profile.travelStyle} · ${profile.budgetLevel} · max ${profile.maxDriveHoursPerDay}h/day · crew ${1 + (profile.guests?.length || 0)}`,
      { phase: 'thinking', kind: 'thought', percent: 6 },
    );
    if (profile.vehicle) {
      log(
        `rolling in a ${profile.vehicle.brandName} ${profile.vehicle.modelName} (${profile.vehicle.fuelType})`,
        { phase: 'thinking', kind: 'thought', percent: 7 },
      );
    }
    if (prefs?.highwayPreference) {
      log(`roads: ${prefs.highwayPreference}`, { phase: 'thinking', kind: 'thought', percent: 8 });
    }
    if (prefs?.generationSpeed) {
      log(
        prefs.generationSpeed === 'fast' ? 'fast mode · lean & mean' : 'beautiful mode · extra sauce',
        { phase: 'thinking', kind: 'thought', percent: 8 },
      );
    }

    let lastHintAt = 0;
    let tokenCount = 0;
    const content = await provider.stream(keys.aiKey, model, {
      messages: [
        { role: 'system', content: AUTOPILOT_SYSTEM },
        {
          role: 'user',
          content: autopilotUserPrompt({
            prompt: userPrompt,
            profile,
            mpg: effectiveMpg,
            prefs,
          }),
        },
      ],
      jsonMode: true,
      temperature: prefs?.generationSpeed === 'fast' ? 0.6 : 0.85,
      maxTokens: prefs?.generationSpeed === 'fast' ? 5000 : 8000,
      onToken: (token) => {
        tokenCount += 1;
        const current = useUIStore.getState().autopilotProgress;
        const buffer = (current?.streamPreview || '') + token;
        const preview = buffer.slice(-280);
        const now = Date.now();
        if (now - lastHintAt > 700) {
          lastHintAt = now;
          const hints = extractPartialHints(buffer);
          const hint = hints[hints.length - 1] || 'plotting chaos in a good way…';
          const pct = Math.min(20, 8 + Math.floor(tokenCount / 40));
          log(hint, {
            phase: 'thinking',
            kind: 'thought',
            step: 'autopilot is cooking',
            percent: pct,
            streamPreview: preview,
          });
        } else {
          useUIStore.getState().setAutopilotProgress({
            step: current?.step || 'autopilot is cooking',
            detail: current?.detail || 'Streaming…',
            percent: Math.min(20, 8 + Math.floor(tokenCount / 40)),
            phase: 'thinking',
            log: current?.log || [],
            streamPreview: preview,
          });
        }
      },
    });

    progress('draft locked', 'validating the itinerary…', 21, 'thinking');
    const raw = extractJSON<unknown>(content);
    const draft = draftTripSchema.parse(raw);
    log(`locked: ${draft.title} · ${draft.totalDays} days`, {
      phase: 'thinking',
      kind: 'success',
      percent: 22,
    });

    if (draft.progressHints?.length) {
      for (const hint of draft.progressHints.slice(0, 3)) {
        log(hint, { phase: 'places', kind: 'thought', percent: 23 });
      }
    }

    // Prefer wizard start over draft origin when provided
    if (prefs?.startAddress) {
      draft.originQuery = prefs.startAddress;
    }

    const trip = await resolveDraftTrip(draft, profile);
    trip.prompt = userPrompt;
    trip.highwayPreference = prefs?.highwayPreference || profile.highwayPreference;
    trip.activityTags = prefs?.activityTags?.length
      ? prefs.activityTags
      : profile.activityTags;
    trip.generationSpeed = prefs?.generationSpeed || 'beautiful';

    if (prefs?.startLocation) {
      trip.origin = {
        lat: prefs.startLocation.lat,
        lng: prefs.startLocation.lng,
        address: prefs.startAddress || trip.origin.address,
        placeId: prefs.startPlaceId,
      };
    }

    progress('almost', 'syncing map + budget…', 96, 'done');
    useTripStore.getState().setActiveTrip(trip);
    useUIStore.getState().setDayFilter('all');
    log(`you're so in · ${trip.title}`, {
      phase: 'done',
      kind: 'success',
      step: 'trip ready',
      percent: 100,
    });
    return trip;
  } catch (error) {
    log(friendlyError(error, 'autopilot glitched — try again'), {
      phase: 'error',
      kind: 'warn',
      step: 'oops',
    });
    throw new Error(friendlyError(error, 'Autopilot could not finish this trip'));
  }
}

export async function generateTripBoard(trip?: Trip | null): Promise<string> {
  const keys = useKeysStore.getState().keys;
  if (!keys) throw new Error('Add your API keys first.');
  if (keys.aiProvider !== 'openai') {
    throw new Error('Trip Board art uses OpenAI Images — switch to an OpenAI key in Settings.');
  }
  const active = trip || useTripStore.getState().activeTrip;
  if (!active) throw new Error('Create a trip first.');

  log('Painting your Trip Board with OpenAI Images…', {
    phase: 'board',
    kind: 'status',
    step: 'Trip Board',
    percent: 10,
  });

  const highlights = active.stops
    .filter((s) => s.category !== 'fuel' && s.category !== 'origin')
    .slice(0, 8)
    .map((s) => s.name)
    .join(', ');

  const prompt = [
    'Create a premium editorial travel trip board poster, cinematic and tasteful.',
    `Trip title: "${active.title}".`,
    `Vibe: ${active.vibe}.`,
    `${active.totalDays} days, about ${Math.round(active.totalMiles)} miles.`,
    `Key places: ${highlights || active.origin.address}.`,
    'Layout: magazine-style collage mood board with a bold title area, soft landscape photography aesthetic,',
    'road-trip horizon motif, warm amber and cool teal accents, liquid glass light reflections,',
    'no logos, no watermarks, no UI chrome, no readable tiny text except a tasteful title treatment.',
    'Ultra high quality, photoreal scenic collage feel.',
  ].join(' ');

  const response = await fetch('/api/ai/images', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      apiKey: keys.aiKey,
      prompt,
      size: '1536x1024',
      quality: 'high',
    }),
  });

  const data = (await response.json()) as {
    error?: string;
    b64?: string;
    url?: string;
    model?: string;
  };

  if (!response.ok) {
    throw new Error(data.error || 'Trip Board generation failed');
  }

  const imageUrl = data.b64
    ? `data:image/png;base64,${data.b64}`
    : data.url;
  if (!imageUrl) throw new Error('No image returned from OpenAI');

  useTripStore.getState().updateActiveTrip((t) => ({
    ...t,
    boardImageUrl: imageUrl,
    boardGeneratedAt: new Date().toISOString(),
  }));

  log(`Trip Board ready${data.model ? ` (${data.model})` : ''}`, {
    phase: 'board',
    kind: 'success',
    step: 'Trip Board',
    percent: 100,
  });

  return imageUrl;
}

export async function runTripEdit(
  userMessage: string,
  focusStop?: Stop,
  onToken?: (token: string) => void,
): Promise<string> {
  const keys = useKeysStore.getState().keys;
  if (!keys) throw new Error('Add your API keys first.');
  const trip = useTripStore.getState().activeTrip;
  const profile = useProfileStore.getState().profile;
  const model = useKeysStore.getState().currentModel();
  const provider = getAIProvider(keys.aiProvider);

  const content = await provider.stream(keys.aiKey, model, {
    messages: [
      { role: 'system', content: COPILOT_SYSTEM },
      {
        role: 'user',
        content: `${askAiPrompt('copilot', userMessage, trip, focusStop)}\n\nTraveler:\n${profilePrompt(profile)}`,
      },
    ],
    jsonMode: true,
    temperature: 0.6,
    onToken,
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

  if (
    parsed.action === 'reply' &&
    !parsed.stopsToAdd &&
    !parsed.stopIdsToRemove &&
    !parsed.stopUpdates &&
    !parsed.reorder &&
    !parsed.packingList
  ) {
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
      if (update.isSideQuest != null) stop.isSideQuest = update.isSideQuest;
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
            photoUrls: resolved.photoUrls,
            mapsUrl: resolved.mapsUrl,
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
      const resolved =
        (await searchPlace(draft.searchQuery, near)) || (await searchPlace(draft.name, near));
      trip.stops.push(draftStopToStop(draft, resolved || { location: near, name: draft.name }));
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

  trip.days = buildDaysFromStops(
    trip.stops,
    trip.days.map((d) => ({
      index: d.index,
      title: d.title,
      summary: d.summary,
      date: d.date,
    })),
  );
  const legs = await buildDriveLegs(trip.stops, profile.maxDriveHoursPerDay);
  trip = mergeLegsIntoTrip(trip, legs);
  trip = applyBudget(
    trip,
    profile,
    useKeysStore.getState().settings.vehicleMpg ?? profile.vehicle?.mpg ?? null,
  );
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
  next = applyBudget(
    next,
    profile,
    useKeysStore.getState().settings.vehicleMpg ?? profile.vehicle?.mpg ?? null,
  );
  useTripStore.getState().setActiveTrip(next);
}
