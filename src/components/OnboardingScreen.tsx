import { useEffect, useRef, useState } from 'react';
import { APIProvider, Map, useMap } from '@vis.gl/react-google-maps';
import { ArrowRight, SkipForward } from 'lucide-react';
import { BrandLockup, Button, Label, Segmented } from '@/components/ui';
import { useKeysStore } from '@/stores/keysStore';
import { useProfileStore } from '@/stores/profileStore';
import { useUIStore } from '@/stores/uiStore';
import type { BudgetLevel, Interest, LodgingPreference, PartyType, TravelStyle, LatLng } from '@/types';
import { cn } from '@/lib/utils';
import { MAP_STYLES_DARK, MAP_STYLES_LIGHT } from '@/lib/google/maps';

function HomeMarker({ position, visible }: { position: LatLng; visible: boolean }) {
  const map = useMap();
  useEffect(() => {
    if (!map || !visible) return;
    const marker = new google.maps.Marker({
      map,
      position,
      title: 'Home',
      label: { text: 'H', color: '#121614', fontWeight: '700' },
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 12,
        fillColor: '#E8A54B',
        fillOpacity: 1,
        strokeColor: '#ffffff',
        strokeWeight: 2,
      },
    });
    return () => marker.setMap(null);
  }, [map, position.lat, position.lng, visible]);
  return null;
}

const INTERESTS: { id: Interest; label: string }[] = [
  { id: 'nature', label: 'Nature' },
  { id: 'food', label: 'Food' },
  { id: 'history', label: 'History' },
  { id: 'nightlife', label: 'Nightlife' },
  { id: 'photography', label: 'Photography' },
  { id: 'quirky', label: 'Quirky roadside' },
];

export function OnboardingScreen() {
  const mapsKey = useKeysStore((s) => s.keys?.googleMapsKey || '');
  const theme = useKeysStore((s) => s.settings.theme);
  const profile = useProfileStore((s) => s.profile);
  const setProfile = useProfileStore((s) => s.setProfile);
  const setScreen = useUIStore((s) => s.setScreen);

  const [step, setStep] = useState(0);
  const [address, setAddress] = useState(profile.home?.address || '');
  const [location, setLocation] = useState(profile.home?.location || { lat: 39.8283, lng: -98.5795 });
  const [placeId, setPlaceId] = useState(profile.home?.placeId);
  const [homeConfirmed, setHomeConfirmed] = useState(!!profile.home);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!mapsKey || !inputRef.current || !window.google?.maps?.places) return;
    const autocomplete = new google.maps.places.Autocomplete(inputRef.current, {
      fields: ['formatted_address', 'geometry', 'place_id', 'name'],
      types: ['geocode'],
    });
    autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace();
      if (!place.geometry?.location) return;
      const loc = {
        lat: place.geometry.location.lat(),
        lng: place.geometry.location.lng(),
      };
      setAddress(place.formatted_address || place.name || '');
      setLocation(loc);
      setPlaceId(place.place_id);
      setHomeConfirmed(true);
    });
  }, [mapsKey, step]);

  function saveHomeAndNext() {
    if (homeConfirmed && address) {
      setProfile({
        home: { address, location, placeId },
      });
    }
    setStep(1);
  }

  function finish(skipPrefs = false) {
    if (!skipPrefs) {
      setProfile({ onboardingComplete: true });
    } else {
      setProfile({ onboardingComplete: true });
    }
    setScreen('planner');
  }

  return (
    <div className="relative min-h-full overflow-hidden">
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at top left, rgba(91,163,168,0.12), transparent 45%), linear-gradient(180deg, var(--bg), var(--bg-muted))',
        }}
      />
      <div className="relative mx-auto flex min-h-full max-w-6xl flex-col gap-8 px-6 py-10">
        <div className="flex items-center justify-between">
          <BrandLockup />
          <button
            type="button"
            className="inline-flex items-center gap-2 text-sm text-[var(--fg-muted)] hover:text-[var(--fg)]"
            onClick={() => finish(true)}
          >
            Skip <SkipForward className="h-4 w-4" />
          </button>
        </div>

        {step === 0 ? (
          <div className="grid flex-1 gap-8 lg:grid-cols-2 lg:items-center">
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-[var(--fg-subtle)]">Step 1</p>
              <h1 className="mt-3 font-display text-4xl md:text-5xl">Where do you live?</h1>
              <p className="mt-3 max-w-md text-[var(--fg-muted)]">
                We&apos;ll pin home as your default trip origin and personalize Autopilot around it.
              </p>
              <div className="mt-8 space-y-3">
                <Label>Home address</Label>
                <input
                  ref={inputRef}
                  value={address}
                  onChange={(e) => {
                    setAddress(e.target.value);
                    setHomeConfirmed(false);
                  }}
                  placeholder="Start typing your city or address…"
                  className="h-12 w-full rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] px-4 outline-none focus:border-[var(--accent)]"
                />
                <Button
                  variant="accent"
                  size="lg"
                  className="mt-2"
                  disabled={!homeConfirmed}
                  onClick={saveHomeAndNext}
                >
                  Pin home & continue <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="h-[360px] overflow-hidden rounded-3xl border border-[var(--border)] shadow-[var(--shadow-soft)] lg:h-[480px]">
              {mapsKey ? (
                <APIProvider apiKey={mapsKey} libraries={['places']}>
                  <Map
                    defaultZoom={homeConfirmed ? 11 : 4}
                    defaultCenter={location}
                    center={location}
                    zoom={homeConfirmed ? 11 : 4}
                    gestureHandling="greedy"
                    disableDefaultUI
                    styles={theme === 'dark' ? MAP_STYLES_DARK : MAP_STYLES_LIGHT}
                    className="h-full w-full"
                  >
                    <HomeMarker position={location} visible={homeConfirmed} />
                  </Map>
                </APIProvider>
              ) : (
                <div className="flex h-full items-center justify-center text-[var(--fg-muted)]">
                  Maps key required
                </div>
              )}
            </div>
          </div>
        ) : (
          <PrefsStep
            onBack={() => setStep(0)}
            onFinish={() => finish(false)}
          />
        )}
      </div>
    </div>
  );
}

function PrefsStep({ onBack, onFinish }: { onBack: () => void; onFinish: () => void }) {
  const profile = useProfileStore((s) => s.profile);
  const setProfile = useProfileStore((s) => s.setProfile);

  return (
    <div className="mx-auto w-full max-w-3xl">
      <p className="text-sm uppercase tracking-[0.2em] text-[var(--fg-subtle)]">Step 2</p>
      <h1 className="mt-3 font-display text-4xl">Quick preferences</h1>
      <p className="mt-2 text-[var(--fg-muted)]">All optional — Autopilot uses these to personalize every trip.</p>

      <div className="mt-8 space-y-8">
        <div>
          <Label>Travel style</Label>
          <Segmented<TravelStyle>
            value={profile.travelStyle}
            onChange={(travelStyle) => setProfile({ travelStyle })}
            options={[
              { value: 'scenic', label: 'Scenic' },
              { value: 'balanced', label: 'Balanced' },
              { value: 'fastest', label: 'Fastest' },
            ]}
          />
        </div>

        <div>
          <Label>Interests</Label>
          <div className="flex flex-wrap gap-2">
            {INTERESTS.map((item) => {
              const active = profile.interests.includes(item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    const interests = active
                      ? profile.interests.filter((i) => i !== item.id)
                      : [...profile.interests, item.id];
                    setProfile({ interests });
                  }}
                  className={cn(
                    'rounded-full border px-3 py-1.5 text-sm transition',
                    active
                      ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-fg)]'
                      : 'border-[var(--border)] text-[var(--fg-muted)] hover:border-[var(--border-strong)]',
                  )}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <Label>Budget</Label>
            <Segmented<BudgetLevel>
              value={profile.budgetLevel}
              onChange={(budgetLevel) => setProfile({ budgetLevel })}
              options={[
                { value: 'budget', label: 'Budget' },
                { value: 'moderate', label: 'Moderate' },
                { value: 'luxury', label: 'Luxury' },
              ]}
            />
          </div>
          <div>
            <Label>Lodging</Label>
            <select
              value={profile.lodgingPreference}
              onChange={(e) => setProfile({ lodgingPreference: e.target.value as LodgingPreference })}
              className="h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3"
            >
              <option value="mix">Mix</option>
              <option value="hotels">Hotels</option>
              <option value="motels">Motels</option>
              <option value="camping">Camping</option>
            </select>
          </div>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <Label>Max hours driving / day: {profile.maxDriveHoursPerDay}h</Label>
            <input
              type="range"
              min={3}
              max={12}
              step={1}
              value={profile.maxDriveHoursPerDay}
              onChange={(e) => setProfile({ maxDriveHoursPerDay: Number(e.target.value) })}
              className="w-full accent-[var(--accent)]"
            />
          </div>
          <div>
            <Label>Traveling as</Label>
            <Segmented<PartyType>
              value={profile.partyType}
              onChange={(partyType) => setProfile({ partyType })}
              options={[
                { value: 'solo', label: 'Solo' },
                { value: 'couple', label: 'Couple' },
                { value: 'family', label: 'Family' },
                { value: 'pets', label: 'Pets' },
              ]}
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-3 pt-2">
          <Button variant="secondary" onClick={onBack}>
            Back
          </Button>
          <Button variant="accent" size="lg" onClick={onFinish}>
            Start planning <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
