import { v4 as uuid } from 'uuid';
import type {
  BudgetBreakdown,
  DriveLeg,
  LatLng,
  Stop,
  StopCategory,
  TravelerProfile,
  Trip,
  TripDay,
} from '../../types';
import type { DraftStop, DraftTrip } from './schemas';
import { estimateBudget } from '../budget';

export function emptyBudget(): BudgetBreakdown {
  return {
    fuel: 0,
    lodging: 0,
    food: 0,
    activities: 0,
    total: 0,
    perDay: [],
  };
}

export function createEmptyTrip(partial?: Partial<Trip>): Trip {
  const now = new Date().toISOString();
  return {
    id: uuid(),
    title: 'Untitled trip',
    vibe: '',
    origin: { lat: 39.8283, lng: -98.5795, address: '' },
    destinations: [],
    roundTrip: true,
    travelers: 2,
    days: [],
    stops: [],
    legs: [],
    budget: emptyBudget(),
    totalMiles: 0,
    totalDays: 0,
    createdAt: now,
    updatedAt: now,
    ...partial,
  };
}

export function draftStopToStop(draft: DraftStop, resolved?: Partial<Stop>): Stop {
  return {
    id: uuid(),
    name: resolved?.name || draft.name,
    category: draft.category,
    location: resolved?.location || draft.approximateLocation || { lat: 0, lng: 0 },
    placeId: resolved?.placeId,
    address: resolved?.address,
    dayIndex: draft.dayIndex,
    order: draft.order,
    timeWindow: draft.timeWindow,
    rating: resolved?.rating,
    priceLevel: resolved?.priceLevel,
    hours: resolved?.hours,
    photoUrl: resolved?.photoUrl,
    costEstimate: draft.costEstimate ?? resolved?.costEstimate,
    aiNotes: draft.aiNotes,
    website: resolved?.website,
    phone: resolved?.phone,
  };
}

export function buildDaysFromStops(stops: Stop[], draftDays?: DraftTrip['days']): TripDay[] {
  const byDay = new Map<number, Stop[]>();
  for (const stop of stops) {
    const list = byDay.get(stop.dayIndex) || [];
    list.push(stop);
    byDay.set(stop.dayIndex, list);
  }

  const indices = [...byDay.keys()].sort((a, b) => a - b);
  return indices.map((index) => {
    const dayStops = (byDay.get(index) || []).sort((a, b) => a.order - b.order);
    const draft = draftDays?.find((d) => d.index === index);
    return {
      index,
      title: draft?.title || `Day ${index + 1}`,
      summary: draft?.summary,
      date: draft?.date,
      stopIds: dayStops.map((s) => s.id),
      drivingHours: 0,
      miles: 0,
      estimatedSpend: dayStops.reduce((sum, s) => sum + (s.costEstimate || 0), 0),
    };
  });
}

export function recomputeDayTotals(trip: Trip): Trip {
  const days = trip.days.map((day) => {
    const legs = trip.legs.filter((l) => l.dayIndex === day.index);
    const dayStops = trip.stops.filter((s) => s.dayIndex === day.index);
    const miles = legs.reduce((sum, l) => sum + l.distanceMeters, 0) / 1609.344;
    const drivingHours = legs.reduce((sum, l) => sum + l.durationSeconds, 0) / 3600;
    const estimatedSpend = dayStops.reduce((sum, s) => sum + (s.costEstimate || 0), 0);
    return {
      ...day,
      stopIds: dayStops.sort((a, b) => a.order - b.order).map((s) => s.id),
      miles,
      drivingHours,
      estimatedSpend,
    };
  });

  const totalMiles = trip.legs.reduce((sum, l) => sum + l.distanceMeters, 0) / 1609.344;

  return {
    ...trip,
    days,
    totalMiles,
    totalDays: days.length || trip.totalDays,
    updatedAt: new Date().toISOString(),
  };
}

export function orderedStops(trip: Trip): Stop[] {
  return trip.stops.slice().sort((a, b) => a.dayIndex - b.dayIndex || a.order - b.order);
}

export function reorderStops(stops: Stop[], orderedIds: string[], dayIndex?: number): Stop[] {
  const idSet = new Set(orderedIds);
  const others = stops.filter((s) => !idSet.has(s.id));
  const reordered = orderedIds
    .map((id, index) => {
      const stop = stops.find((s) => s.id === id);
      if (!stop) return null;
      return {
        ...stop,
        order: index,
        dayIndex: dayIndex ?? stop.dayIndex,
      };
    })
    .filter(Boolean) as Stop[];
  return [...others, ...reordered];
}

export function applyBudget(
  trip: Trip,
  profile: TravelerProfile,
  mpg: number | null,
): Trip {
  const budget = estimateBudget(trip, profile, mpg);
  return { ...trip, budget, updatedAt: new Date().toISOString() };
}

export function googleMapsDayUrl(stops: Stop[]): string {
  const ordered = stops.slice().sort((a, b) => a.order - b.order);
  if (ordered.length < 2) return 'https://www.google.com/maps';
  const origin = `${ordered[0].location.lat},${ordered[0].location.lng}`;
  const destination = `${ordered[ordered.length - 1].location.lat},${ordered[ordered.length - 1].location.lng}`;
  const waypoints = ordered
    .slice(1, -1)
    .map((s) => `${s.location.lat},${s.location.lng}`)
    .join('|');
  const url = new URL('https://www.google.com/maps/dir/?api=1');
  url.searchParams.set('origin', origin);
  url.searchParams.set('destination', destination);
  url.searchParams.set('travelmode', 'driving');
  if (waypoints) url.searchParams.set('waypoints', waypoints);
  return url.toString();
}

export function categoryLabel(category: StopCategory): string {
  const labels: Record<StopCategory, string> = {
    origin: 'Start',
    destination: 'Destination',
    food: 'Food',
    lodging: 'Stay',
    attraction: 'Attraction',
    scenic: 'Scenic',
    fuel: 'Fuel',
    custom: 'Stop',
  };
  return labels[category];
}

export function centerOf(points: LatLng[]): LatLng {
  if (!points.length) return { lat: 39.8283, lng: -98.5795 };
  const lat = points.reduce((s, p) => s + p.lat, 0) / points.length;
  const lng = points.reduce((s, p) => s + p.lng, 0) / points.length;
  return { lat, lng };
}

export function tripToShareText(trip: Trip): string {
  const lines: string[] = [
    `${trip.title}`,
    trip.vibe,
    '',
    `${trip.totalDays} days · ${Math.round(trip.totalMiles)} miles · ~$${Math.round(trip.budget.total)}`,
    '',
  ];

  for (const day of trip.days) {
    lines.push(`Day ${day.index + 1}: ${day.title}`);
    if (day.summary) lines.push(day.summary);
    const stops = trip.stops
      .filter((s) => s.dayIndex === day.index)
      .sort((a, b) => a.order - b.order);
    for (const stop of stops) {
      lines.push(
        `  • ${stop.timeWindow ? stop.timeWindow + ' — ' : ''}${stop.name} (${categoryLabel(stop.category)})`,
      );
      if (stop.aiNotes) lines.push(`    ${stop.aiNotes}`);
    }
    const dayLegs = trip.legs.filter((l) => l.dayIndex === day.index);
    const miles = dayLegs.reduce((s, l) => s + l.distanceMeters, 0) / 1609.344;
    const hours = dayLegs.reduce((s, l) => s + l.durationSeconds, 0) / 3600;
    lines.push(
      `  Driving: ${Math.round(miles)} mi · ${hours.toFixed(1)}h · Spend ~$${Math.round(day.estimatedSpend)}`,
    );
    lines.push('');
  }

  lines.push('Budget');
  lines.push(`  Fuel: $${Math.round(trip.budget.fuel)}`);
  lines.push(`  Lodging: $${Math.round(trip.budget.lodging)}`);
  lines.push(`  Food: $${Math.round(trip.budget.food)}`);
  lines.push(`  Activities: $${Math.round(trip.budget.activities)}`);
  lines.push(`  Total: $${Math.round(trip.budget.total)}`);
  lines.push('');
  lines.push('Planned with On The Road by Ryzord');
  return lines.join('\n');
}

export function mergeLegsIntoTrip(trip: Trip, legs: DriveLeg[]): Trip {
  return recomputeDayTotals({ ...trip, legs });
}
