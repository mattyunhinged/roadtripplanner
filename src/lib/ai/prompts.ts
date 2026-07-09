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
- No trailing commas
- No comments
- Use straight ASCII apostrophes (') inside strings, never curly quotes
- Keep strings short: title ≤60 chars, vibe ≤120 chars, aiNotes ≤80 chars, day titles ≤40 chars

Craft rules:
- First stop MUST be origin on dayIndex 0 order 0
- Respect highway preference + age rules (youngest guest wins for alcohol/nightlife bans)
- Match activity tags; scale food/lodging for full crew
- Include lodging most nights + meals + scenic/attractions
- Include 2–4 side quests (isSideQuest: true)
- searchQuery must be Google Places-resolvable (Name + City + State)
- dayIndex and order are 0-based integers
- Keep the plan compact so JSON stays complete

generationSpeed:
- fast = 2–4 days, 3–4 stops/day
- beautiful = 3–6 days, 4–5 stops/day (hard max 6 days, max 28 stops total)`;

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
  const dayCap = speed === 'fast' ? 4 : 6;
  const stopCap = speed === 'fast' ? 16 : 28;

  return `User said: ${input.prompt}

STARTING POINT (origin stop day 0): ${start}
Highway preference: ${highway}
Generation mode: ${speed} (hard cap ${dayCap} days, ≤${stopCap} stops total)
Lead age group: ${age}
${ageActivityGuidance(age)}
${crewAgeGuidance(input.profile)}
Activity tags: ${tagLabels || 'surprise me'}

Traveler profile:
${profilePrompt(input.profile)}

Effective MPG/MPGe: ${input.mpg ?? input.profile.vehicle?.mpg ?? 28}

Return ONLY this JSON shape (fill with real values, keep it compact):
{
  "title": "short title",
  "vibe": "short vibe",
  "totalDays": 3,
  "originQuery": "${start}",
  "destinationQueries": ["City ST"],
  "roundTrip": true,
  "days": [{ "index": 0, "title": "Day title", "summary": "one line" }],
  "stops": [{
    "name": "Place Name",
    "category": "origin",
    "dayIndex": 0,
    "order": 0,
    "searchQuery": "Place Name City ST",
    "approximateLocation": { "lat": 0, "lng": 0 },
    "timeWindow": "9am-11am",
    "costEstimate": 0,
    "aiNotes": "short note",
    "isSideQuest": false
  }],
  "budgetNotes": "one line",
  "assumedMpg": ${input.mpg ?? input.profile.vehicle?.mpg ?? 28},
  "progressHints": ["short status 1", "short status 2", "short status 3"]
}`;
}

export const COPILOT_SYSTEM = `You are the trip copilot for "On The Road" by Ryzord — Grok-coded bestie, funny, useful.
If the traveler has a first name, use it occasionally in your message (warm, not cringe).
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

Prefer patch. Suggest side quests for "more fun" / detours. Keep message short. Respect guest ages (kids/teens = no bar crawls).`;

export function askAiPrompt(kind: string, context: string, trip: Trip | null, stop?: Stop): string {
  return `Request type: ${kind}
Context: ${context}
${stop ? `Focus stop: [${stop.id}] ${stop.name} (${stop.category}${stop.isSideQuest ? ', side quest' : ''}) day ${stop.dayIndex + 1}` : ''}

Current trip:
${tripContextPrompt(trip)}

Return the JSON edit response. Keep message short + fun.`;
}

export const PACKING_SYSTEM = `You make packing lists that don't suck. Gen Z practical energy. Return ONLY JSON: { "items": [{ "label": string, "category": string }] }. Categories: Clothing, Toiletries, Electronics, Documents, Outdoor, Vibes, Kids/Pets, Vehicle. Keep labels short. Factor EV charging cables / gas can vibes when relevant.`;
