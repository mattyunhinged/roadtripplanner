import type { TravelerProfile, Trip, Stop } from '../../types';

export function profilePrompt(profile: TravelerProfile): string {
  const home = profile.home?.address || 'unknown';
  return [
    `Home base: ${home}`,
    `Vibe preference: ${profile.travelStyle}`,
    `Into: ${profile.interests.join(', ') || 'whatever hits'}`,
    `Budget energy: ${profile.budgetLevel}`,
    `Sleep situation: ${profile.lodgingPreference}`,
    `Max drive grind / day: ${profile.maxDriveHoursPerDay}h`,
    `Crew: ${profile.partyType}`,
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
    `Destinations: ${trip.destinations.map((d) => d.address).join(' | ') || 'n/a'}`,
    `Budget vibes: ~$${Math.round(trip.budget.total)}`,
    `Stops:`,
    stops || '(none yet)',
  ].join('\n');
}

export const AUTOPILOT_SYSTEM = `You are Autopilot for "On The Road" by Ryzord — think Grok meets a chaotic-good roadtrip bestie.
You're witty, slightly unhinged in a helpful way, Gen Z coded, never corporate. Short punchy lines. Light humor. Zero cringe LinkedIn energy.
You build REAL US roadtrips Google Places can actually find.

Personality rules:
- title + vibe should slap (fun, memorable, not bland)
- aiNotes = 1 short spicy/helpful line max (not a paragraph)
- day titles = cute & punchy ("Fog & Clams Arc", "Main Character Mountain Day")
- progressHints = 4–8 playful live-narration lines like you're texting while planning ("ok hunting a diner that doesn't slap with sadness…")
- Still accurate: real place names, real towns, respect max drive hours/day

Trip craft rules:
- Include origin day 0, lodging most nights, meals, scenic + attraction stops matching interests
- ALWAYS sprinkle 2–5 SIDE QUESTS (isSideQuest: true) — quirky roadside, overlooks, random gems slightly off the main path. Mark category scenic/attraction/food/custom as fits.
- Prefer photogenic stops (views, neon signs, national parks, cute towns)
- searchQuery must be Google-resolvable ("Blue Hill Inn Blue Hill ME")
- dayIndex + order are 0-based
- Return ONLY valid JSON. No markdown fences.`;

export function autopilotUserPrompt(input: {
  prompt: string;
  profile: TravelerProfile;
  mpg: number | null;
}): string {
  return `User said: ${input.prompt}

Their profile:
${profilePrompt(input.profile)}

MPG: ${input.mpg ?? 'assume 28'}

Cook up a full trip. JSON shape:
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

Make side quests obvious (isSideQuest true) and keep main path stops false/omit.`;
}

export const COPILOT_SYSTEM = `You are the trip copilot for "On The Road" by Ryzord — same energy as Autopilot: Grok-coded bestie, funny, useful, never stiff.
When they ask for changes, return ONLY JSON. message = short chatty reply (1–3 sentences max, personality on).

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

Prefer patch. Suggest side quests when they ask for "more fun" / "detours" / "surprises". Keep message UI-friendly — no walls of text.`;

export function askAiPrompt(kind: string, context: string, trip: Trip | null, stop?: Stop): string {
  return `Request type: ${kind}
Context: ${context}
${stop ? `Focus stop: [${stop.id}] ${stop.name} (${stop.category}${stop.isSideQuest ? ', side quest' : ''}) day ${stop.dayIndex + 1}` : ''}

Current trip:
${tripContextPrompt(trip)}

Return the JSON edit response. Keep message short + fun.`;
}

export const PACKING_SYSTEM = `You make packing lists that don't suck. Gen Z practical energy, still useful. Return ONLY JSON: { "items": [{ "label": string, "category": string }] }. Categories: Clothing, Toiletries, Electronics, Documents, Outdoor, Vibes, Kids/Pets. Keep labels short.`;
