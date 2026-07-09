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
export type Interest =
  | 'nature'
  | 'food'
  | 'history'
  | 'nightlife'
  | 'photography'
  | 'quirky';

export type ThemeMode = 'light' | 'dark';

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

export interface TravelerProfile {
  home: {
    address: string;
    placeId?: string;
    location: LatLng;
  } | null;
  travelStyle: TravelStyle;
  interests: Interest[];
  budgetLevel: BudgetLevel;
  lodgingPreference: LodgingPreference;
  maxDriveHoursPerDay: number;
  partyType: PartyType;
  onboardingComplete: boolean;
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
  perDay: { dayIndex: number; total: number; fuel: number; lodging: number; food: number; activities: number }[];
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

export type AutopilotPhase = 'idle' | 'thinking' | 'places' | 'routing' | 'budget' | 'board' | 'done' | 'error';

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

export const DEFAULT_PROFILE: TravelerProfile = {
  home: null,
  travelStyle: 'balanced',
  interests: [],
  budgetLevel: 'moderate',
  lodgingPreference: 'mix',
  maxDriveHoursPerDay: 6,
  partyType: 'couple',
  onboardingComplete: false,
};

export const DEFAULT_SETTINGS: AppSettings = {
  openaiModel: 'gpt-4.1',
  anthropicModel: 'claude-sonnet-4-20250514',
  theme: 'dark',
  vehicleMpg: null,
};
