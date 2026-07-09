import type { TravelerProfile, Trip, Stop } from '../../types';

export function profilePrompt(profile: TravelerProfile): string {
  const home = profile.home?.address || 'unknown';
  return [
    `Traveler home: ${home}`,
    `Travel style: ${profile.travelStyle}`,
    `Interests: ${profile.interests.join(', ') || 'general'}`,
    `Budget level: ${profile.budgetLevel}`,
    `Lodging preference: ${profile.lodgingPreference}`,
    `Max driving hours per day: ${profile.maxDriveHoursPerDay}`,
    `Party: ${profile.partyType}`,
  ].join('\n');
}

export function tripContextPrompt(trip: Trip | null): string {
  if (!trip) return 'No active trip yet.';
  const stops = trip.stops
    .slice()
    .sort((a, b) => a.dayIndex - b.dayIndex || a.order - b.order)
    .map(
      (s) =>
        `- [${s.id}] Day ${s.dayIndex + 1} #${s.order + 1} ${s.category}: ${s.name} (${s.location.lat.toFixed(4)}, ${s.location.lng.toFixed(4)}) ${s.aiNotes || ''}`,
    )
    .join('\n');

  return [
    `Trip: ${trip.title}`,
    `Vibe: ${trip.vibe}`,
    `Days: ${trip.totalDays}`,
    `Round trip: ${trip.roundTrip}`,
    `Origin: ${trip.origin.address}`,
    `Destinations: ${trip.destinations.map((d) => d.address).join(' | ') || 'n/a'}`,
    `Budget total: $${Math.round(trip.budget.total)}`,
    `Stops:`,
    stops || '(none)',
  ].join('\n');
}

export const AUTOPILOT_SYSTEM = `You are Autopilot AI for "On The Road" by Ryzord — a premium roadtrip planner.
Build complete, realistic US roadtrips. Prefer real place names that Google Places can resolve.
Respect max driving hours per day. Include lodging every night (except final day if ending at home), meals, scenic stops, and attractions matching traveler interests.
Return ONLY valid JSON matching the schema. Do not wrap in markdown.
For each stop provide a strong searchQuery like "Blue Hill Inn Blue Hill ME" or "Ace Hotel Portland OR".
dayIndex is 0-based. order is 0-based within the day.
Include origin as first stop on day 0 and destination/home as appropriate.
progressHints should be 4-8 short narration lines describing what you're doing.`;

export function autopilotUserPrompt(input: {
  prompt: string;
  profile: TravelerProfile;
  mpg: number | null;
}): string {
  return `User request: ${input.prompt}

Traveler profile:
${profilePrompt(input.profile)}

Vehicle MPG: ${input.mpg ?? 'assume 28 mpg'}

Return JSON with this shape:
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
    "aiNotes": string
  }],
  "budgetNotes": string,
  "assumedMpg": number,
  "progressHints": string[]
}`;
}

export const COPILOT_SYSTEM = `You are the trip copilot for "On The Road" by Ryzord.
You help refine the current roadtrip. When the user asks for changes, return JSON that describes edits.
Always return ONLY JSON:
{
  "message": string, // friendly reply to show in chat
  "action": "reply" | "patch" | "replace",
  "title": optional string,
  "vibe": optional string,
  "stopsToAdd": optional draft stops with searchQuery,
  "stopIdsToRemove": optional string[],
  "stopUpdates": optional [{ id, fields..., searchQuery? }],
  "reorder": optional [{ dayIndex, stopIds }],
  "packingList": optional [{ label, category }],
  "fullTrip": optional full draft trip when action is replace
}
Use existing stop ids when updating/removing. Prefer patch over replace.`;

export function askAiPrompt(kind: string, context: string, trip: Trip | null, stop?: Stop): string {
  return `Request type: ${kind}
Context: ${context}
${stop ? `Focus stop: [${stop.id}] ${stop.name} (${stop.category}) day ${stop.dayIndex + 1}` : ''}

Current trip:
${tripContextPrompt(trip)}

Return the JSON edit response.`;
}

export const PACKING_SYSTEM = `You generate practical packing lists for roadtrips. Return ONLY JSON: { "items": [{ "label": string, "category": string }] }. Categories like Clothing, Toiletries, Electronics, Documents, Outdoor, Kids/Pets.`;
