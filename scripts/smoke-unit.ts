import { estimateBudget } from '../src/lib/budget.ts';
import { draftTripSchema } from '../src/lib/ai/schemas.ts';
import {
  buildDaysFromStops,
  createEmptyTrip,
  reorderStops,
  recomputeDayTotals,
} from '../src/lib/ai/tripPatch.ts';
import { extractJSON } from '../src/lib/ai/provider.ts';
import { DEFAULT_PROFILE } from '../src/types/index.ts';
import type { Stop } from '../src/types/index.ts';

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

const sampleStops: Stop[] = [
  {
    id: 'a',
    name: 'Home',
    category: 'origin',
    location: { lat: 40.7, lng: -74 },
    dayIndex: 0,
    order: 0,
  },
  {
    id: 'b',
    name: 'Diner',
    category: 'food',
    location: { lat: 41, lng: -73.5 },
    dayIndex: 0,
    order: 1,
    costEstimate: 40,
  },
  {
    id: 'c',
    name: 'Inn',
    category: 'lodging',
    location: { lat: 41.2, lng: -73 },
    dayIndex: 0,
    order: 2,
    costEstimate: 150,
  },
];

const draft = draftTripSchema.parse({
  title: 'Test Trip',
  vibe: 'Coastal',
  totalDays: 2,
  destinationQueries: ['Boston'],
  roundTrip: true,
  days: [
    { index: 0, title: 'Depart' },
    { index: 1, title: 'Explore' },
  ],
  stops: [
    {
      name: 'Home',
      category: 'origin',
      dayIndex: 0,
      order: 0,
      searchQuery: 'New York NY',
    },
    {
      name: 'Boston Common',
      category: 'attraction',
      dayIndex: 1,
      order: 0,
      searchQuery: 'Boston Common Boston MA',
      costEstimate: 0,
    },
  ],
});

assert(draft.title === 'Test Trip', 'draft title');
assert(draft.stops.length === 2, 'draft stops');

const days = buildDaysFromStops(sampleStops, draft.days);
assert(days.length === 1, 'one day from stops');
assert(days[0].stopIds.length === 3, 'three stop ids');

const reordered = reorderStops(sampleStops, ['c', 'a', 'b'], 0);
assert(reordered.find((s) => s.id === 'c')?.order === 0, 'reorder first');
assert(reordered.find((s) => s.id === 'a')?.order === 1, 'reorder second');

let trip = createEmptyTrip({
  title: 'Budget test',
  stops: sampleStops,
  days,
  legs: [
    {
      id: 'l1',
      fromStopId: 'a',
      toStopId: 'b',
      dayIndex: 0,
      distanceMeters: 160934,
      durationSeconds: 7200,
    },
  ],
  travelers: 2,
  totalDays: 1,
});
trip = recomputeDayTotals(trip);
const budget = estimateBudget(trip, DEFAULT_PROFILE, 25);
assert(budget.fuel > 0, 'fuel estimated');
assert(budget.total > budget.fuel, 'total includes more than fuel');
assert(budget.perDay.length >= 1, 'per day breakdown');

const repaired = extractJSON<{ title: string; totalDays: number }>(
  "{\n title: 'Coastal Run',\n totalDays: 3,\n}",
);
assert(repaired.title === 'Coastal Run', 'extractJSON repairs unquoted keys');
assert(repaired.totalDays === 3, 'extractJSON repairs trailing commas');

const fenced = extractJSON<{ ok: boolean }>('```json\n{ "ok": true }\n```');
assert(fenced.ok === true, 'extractJSON handles fenced JSON');

console.log('All unit checks passed');
