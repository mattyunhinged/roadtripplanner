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
import { AGE_GROUP_OPTIONS, ACTIVITY_TAG_OPTIONS, GUEST_AGE_OPTIONS } from '../../types';

export function profilePrompt(profile: TravelerProfile): string {
  const home = profile.home?.address || 'unknown';
  const tags = (profile.activityTags?.length ? profile.activityTags : profile.interests) || [];
  const age = AGE_GROUP_OPTIONS.find((a) => a.id === profile.ageGroup);
  const v = profile.vehicle;
  const name = profile.displayName?.trim();
  const guests = profile.guests || [];
  const guestLines =
    guests.length > 0
      ? guests
          .map((g) => {
            const opt = GUEST_AGE_OPTIONS.find((o) => o.id === g.ageRange);
            return `  - ${g.name} (${opt?.label || g.ageRange})`;
          })
          .join('\n')
      : '  - solo / no guests listed';
  return [
    name ? `Traveler first name: ${name} — address them by name in titles/vibes/notes when it feels natural` : 'Traveler name: unknown',
    `Home base: ${home}`,
    `Age group (lead): ${age?.label || profile.ageGroup} (${age?.blurb || ''})`,
    `Crew size: ${1 + guests.length} (lead + ${guests.length} guest${guests.length === 1 ? '' : 's'})`,
    `Guests:\n${guestLines}`,
    `Vibe preference: ${profile.travelStyle}`,
    `Activity tags: ${tags.join(', ') || 'open to anything'}`,
    `Budget energy: ${profile.budgetLevel}`,
    `Sleep situation: ${profile.lodgingPreference}`,
    `Max drive grind / day: ${profile.maxDriveHoursPerDay}h`,
    `Crew type: ${profile.partyType}`,
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

function crewAgeGuidance(profile: TravelerProfile): string {
  const guests = profile.guests || [];
  const ranges = new Set<string>([profile.ageGroup, ...guests.map((g) => g.ageRange)]);
  const lines: string[] = [];
  if (ranges.has('child')) {
    lines.push('Kids under 12 aboard — prioritize family-friendly, short walks, playgrounds, ice cream, avoid late nightlife.');
  }
  if (ranges.has('teen') || ranges.has('under21')) {
    lines.push('Teens / under-21 in the car — NO alcohol-focused stops for the group plan; keep all-ages options in the mix.');
  }
  if (guests.length) {
    lines.push(
      `Name-drop the crew when it fits (e.g. "${profile.displayName || 'lead'} + ${guests[0].name}"). Plan for ${1 + guests.length} people.`,
    );
  }
  return lines.join('\n');
}

export const AUTOPILOT_SYSTEM = `You are Autopilot for "On The Road" by Ryzord — witty Gen Z roadtrip planner.
Return ONLY one valid JSON object. No markdown fences. No commentary before/after.

JSON rules (strict):
- Double-quote EVERY key and EVERY string
- No trailing commas, no comments
- Use straight ASCII apostrophes (') inside strings, never curly quotes
- Keep strings short: title ≤80 chars, vibe ≤160 chars, aiNotes ≤90 chars, day titles ≤48 chars

Craft rules:
- Honor the user's requested scale — short weekend OR massive multi-week epic. Do NOT shrink a big ask.
- First stop MUST be origin on dayIndex 0 order 0 when returning stops
- Respect highway preference + age rules (youngest guest wins for alcohol/nightlife bans)
- Match activity tags; scale food/lodging for full crew
- Include lodging most nights + meals + scenic/attractions
- Include side quests (isSideQuest: true) — about 1 per 2–3 days on big trips
- searchQuery must be Google Places-resolvable (Name + City + State)
- dayIndex and order are 0-based integers

generationSpeed:
- fast = leaner days (3–4 stops/day), still honor requested length
- beautiful = richer days (4–6 stops/day), still honor requested length`;

export function autopilotOutlinePrompt(input: {
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

STARTING POINT: ${start}
Highway preference: ${highway}
Generation mode: ${speed}
Lead age group: ${age}
${ageActivityGuidance(age)}
${crewAgeGuidance(input.profile)}
Activity tags: ${tagLabels || 'surprise me'}

Traveler profile:
${profilePrompt(input.profile)}

Effective MPG/MPGe: ${input.mpg ?? input.profile.vehicle?.mpg ?? 28}

PHASE 1 — OUTLINE ONLY (no stops yet).
Infer totalDays from the user ask. Support massive trips (even 2–8+ weeks) when they ask for it.
${
  prefs?.mustStops?.length
    ? `MUST-VISIT spine (route MUST pass these in a sensible order — they are locked anchors):\n${prefs.mustStops
        .map((s, i) => `${i + 1}. ${s.name} — ${s.address}`)
        .join('\n')}\nPut them into destinationQueries and day summaries.`
    : ''
}
${prefs?.roundTrip === false ? 'One-way trip (do NOT force a return home).' : 'Round trip preferred unless the user said otherwise.'}
Stop density outbound: ${prefs?.stopDensity || 'balanced'} (sparse=fewer stops/day, packed=more).
Return-leg density: ${prefs?.returnDensity || prefs?.stopDensity || 'balanced'}.

Return ONLY:
{
  "title": "short title",
  "vibe": "short vibe",
  "totalDays": 7,
  "originQuery": "${start}",
  "destinationQueries": ["City ST"],
  "roundTrip": true,
  "days": [{ "index": 0, "title": "Day title", "summary": "one line" }],
  "budgetNotes": "one line",
  "assumedMpg": ${input.mpg ?? input.profile.vehicle?.mpg ?? 28},
  "progressHints": ["status 1", "status 2", "status 3"]
}
days array MUST have exactly totalDays entries with consecutive indexes starting at 0.`;
}

export function autopilotStopBatchPrompt(input: {
  prompt: string;
  profile: TravelerProfile;
  outline: {
    title: string;
    vibe: string;
    totalDays: number;
    originQuery: string;
    destinationQueries: string[];
    roundTrip: boolean;
    days: { index: number; title: string; summary?: string }[];
  };
  dayIndexes: number[];
  prefs?: Partial<TripPrefs>;
  previousStopTail?: string;
}): string {
  const prefs = input.prefs;
  const speed: GenerationSpeed = prefs?.generationSpeed || 'beautiful';
  const density = prefs?.stopDensity || 'balanced';
  const returnDensity = prefs?.returnDensity || density;
  const densityGuide =
    density === 'sparse' ? '2-3' : density === 'packed' ? '5-7' : speed === 'fast' ? '3-4' : '4-6';
  const returnGuide =
    returnDensity === 'sparse' ? '2-3' : returnDensity === 'packed' ? '5-7' : densityGuide;
  const dayMeta = input.outline.days
    .filter((d) => input.dayIndexes.includes(d.index))
    .map((d) => `D${d.index}: ${d.title}${d.summary ? ` — ${d.summary}` : ''}`)
    .join('\n');
  const mid = Math.floor(input.outline.totalDays / 2);
  const isReturnBatch = input.dayIndexes.some((d) => d >= mid) && input.outline.roundTrip;

  return `Continue Autopilot for trip "${input.outline.title}" (${input.outline.totalDays} days).
User ask: ${input.prompt}
Origin: ${input.outline.originQuery}
Destinations: ${input.outline.destinationQueries.join(' | ') || 'n/a'}
Round trip: ${input.outline.roundTrip}
Mode: ${speed} · density ${isReturnBatch ? `return/${returnDensity} (~${returnGuide} stops/day)` : `outbound/${density} (~${densityGuide} stops/day)`}
${
  prefs?.mustStops?.length
    ? `MUST include these anchors if they fall on these days (use exact names/addresses):\n${prefs.mustStops
        .map((s) => `- ${s.name} @ ${s.address}`)
        .join('\n')}`
    : ''
}

Traveler:
${profilePrompt(input.profile)}

Build stops ONLY for these day indexes: [${input.dayIndexes.join(', ')}]
Day briefs:
${dayMeta}

${input.previousStopTail ? `Last stops from prior days (continue logically):\n${input.previousStopTail}\n` : ''}
Rules:
- If day 0 is included, first stop must be origin (category "origin")
- Include lodging most nights, meals, attractions/scenic, and ~1 side quest every 2–3 days
- EVERY stop MUST include both "name" and "searchQuery" as non-empty strings
- searchQuery = "Name City ST" Google-resolvable
- Keep aiNotes short
- Return ONLY this exact shape:
{
  "stops": [
    {
      "name": "Place Name",
      "category": "attraction",
      "dayIndex": ${input.dayIndexes[0] ?? 0},
      "order": 0,
      "searchQuery": "Place Name City ST",
      "approximateLocation": { "lat": 37.7, "lng": -122.4 },
      "timeWindow": "10am-12pm",
      "costEstimate": 20,
      "aiNotes": "short note",
      "isSideQuest": false
    }
  ]
}
- Every stop.dayIndex must be one of [${input.dayIndexes.join(', ')}]
- order restarts at 0 within each day`;
}

/** @deprecated single-shot prompt kept for fallbacks */
export function autopilotUserPrompt(input: {
  prompt: string;
  profile: TravelerProfile;
  mpg: number | null;
  prefs?: Partial<TripPrefs>;
}): string {
  return autopilotOutlinePrompt(input);
}

export const COPILOT_SYSTEM = `You are the trip copilot for "On The Road" by Ryzord — Grok-coded bestie, funny, useful.
If the traveler has a first name, use it occasionally in your message (warm, not cringe).
You receive prior chat turns — honor follow-ups like "do that for day 3" or "make it cheaper".
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

Prefer patch. Suggest side quests for "more fun" / detours. Keep message short. Respect guest ages (kids/teens = no bar crawls).
When you change the trip, set action to "patch" (or "replace" for a full rewrite). Use "reply" only when no map edits are needed.`;

export function askAiPrompt(kind: string, context: string, trip: Trip | null, stop?: Stop): string {
  return `Request type: ${kind}
Context: ${context}
${stop ? `Focus stop: [${stop.id}] ${stop.name} (${stop.category}${stop.isSideQuest ? ', side quest' : ''}) day ${stop.dayIndex + 1}` : ''}

Current trip:
${tripContextPrompt(trip)}

Return the JSON edit response. Keep message short + fun.`;
}

export const PACKING_SYSTEM = `You make packing lists that don't suck. Gen Z practical energy. Return ONLY JSON: { "items": [{ "label": string, "category": string }] }. Categories: Clothing, Toiletries, Electronics, Documents, Outdoor, Vibes, Kids/Pets, Vehicle. Keep labels short. Factor EV charging cables / gas can vibes when relevant.`;
