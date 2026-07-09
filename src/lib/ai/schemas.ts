import { z } from 'zod';

const STOP_CATEGORIES = [
  'origin',
  'destination',
  'food',
  'lodging',
  'attraction',
  'scenic',
  'fuel',
  'custom',
] as const;

function asString(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return undefined;
}

function pickString(obj: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = asString(obj[key]);
    if (value) return value;
  }
  return undefined;
}

function coerceCategory(value: unknown): (typeof STOP_CATEGORIES)[number] {
  const raw = asString(value)?.toLowerCase().replace(/\s+/g, '_') || '';
  if ((STOP_CATEGORIES as readonly string[]).includes(raw)) {
    return raw as (typeof STOP_CATEGORIES)[number];
  }
  if (raw.includes('hotel') || raw.includes('motel') || raw.includes('camp') || raw.includes('lodge')) {
    return 'lodging';
  }
  if (raw.includes('food') || raw.includes('restaurant') || raw.includes('cafe') || raw.includes('eat')) {
    return 'food';
  }
  if (raw.includes('fuel') || raw.includes('gas') || raw.includes('charge')) return 'fuel';
  if (raw.includes('scenic') || raw.includes('view') || raw.includes('overlook')) return 'scenic';
  if (raw.includes('origin') || raw.includes('start') || raw.includes('home')) return 'origin';
  if (raw.includes('dest')) return 'destination';
  if (raw.includes('side') || raw.includes('quest') || raw.includes('attract')) return 'attraction';
  return 'custom';
}

function coerceLocation(value: unknown): { lat: number; lng: number } | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const loc = value as Record<string, unknown>;
  const lat = Number(loc.lat ?? loc.latitude);
  const lng = Number(loc.lng ?? loc.lon ?? loc.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return undefined;
  return { lat, lng };
}

/** Normalize messy model stop objects into our schema shape. */
export function normalizeDraftStop(raw: unknown, fallbackDayIndex = 0, fallbackOrder = 0) {
  const obj =
    raw && typeof raw === 'object' ? ({ ...(raw as Record<string, unknown>) } as Record<string, unknown>) : {};

  const name =
    pickString(obj, ['name', 'title', 'placeName', 'place', 'label', 'stopName', 'poi', 'locationName']) ||
    pickString(obj, ['searchQuery', 'query', 'googleQuery']) ||
    'Unnamed stop';

  const searchQuery =
    pickString(obj, ['searchQuery', 'query', 'googleQuery', 'mapsQuery', 'placeQuery']) || name;

  const dayIndex = Number(
    obj.dayIndex ?? obj.day ?? obj.day_index ?? obj.dayNumber ?? fallbackDayIndex,
  );
  const order = Number(obj.order ?? obj.index ?? obj.stopIndex ?? fallbackOrder);

  return {
    name,
    category: coerceCategory(obj.category ?? obj.type ?? obj.kind),
    dayIndex: Number.isFinite(dayIndex) ? Math.max(0, Math.trunc(dayIndex)) : fallbackDayIndex,
    order: Number.isFinite(order) ? Math.max(0, Math.trunc(order)) : fallbackOrder,
    searchQuery,
    approximateLocation: coerceLocation(
      obj.approximateLocation ?? obj.location ?? obj.coords ?? obj.coordinates,
    ),
    timeWindow: pickString(obj, ['timeWindow', 'time', 'when', 'window']),
    costEstimate:
      obj.costEstimate != null || obj.cost != null || obj.price != null
        ? Number(obj.costEstimate ?? obj.cost ?? obj.price)
        : undefined,
    aiNotes: pickString(obj, ['aiNotes', 'notes', 'note', 'blurb', 'why']),
    isSideQuest: Boolean(obj.isSideQuest ?? obj.sideQuest ?? obj.side_quest ?? false),
  };
}

export function normalizeStopBatch(raw: unknown): { stops: ReturnType<typeof normalizeDraftStop>[] } {
  let list: unknown[] = [];
  if (Array.isArray(raw)) {
    list = raw;
  } else if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    if (Array.isArray(obj.stops)) list = obj.stops;
    else if (Array.isArray(obj.items)) list = obj.items;
    else if (Array.isArray(obj.places)) list = obj.places;
    else if (Array.isArray(obj.itinerary)) list = obj.itinerary;
  }

  const stops = list
    .map((item, i) => normalizeDraftStop(item, 0, i))
    .filter((s) => s.name && s.searchQuery);

  return { stops };
}

export const draftStopSchema = z.preprocess(
  (raw) => normalizeDraftStop(raw),
  z.object({
    name: z.string().min(1),
    category: z.enum(STOP_CATEGORIES).catch('custom'),
    dayIndex: z.coerce.number().int().min(0).default(0),
    order: z.coerce.number().int().min(0).default(0),
    searchQuery: z.string().min(1),
    approximateLocation: z
      .object({
        lat: z.coerce.number(),
        lng: z.coerce.number(),
      })
      .optional(),
    timeWindow: z.string().optional(),
    costEstimate: z.coerce.number().optional(),
    aiNotes: z.string().optional(),
    isSideQuest: z.boolean().optional().default(false),
  }),
);

export const draftDaySchema = z.object({
  index: z.coerce.number().int().min(0),
  title: z.string().min(1),
  summary: z.string().optional(),
  date: z.string().optional(),
});

export const draftTripSchema = z.object({
  title: z.string().min(1),
  vibe: z.string().default(''),
  totalDays: z.coerce.number().int().min(1).max(90),
  originQuery: z.string().optional(),
  destinationQueries: z.array(z.string()).default([]),
  roundTrip: z.boolean().default(true),
  days: z.array(draftDaySchema).default([]),
  stops: z.array(draftStopSchema).default([]),
  budgetNotes: z.string().optional(),
  assumedMpg: z.coerce.number().optional(),
  progressHints: z.array(z.string()).optional(),
});

/** Lightweight outline before stop batches (supports massive trips). */
export const tripOutlineSchema = z.object({
  title: z.string().min(1),
  vibe: z.string().default(''),
  totalDays: z.coerce.number().int().min(1).max(90),
  originQuery: z.string().min(1),
  destinationQueries: z.array(z.string()).default([]),
  roundTrip: z.boolean().default(true),
  days: z.array(draftDaySchema).min(1),
  budgetNotes: z.string().optional(),
  assumedMpg: z.coerce.number().optional(),
  progressHints: z.array(z.string()).optional(),
});

export const stopBatchSchema = z.preprocess(
  (raw) => normalizeStopBatch(raw),
  z.object({
    stops: z.array(draftStopSchema).min(1),
  }),
);

export const tripEditResponseSchema = z.object({
  message: z.string(),
  action: z.enum(['reply', 'patch', 'replace']).default('reply'),
  title: z.string().optional(),
  vibe: z.string().optional(),
  stopsToAdd: z.array(draftStopSchema).optional(),
  stopIdsToRemove: z.array(z.string()).optional(),
  stopUpdates: z
    .array(
      z.object({
        id: z.string(),
        name: z.string().optional(),
        category: z.enum(STOP_CATEGORIES).optional(),
        timeWindow: z.string().optional(),
        costEstimate: z.number().optional(),
        aiNotes: z.string().optional(),
        searchQuery: z.string().optional(),
        dayIndex: z.number().optional(),
        order: z.number().optional(),
        isSideQuest: z.boolean().optional(),
      }),
    )
    .optional(),
  reorder: z
    .array(
      z.object({
        dayIndex: z.number(),
        stopIds: z.array(z.string()),
      }),
    )
    .optional(),
  packingList: z
    .array(
      z.object({
        label: z.string(),
        category: z.string(),
      }),
    )
    .optional(),
  fullTrip: draftTripSchema.optional(),
});

export const packingListSchema = z.object({
  items: z.array(
    z.object({
      label: z.string(),
      category: z.string(),
    }),
  ),
});

export type DraftTrip = z.infer<typeof draftTripSchema>;
export type DraftStop = z.infer<typeof draftStopSchema>;
export type TripOutline = z.infer<typeof tripOutlineSchema>;
export type TripEditResponse = z.infer<typeof tripEditResponseSchema>;
