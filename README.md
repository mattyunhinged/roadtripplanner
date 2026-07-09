# On The Road by Ryzord

Premium AI roadtrip planner with Autopilot mode. Enter your own API keys, set your home base, and let Autopilot build complete trips — routes, stops, food, lodging, scenic detours, timing, and budget — synced to a live Google Map.

## Features

- **API key setup** with OpenAI or Anthropic (auto-detected) + Google Maps validation
- **Traveler onboarding** (home, style, interests, budget, lodging, drive limits, party)
- **Autopilot AI** — one-sentence prompts become full day-by-day itineraries
- **Manual planning** with Places search, map-click stops, drag-and-drop reorder
- **Ask AI / Copilot chat** that edits the itinerary and map in place
- **Budget estimates**, fuel suggestions, packing lists, export/print, Google Maps deep links
- **Trip library**, light/dark themes, responsive map + itinerary layout

## Setup

```bash
npm install
npm run dev
```

- Web app: http://localhost:5173  
- AI proxy: http://localhost:3001  

Production:

```bash
npm run build
npm start
```

## Required API keys (you provide them in the app)

1. **OpenAI** (`sk-…`) or **Anthropic** (`sk-ant-…`)
2. **Google Maps** key with these APIs enabled:
   - Maps JavaScript API
   - Places API
   - Directions API
   - Geocoding API
   - Distance Matrix API (optional but recommended)

Keys are never hardcoded. They live in memory for the session, with an optional “remember on this device” setting (localStorage).

## Architecture

- `src/` — React + TypeScript SPA (Vite, Tailwind, Zustand, Framer Motion, @vis.gl/react-google-maps)
- `server/` — Express proxy for OpenAI/Anthropic (avoids browser CORS; keys sent per request)
- AI providers share one abstraction in `src/lib/ai/` so swapping models/providers is trivial

## Manual smoke checklist

1. Enter and validate AI + Maps keys  
2. Set home via Places autocomplete  
3. Run Autopilot with a prompt like “3 day surprise from home”  
4. Filter by day, hover itinerary ↔ map sync  
5. Drag-reorder a stop and confirm route recalculates  
6. Ask Copilot to change food stops  
7. Save to library, export/print, generate packing list  

Built by Ryzord.
