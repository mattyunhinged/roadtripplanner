import { useEffect, useMemo, useRef, useState } from 'react';
import { APIProvider, Map, useMap } from '@vis.gl/react-google-maps';
import { ArrowLeft, ArrowRight, Car, SkipForward } from 'lucide-react';
import { BrandLockup, Button, Label, Segmented } from '@/components/ui';
import { useKeysStore } from '@/stores/keysStore';
import { useProfileStore } from '@/stores/profileStore';
import { useUIStore } from '@/stores/uiStore';
import {
  AGE_GROUP_OPTIONS,
  ACTIVITY_TAG_OPTIONS,
  type ActivityTag,
  type AgeGroup,
  type BudgetLevel,
  type HighwayPreference,
  type LatLng,
  type LodgingPreference,
  type PartyType,
  type TravelStyle,
  type VehicleProfile,
} from '@/types';
import { cn } from '@/lib/utils';
import { MAP_STYLES_DARK, MAP_STYLES_LIGHT } from '@/lib/google/maps';
import { FUEL_LABELS, VEHICLE_BRANDS, findBrand, findModel } from '@/lib/vehicles';

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

const STEPS = ['Home', 'Ride', 'Age', 'Tags', 'Prefs'] as const;

export function OnboardingScreen() {
  const mapsKey = useKeysStore((s) => s.keys?.googleMapsKey || '');
  const theme = useKeysStore((s) => s.settings.theme);
  const setSettings = useKeysStore((s) => s.setSettings);
  const profile = useProfileStore((s) => s.profile);
  const setProfile = useProfileStore((s) => s.setProfile);
  const setScreen = useUIStore((s) => s.setScreen);

  const [step, setStep] = useState(0);
  const [address, setAddress] = useState(profile.home?.address || '');
  const [location, setLocation] = useState(profile.home?.location || { lat: 39.8283, lng: -98.5795 });
  const [placeId, setPlaceId] = useState(profile.home?.placeId);
  const [homeConfirmed, setHomeConfirmed] = useState(!!profile.home);
  const [brandId, setBrandId] = useState(profile.vehicle?.brandId || 'tesla');
  const [modelId, setModelId] = useState(profile.vehicle?.modelId || '');
  const [customMpg, setCustomMpg] = useState(String(profile.vehicle?.mpg ?? ''));
  const inputRef = useRef<HTMLInputElement>(null);

  const brand = findBrand(brandId);
  const models = brand?.models || [];
  const selectedModel = modelId ? findModel(brandId, modelId) : undefined;

  useEffect(() => {
    if (!mapsKey || !inputRef.current || !window.google?.maps?.places || step !== 0) return;
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

  useEffect(() => {
    if (selectedModel) {
      setCustomMpg(String(selectedModel.mpg ?? ''));
    }
  }, [selectedModel?.id]);

  const ageFilteredTags = useMemo(() => {
    return ACTIVITY_TAG_OPTIONS.filter(
      (t) => !t.ages || t.ages.includes(profile.ageGroup),
    );
  }, [profile.ageGroup]);

  function saveVehicle(): VehicleProfile | null {
    if (!brand || !selectedModel) return profile.vehicle;
    const mpg = customMpg ? Number(customMpg) : selectedModel.mpg ?? null;
    const vehicle: VehicleProfile = {
      brandId: brand.id,
      brandName: brand.name,
      modelId: selectedModel.id,
      modelName: selectedModel.name,
      fuelType: selectedModel.fuel,
      mpg,
      rangeMiles: selectedModel.rangeMiles ?? null,
      drivetrain: selectedModel.drivetrain ?? null,
    };
    setProfile({ vehicle });
    setSettings({ vehicleMpg: mpg });
    return vehicle;
  }

  function finish(skip = false) {
    if (!skip && homeConfirmed && address) {
      setProfile({ home: { address, location, placeId } });
    }
    saveVehicle();
    setProfile({ onboardingComplete: true });
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
      <div className="relative mx-auto flex min-h-full max-w-6xl flex-col gap-6 px-6 py-8">
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

        {/* Step dots */}
        <div className="flex flex-wrap items-center gap-2">
          {STEPS.map((label, i) => (
            <button
              key={label}
              type="button"
              onClick={() => setStep(i)}
              className={cn(
                'rounded-full px-3 py-1 text-xs transition',
                i === step
                  ? 'bg-[var(--fg)] text-[var(--bg)]'
                  : i < step
                    ? 'bg-[var(--bg-muted)] text-[var(--fg)]'
                    : 'bg-[var(--bg-muted)] text-[var(--fg-subtle)]',
              )}
            >
              {i + 1}. {label}
            </button>
          ))}
        </div>

        {step === 0 && (
          <div className="grid flex-1 gap-8 lg:grid-cols-2 lg:items-center">
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-[var(--fg-subtle)]">Step 1</p>
              <h1 className="mt-3 font-display text-4xl md:text-5xl">Where do you live?</h1>
              <p className="mt-3 max-w-md text-[var(--fg-muted)]">
                Pin home as your default start. You&apos;ll see it on the map.
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
                  className="glass-input h-12 w-full rounded-2xl px-4"
                />
                <Button
                  variant="accent"
                  size="lg"
                  className="mt-2"
                  disabled={!homeConfirmed}
                  onClick={() => {
                    setProfile({ home: { address, location, placeId } });
                    setStep(1);
                  }}
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
        )}

        {step === 1 && (
          <div className="mx-auto w-full max-w-3xl">
            <p className="text-sm uppercase tracking-[0.2em] text-[var(--fg-subtle)]">Step 2</p>
            <h1 className="mt-3 font-display text-4xl">Your ride</h1>
            <p className="mt-2 text-[var(--fg-muted)]">
              Brand → model → fuel/MPG. We use this for budget + charge/fuel stops.
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-3 md:grid-cols-4">
              {VEHICLE_BRANDS.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => {
                    setBrandId(b.id);
                    setModelId('');
                  }}
                  className={cn(
                    'rounded-2xl px-3 py-3 text-left text-sm transition',
                    brandId === b.id
                      ? 'bg-[var(--accent)] text-[var(--accent-fg)]'
                      : 'bg-[var(--bg-muted)] hover:ring-1 hover:ring-[var(--accent)]/40',
                  )}
                >
                  <Car className="mb-1 h-4 w-4 opacity-70" />
                  {b.name}
                </button>
              ))}
            </div>

            {brand && (
              <div className="mt-6">
                <Label>{brand.name} models</Label>
                <div className="mt-2 max-h-56 space-y-1.5 overflow-y-auto rounded-2xl bg-[var(--bg-muted)] p-2">
                  {models.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setModelId(m.id)}
                      className={cn(
                        'flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm transition',
                        modelId === m.id
                          ? 'bg-[var(--fg)] text-[var(--bg)]'
                          : 'hover:bg-white/10',
                      )}
                    >
                      <span>{m.name}</span>
                      <span className="text-xs opacity-70">
                        {FUEL_LABELS[m.fuel]}
                        {m.mpg ? ` · ${m.mpg}` : ''}
                        {m.drivetrain ? ` · ${m.drivetrain}` : ''}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {selectedModel && (
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl bg-[var(--bg-muted)] p-3 text-sm">
                  <div className="text-[var(--fg-subtle)]">Fuel</div>
                  <div className="font-medium">{FUEL_LABELS[selectedModel.fuel]}</div>
                </div>
                <div className="rounded-2xl bg-[var(--bg-muted)] p-3 text-sm">
                  <div className="text-[var(--fg-subtle)]">MPG / MPGe</div>
                  <input
                    value={customMpg}
                    onChange={(e) => setCustomMpg(e.target.value)}
                    className="glass-input mt-1 h-9 w-full rounded-lg px-2"
                  />
                </div>
                <div className="rounded-2xl bg-[var(--bg-muted)] p-3 text-sm">
                  <div className="text-[var(--fg-subtle)]">Range</div>
                  <div className="font-medium">
                    {selectedModel.rangeMiles ? `${selectedModel.rangeMiles} mi` : '—'}
                  </div>
                </div>
              </div>
            )}

            <div className="mt-6 flex gap-3">
              <Button variant="secondary" onClick={() => setStep(0)}>
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
              <Button
                variant="accent"
                size="lg"
                disabled={!modelId}
                onClick={() => {
                  saveVehicle();
                  setStep(2);
                }}
              >
                Continue <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="mx-auto w-full max-w-3xl">
            <p className="text-sm uppercase tracking-[0.2em] text-[var(--fg-subtle)]">Step 3</p>
            <h1 className="mt-3 font-display text-4xl">Age group</h1>
            <p className="mt-2 text-[var(--fg-muted)]">
              Shapes side quests (under 21 = no bars, more arcades/parks, etc).
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {AGE_GROUP_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setProfile({ ageGroup: opt.id as AgeGroup })}
                  className={cn(
                    'rounded-3xl p-5 text-left transition',
                    profile.ageGroup === opt.id
                      ? 'bg-[var(--accent)] text-[var(--accent-fg)] shadow-lg'
                      : 'border border-[var(--border)] bg-[var(--bg-elevated)] hover:ring-1 hover:ring-[var(--accent)]/40',
                  )}
                >
                  <div className="font-display text-2xl">{opt.label}</div>
                  <div
                    className={cn(
                      'mt-1 text-sm',
                      profile.ageGroup === opt.id ? 'opacity-80' : 'text-[var(--fg-muted)]',
                    )}
                  >
                    {opt.blurb}
                  </div>
                </button>
              ))}
            </div>
            <div className="mt-6 flex gap-3">
              <Button variant="secondary" onClick={() => setStep(1)}>
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
              <Button variant="accent" size="lg" onClick={() => setStep(3)}>
                Continue <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="mx-auto w-full max-w-3xl">
            <p className="text-sm uppercase tracking-[0.2em] text-[var(--fg-subtle)]">Step 4</p>
            <h1 className="mt-3 font-display text-4xl">What are you into?</h1>
            <p className="mt-2 text-[var(--fg-muted)]">
              Pick as many as you want — side activities follow these tags.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {ageFilteredTags.map((tag) => {
                const active = profile.activityTags.includes(tag.id);
                return (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => {
                      const activityTags = active
                        ? profile.activityTags.filter((t) => t !== tag.id)
                        : [...profile.activityTags, tag.id];
                      setProfile({ activityTags, interests: activityTags });
                    }}
                    className={cn(
                      'rounded-full px-3 py-1.5 text-sm transition',
                      active
                        ? 'bg-[var(--accent)] text-[var(--accent-fg)]'
                        : 'bg-[var(--bg-muted)] text-[var(--fg-muted)] hover:text-[var(--fg)]',
                    )}
                  >
                    {tag.label}
                  </button>
                );
              })}
            </div>
            <div className="mt-6 flex gap-3">
              <Button variant="secondary" onClick={() => setStep(2)}>
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
              <Button variant="accent" size="lg" onClick={() => setStep(4)}>
                Continue <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="mx-auto w-full max-w-3xl">
            <p className="text-sm uppercase tracking-[0.2em] text-[var(--fg-subtle)]">Step 5</p>
            <h1 className="mt-3 font-display text-4xl">Trip defaults</h1>
            <p className="mt-2 text-[var(--fg-muted)]">Skippable — Autopilot uses these every time.</p>

            <div className="mt-8 space-y-8">
              <div>
                <Label>Highways?</Label>
                <Segmented<HighwayPreference>
                  value={profile.highwayPreference}
                  onChange={(highwayPreference) => setProfile({ highwayPreference })}
                  options={[
                    { value: 'highways', label: 'Highways' },
                    { value: 'mix', label: 'Mix' },
                    { value: 'scenic_roads', label: 'Scenic roads' },
                  ]}
                />
              </div>
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
                    onChange={(e) =>
                      setProfile({ lodgingPreference: e.target.value as LodgingPreference })
                    }
                    className="glass-input h-11 w-full rounded-xl px-3"
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
                <Button variant="secondary" onClick={() => setStep(3)}>
                  <ArrowLeft className="h-4 w-4" /> Back
                </Button>
                <Button variant="accent" size="lg" onClick={() => finish(false)}>
                  Start planning <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
