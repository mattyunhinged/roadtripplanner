import type {
  ActivityTag,
  AgeGroup,
  TravelerProfile,
  Trip,
  Stop,
  TripPrefs,
  HighwayPreference,
  GenerationSpeed,
} from '../../types';
import { AGE_GROUP_OPTIONS, ACTIVITY_TAG_OPTIONS } from '../../types';

export function profilePrompt(profile: TravelerProfile): string {
  const home = profile.home?.address || 'unknown';
  const tags = (profile.activityTags?.length ? profile.activityTags : profile.interests) || [];
  const age = AGE_GROUP_OPTIONS.find((a) => a.id === profile.ageGroup);
  const v = profile.vehicle;
  return [
    `Home base: ${home}`,
    `Age group: ${age?.label || profile.ageGroup} (${age?.blurb || ''})`,
    `Vibe preference: ${profile.travelStyle}`,
    `Activity tags: ${tags.join(', ') || 'open to anything'}`,
    `Budget energy: ${profile.budgetLevel}`,
    `Sleep situation: ${profile.lodgingPreference}`,
    `Max drive grind / day: ${profile.maxDriveHoursPerDay}h`,
    `Crew: ${profile.partyType}`,
    `Highways default: ${profile.highwayPreference}`,
    v
      ? `Vehicle: ${v.brandName} ${v.modelName} · ${v.fuelType} · ${v.mpg ?? '?'} mpg/MPGe · range ${v.rangeMiles ?? 'n/a'} mi · ${v.drivetrain || 'n/a'}`
      : 'Vehicle: not set (assume average gas car ~28 mpg)',
  ].join('\n');
}

export function tripContextPrompt(trip: Trip | null): string {
  if (!trip) return 'No trip locked in yet — blank canvas.';
  const stops = trip.stops
    .slice()
    .sort((a, b) => a.dayIndex - b.dayIndex || a.order - b.order)
    .map(
      (s) =>
        `- [${s.id}] D${s.dayIndex + 1} #${s.order + 1} ${s.category}${s.isSideQuest ? ' (side quest)' : ''}: ${s.name} ${s.aiNotes || ''}`,
    )
    .join('\n');

  return [
    `Trip: ${trip.title}`,
    `Vibe: ${trip.vibe}`,
    `Days: ${trip.totalDays}`,
    `Round trip: ${trip.roundTrip}`,
    `Start: ${trip.origin.address}`,
    `Highways: ${trip.highwayPreference || 'mix'}`,
    `Tags: ${(trip.activityTags || []).join(', ') || 'n/a'}`,
    `Destinations: ${trip.destinations.map((d) => d.address).join(' | ') || 'n/a'}`,
    `Budget vibes: ~$${Math.round(trip.budget.total)}`,
    `Stops:`,
    stops || '(none yet)',
  ].join('\n');
}

function ageActivityGuidance(age: AgeGroup): string {
  switch (age) {
    case 'under21':
      return 'UNDER 21: zero bars/clubs/casinos/alcohol. Lean arcades, escape rooms, parks, thrills, food halls, bowling, karaoke (all-ages), views, quirky roadside.';
    case 'young_adult':
      return '21–34: nightlife OK, networking cafés, live music, foodie, breweries, escape rooms, games, thrills, festivals.';
    case 'adult':
      return '35–54: balanced — foodie, views, museums, hiking, spas, wineries, family options if relevant.';
    case 'senior':
      return '55+: scenic, history, easy walks, farmers markets, views, culture. Avoid extreme thrills / long brutal hikes.';
  }
}

export const AUTOPILOT_SYSTEM = `You are Autopilot for "On The Road" by Ryzord — Grok-coded chaotic-good roadtrip bestie.
Witty, short, Gen Z energy. Never corporate. Build REAL US roadtrips Google Places can find.

Personality:
- title + vibe slap (memorable, not bland)
- aiNotes = 1 short line max
- day titles punchy ("Fog & Clams Arc")
- progressHints = 4–8 playful live lines

Craft rules:
- ALWAYS start with origin as first stop day 0
- Respect highway preference: highways = prefer interstates/fast; scenic_roads = avoid interstates when reasonable; mix = balanced
- Respect age group hard rules for side activities
- Match activity tags for side quests + main stops
- Include lodging most nights, meals, scenic + attractions
- ALWAYS 2–5 SIDE QUESTS (isSideQuest: true)
- For EVs: prefer stops near charging-friendly towns; note charge-friendly picks in aiNotes occasionally
- For diesel/gas: normal fuel stops on long legs
- searchQuery must be Google-resolvable
- dayIndex + order 0-based
- Return ONLY valid JSON. No markdown.

generationSpeed:
- fast = fewer stops (3–5/day), tighter plan, still good
- beautiful = richer plan, more scenic/photo stops, fuller days`;

export function autopilotUserPrompt(input: {
  prompt: string;
  profile: TravelerProfile;
  mpg: number | null;
  prefs?: Partial<TripPrefs>;
}): string {
  const prefs = input.prefs;
  const highway: HighwayPreference =
    prefs?.highwayPreference || input.profile.highwayPreference || 'mix';
  const age = prefs?.ageGroup || input.profile.ageGroup;
  const tags: ActivityTag[] =
    prefs?.activityTags?.length
      ? prefs.activityTags
      : input.profile.activityTags?.length
        ? input.profile.activityTags
        : input.profile.interests || [];
  const speed: GenerationSpeed = prefs?.generationSpeed || 'beautiful';
  const start = prefs?.startAddress || input.profile.home?.address || 'user home';
  const tagLabels = tags
    .map((t) => ACTIVITY_TAG_OPTIONS.find((o) => o.id === t)?.label || t)
    .join(', ');

  return `User said: ${input.prompt}

STARTING POINT (must be origin stop day 0): ${start}
Highway preference: ${highway}
Generation mode: ${speed}
Age group: ${age}
${ageActivityGuidance(age)}
Activity tags to honor: ${tagLabels || 'surprise me with tasteful picks'}

Traveler profile:
${profilePrompt(input.profile)}

Effective MPG/MPGe: ${input.mpg ?? input.profile.vehicle?.mpg ?? 28}

Cook a full trip. JSON:
{
  "title": string,
  "vibe": string,
  "totalDays": number,
  "originQuery": string,
  "destinationQueries": string[],
  "roundTrip": boolean,
  "days": [{ "index": number, "title": string, "summary": string }],
  "stops": [{
    "name": string,
    "category": "origin"|"destination"|"food"|"lodging"|"attraction"|"scenic"|"fuel"|"custom",
    "dayIndex": number,
    "order": number,
    "searchQuery": string,
    "approximateLocation": { "lat": number, "lng": number },
    "timeWindow": string,
    "costEstimate": number,
    "aiNotes": string,
    "isSideQuest": boolean
  }],
  "budgetNotes": string,
  "assumedMpg": number,
  "progressHints": string[]
}

originQuery MUST match the starting point. Side quests = isSideQuest true.`;
}

export const COPILOT_SYSTEM = `You are the trip copilot for "On The Road" by Ryzord — Grok-coded bestie, funny, useful.
Return ONLY JSON. message = short chatty reply (1–3 sentences).

{
  "message": string,
  "action": "reply" | "patch" | "replace",
  "title": optional string,
  "vibe": optional string,
  "stopsToAdd": optional draft stops (include isSideQuest + searchQuery),
  "stopIdsToRemove": optional string[],
  "stopUpdates": optional [{ id, fields..., searchQuery?, isSideQuest? }],
  "reorder": optional [{ dayIndex, stopIds }],
  "packingList": optional [{ label, category }],
  "fullTrip": optional full draft when action is replace
}

Prefer patch. Suggest side quests for "more fun" / detours. Keep message short.`;

export function askAiPrompt(kind: string, context: string, trip: Trip | null, stop?: Stop): string {
  return `Request type: ${kind}
Context: ${context}
${stop ? `Focus stop: [${stop.id}] ${stop.name} (${stop.category}${stop.isSideQuest ? ', side quest' : ''}) day ${stop.dayIndex + 1}` : ''}

Current trip:
${tripContextPrompt(trip)}

Return the JSON edit response. Keep message short + fun.`;
}

export const PACKING_SYSTEM = `You make packing lists that don't suck. Gen Z practical energy. Return ONLY JSON: { "items": [{ "label": string, "category": string }] }. Categories: Clothing, Toiletries, Electronics, Documents, Outdoor, Vibes, Kids/Pets, Vehicle. Keep labels short. Factor EV charging cables / gas can vibes when relevant.`;
