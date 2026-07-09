export type AIProviderId = 'openai' | 'anthropic';

export type StopCategory =
  | 'origin'
  | 'destination'
  | 'food'
  | 'lodging'
  | 'attraction'
  | 'scenic'
  | 'fuel'
  | 'custom';

export type TravelStyle = 'scenic' | 'fastest' | 'balanced';
export type BudgetLevel = 'budget' | 'moderate' | 'luxury';
export type LodgingPreference = 'hotels' | 'motels' | 'camping' | 'mix';
export type PartyType = 'solo' | 'couple' | 'family' | 'pets';
export type ThemeMode = 'light' | 'dark';
export type FuelType = 'gas' | 'diesel' | 'electric' | 'hybrid' | 'plugin_hybrid';
export type AgeGroup = 'under21' | 'young_adult' | 'adult' | 'senior';
export type HighwayPreference = 'highways' | 'scenic_roads' | 'mix';
export type GenerationSpeed = 'fast' | 'beautiful';

export type ActivityTag =
  | 'networking'
  | 'games'
  | 'escape_rooms'
  | 'parks'
  | 'museums'
  | 'nightlife'
  | 'live_music'
  | 'foodie'
  | 'coffee'
  | 'breweries'
  | 'wineries'
  | 'hiking'
  | 'beaches'
  | 'photography'
  | 'quirky'
  | 'shopping'
  | 'spas'
  | 'sports'
  | 'camping'
  | 'roadside'
  | 'history'
  | 'art'
  | 'family'
  | 'pets'
  | 'thrills'
  | 'views'
  | 'stargazing'
  | 'farmers_markets'
  | 'arcades'
  | 'bowling'
  | 'karaoke'
  | 'comedy'
  | 'festivals'
  | 'national_parks'
  | 'state_parks'
  | 'waterfalls'
  | 'hot_springs'
  | 'casinos'
  | 'vintage'
  | 'street_food';

/** @deprecated use ActivityTag — kept for migration */
export type Interest = ActivityTag;

export interface LatLng {
  lat: number;
  lng: number;
}

export interface PlacePhoto {
  url: string;
  attribution?: string;
}

export interface ApiKeys {
  aiKey: string;
  aiProvider: AIProviderId;
  googleMapsKey: string;
  persist: boolean;
}

export interface AppSettings {
  openaiModel: string;
  anthropicModel: string;
  theme: ThemeMode;
  vehicleMpg: number | null;
}

export interface VehicleProfile {
  brandId: string;
  brandName: string;
  modelId: string;
  modelName: string;
  fuelType: FuelType;
  mpg: number | null;
  rangeMiles: number | null;
  drivetrain: string | null;
  customLabel?: string;
}

export interface TravelerProfile {
  home: {
    address: string;
    placeId?: string;
    location: LatLng;
  } | null;
  travelStyle: TravelStyle;
  interests: ActivityTag[];
  activityTags: ActivityTag[];
  budgetLevel: BudgetLevel;
  lodgingPreference: LodgingPreference;
  maxDriveHoursPerDay: number;
  partyType: PartyType;
  ageGroup: AgeGroup;
  highwayPreference: HighwayPreference;
  vehicle: VehicleProfile | null;
  onboardingComplete: boolean;
}

export interface TripPrefs {
  startAddress: string;
  startLocation: LatLng | null;
  startPlaceId?: string;
  prompt: string;
  highwayPreference: HighwayPreference;
  activityTags: ActivityTag[];
  ageGroup: AgeGroup;
  generationSpeed: GenerationSpeed;
  days?: number;
}

export interface Stop {
  id: string;
  name: string;
  category: StopCategory;
  location: LatLng;
  placeId?: string;
  address?: string;
  dayIndex: number;
  order: number;
  timeWindow?: string;
  rating?: number;
  priceLevel?: number;
  hours?: string;
  photoUrl?: string;
  photoUrls?: string[];
  mapsUrl?: string;
  costEstimate?: number;
  aiNotes?: string;
  website?: string;
  phone?: string;
  isSideQuest?: boolean;
}

export interface DriveLeg {
  id: string;
  fromStopId: string;
  toStopId: string;
  dayIndex: number;
  distanceMeters: number;
  durationSeconds: number;
  polyline?: string;
  exceedsMaxDrive?: boolean;
  fuelSuggested?: boolean;
}

export interface TripDay {
  index: number;
  date?: string;
  title: string;
  summary?: string;
  stopIds: string[];
  drivingHours: number;
  miles: number;
  estimatedSpend: number;
}

export interface BudgetBreakdown {
  fuel: number;
  lodging: number;
  food: number;
  activities: number;
  total: number;
  perDay: {
    dayIndex: number;
    total: number;
    fuel: number;
    lodging: number;
    food: number;
    activities: number;
  }[];
  notes?: string;
}

export interface Trip {
  id: string;
  title: string;
  vibe: string;
  prompt?: string;
  origin: LatLng & { address: string; placeId?: string };
  destinations: (LatLng & { address: string; placeId?: string; name?: string })[];
  roundTrip: boolean;
  startDate?: string;
  endDate?: string;
  travelers: number;
  days: TripDay[];
  stops: Stop[];
  legs: DriveLeg[];
  budget: BudgetBreakdown;
  totalMiles: number;
  totalDays: number;
  createdAt: string;
  updatedAt: string;
  packingList?: PackingItem[];
  boardImageUrl?: string;
  boardGeneratedAt?: string;
  highwayPreference?: HighwayPreference;
  activityTags?: ActivityTag[];
  generationSpeed?: GenerationSpeed;
}

export interface PackingItem {
  id: string;
  label: string;
  category: string;
  packed: boolean;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  tripPatchApplied?: boolean;
}

export type AutopilotPhase =
  | 'idle'
  | 'thinking'
  | 'places'
  | 'routing'
  | 'budget'
  | 'board'
  | 'done'
  | 'error';

export interface AutopilotLogEntry {
  id: string;
  at: number;
  phase: AutopilotPhase;
  text: string;
  kind?: 'status' | 'thought' | 'place' | 'route' | 'success' | 'warn';
}

export interface AutopilotProgress {
  step: string;
  detail: string;
  percent: number;
  phase: AutopilotPhase;
  log: AutopilotLogEntry[];
  streamPreview?: string;
}

export interface TripPatch {
  title?: string;
  vibe?: string;
  replaceTrip?: boolean;
  days?: TripDay[];
  stops?: Stop[];
  legs?: DriveLeg[];
  budget?: BudgetBreakdown;
  totalMiles?: number;
  totalDays?: number;
  packingList?: PackingItem[];
  message?: string;
}

export const OPENAI_MODELS = [
  'gpt-4.1',
  'gpt-4.1-mini',
  'gpt-4o',
  'gpt-4o-mini',
  'o4-mini',
] as const;

export const ANTHROPIC_MODELS = [
  'claude-sonnet-4-20250514',
  'claude-opus-4-20250514',
  'claude-3-5-haiku-20241022',
  'claude-3-5-sonnet-20241022',
] as const;

export const CATEGORY_COLORS: Record<StopCategory, string> = {
  origin: '#E8A54B',
  destination: '#E8A54B',
  food: '#D97757',
  lodging: '#6B8FCE',
  attraction: '#8FA88A',
  scenic: '#5BA3A8',
  fuel: '#C4A574',
  custom: '#9CA3AF',
};

export const AGE_GROUP_OPTIONS: { id: AgeGroup; label: string; blurb: string }[] = [
  { id: 'under21', label: 'Under 21', blurb: 'No bars · arcades, parks, thrills' },
  { id: 'young_adult', label: '21–34', blurb: 'Nightlife, foodie, networking' },
  { id: 'adult', label: '35–54', blurb: 'Balanced · views, food, culture' },
  { id: 'senior', label: '55+', blurb: 'Scenic, history, easy pace' },
];

export const ACTIVITY_TAG_OPTIONS: { id: ActivityTag; label: string; ages?: AgeGroup[] }[] = [
  { id: 'networking', label: 'Networking', ages: ['young_adult', 'adult'] },
  { id: 'games', label: 'Games / board cafés' },
  { id: 'escape_rooms', label: 'Escape rooms' },
  { id: 'parks', label: 'Parks' },
  { id: 'national_parks', label: 'National parks' },
  { id: 'state_parks', label: 'State parks' },
  { id: 'museums', label: 'Museums' },
  { id: 'nightlife', label: 'Nightlife', ages: ['young_adult', 'adult'] },
  { id: 'live_music', label: 'Live music' },
  { id: 'foodie', label: 'Foodie' },
  { id: 'street_food', label: 'Street food' },
  { id: 'coffee', label: 'Coffee' },
  { id: 'breweries', label: 'Breweries', ages: ['young_adult', 'adult', 'senior'] },
  { id: 'wineries', label: 'Wineries', ages: ['young_adult', 'adult', 'senior'] },
  { id: 'hiking', label: 'Hiking' },
  { id: 'beaches', label: 'Beaches' },
  { id: 'photography', label: 'Photography' },
  { id: 'quirky', label: 'Quirky roadside' },
  { id: 'roadside', label: 'Roadside attractions' },
  { id: 'shopping', label: 'Shopping' },
  { id: 'spas', label: 'Spas' },
  { id: 'sports', label: 'Sports' },
  { id: 'camping', label: 'Camping' },
  { id: 'history', label: 'History' },
  { id: 'art', label: 'Art' },
  { id: 'family', label: 'Family-friendly' },
  { id: 'pets', label: 'Pet-friendly' },
  { id: 'thrills', label: 'Thrills / rides', ages: ['under21', 'young_adult'] },
  { id: 'views', label: 'Scenic views' },
  { id: 'stargazing', label: 'Stargazing' },
  { id: 'farmers_markets', label: "Farmers' markets" },
  { id: 'arcades', label: 'Arcades', ages: ['under21', 'young_adult'] },
  { id: 'bowling', label: 'Bowling' },
  { id: 'karaoke', label: 'Karaoke', ages: ['under21', 'young_adult', 'adult'] },
  { id: 'comedy', label: 'Comedy', ages: ['young_adult', 'adult'] },
  { id: 'festivals', label: 'Festivals' },
  { id: 'waterfalls', label: 'Waterfalls' },
  { id: 'hot_springs', label: 'Hot springs' },
  { id: 'casinos', label: 'Casinos', ages: ['young_adult', 'adult', 'senior'] },
  { id: 'vintage', label: 'Vintage / thrift' },
];

export const DEFAULT_PROFILE: TravelerProfile = {
  home: null,
  travelStyle: 'balanced',
  interests: [],
  activityTags: [],
  budgetLevel: 'moderate',
  lodgingPreference: 'mix',
  maxDriveHoursPerDay: 6,
  partyType: 'couple',
  ageGroup: 'young_adult',
  highwayPreference: 'mix',
  vehicle: null,
  onboardingComplete: false,
};

export const DEFAULT_SETTINGS: AppSettings = {
  openaiModel: 'gpt-4.1',
  anthropicModel: 'claude-sonnet-4-20250514',
  theme: 'dark',
  vehicleMpg: null,
};
