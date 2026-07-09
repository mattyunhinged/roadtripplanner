import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { APIProvider, Map, useMap } from '@vis.gl/react-google-maps';
import {
  ArrowLeft,
  ArrowRight,
  Brain,
  Camera,
  CheckCircle2,
  Compass,
  MapPin,
  Navigation,
  Route,
  Sparkles,
  TriangleAlert,
  X,
  Zap,
} from 'lucide-react';
import { Button, Spinner, TextArea } from '@/components/ui';
import { runAutopilot } from '@/lib/ai/engine';
import { MAP_STYLES_DARK, MAP_STYLES_LIGHT } from '@/lib/google/maps';
import { cn } from '@/lib/utils';
import { useKeysStore } from '@/stores/keysStore';
import { useProfileStore } from '@/stores/profileStore';
import { useTripStore } from '@/stores/tripStore';
import { useUIStore } from '@/stores/uiStore';
import {
  ACTIVITY_TAG_OPTIONS,
  AGE_GROUP_OPTIONS,
  type ActivityTag,
  type AgeGroup,
  type AutopilotLogEntry,
  type GenerationSpeed,
  type HighwayPreference,
  type LatLng,
  type TripPrefs,
} from '@/types';

const WIZARD_STEPS = ['Start', 'Roads', 'Vibes', 'Mode', 'Generate'] as const;

function LogIcon({ kind }: { kind?: AutopilotLogEntry['kind'] }) {
  if (kind === 'place') return <MapPin className="h-3.5 w-3.5 text-[var(--color-sage)]" />;
  if (kind === 'route') return <Route className="h-3.5 w-3.5 text-[var(--color-sky)]" />;
  if (kind === 'thought') return <Brain className="h-3.5 w-3.5 text-[var(--accent)]" />;
  if (kind === 'success') return <CheckCircle2 className="h-3.5 w-3.5 text-[var(--color-success)]" />;
  if (kind === 'warn') return <TriangleAlert className="h-3.5 w-3.5 text-[var(--color-danger)]" />;
  return <Sparkles className="h-3.5 w-3.5 text-[var(--fg-subtle)]" />;
}

function StartMarker({ position }: { position: LatLng }) {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    const marker = new google.maps.Marker({
      map,
      position,
      title: 'Start',
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 11,
        fillColor: '#E8A54B',
        fillOpacity: 1,
        strokeColor: '#fff',
        strokeWeight: 2,
      },
    });
    map.panTo(position);
    return () => marker.setMap(null);
  }, [map, position.lat, position.lng]);
  return null;
}

function WaypointPreview() {
  const trip = useTripStore((s) => s.activeTrip);
  const map = useMap();

  useEffect(() => {
    if (!map || !trip?.stops.length) return;
    const markers: google.maps.Marker[] = [];
    const bounds = new google.maps.LatLngBounds();
    trip.stops.forEach((s, i) => {
      bounds.extend(s.location);
      markers.push(
        new google.maps.Marker({
          map,
          position: s.location,
          label: {
            text: String(i + 1),
            color: '#fff',
            fontSize: '11px',
            fontWeight: '700',
          },
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 12,
            fillColor: s.isSideQuest ? '#5BA3A8' : '#E8A54B',
            fillOpacity: 1,
            strokeColor: '#fff',
            strokeWeight: 2,
          },
        }),
      );
    });
    map.fitBounds(bounds, 48);
    return () => markers.forEach((m) => m.setMap(null));
  }, [map, trip?.id, trip?.updatedAt]);

  return null;
}

export function TripWizard() {
  const open = useUIStore((s) => s.tripWizardOpen);
  const setOpen = useUIStore((s) => s.setTripWizardOpen);
  const progress = useUIStore((s) => s.autopilotProgress);
  const clearProgress = useUIStore((s) => s.clearAutopilotProgress);
  const showToast = useUIStore((s) => s.showToast);
  const profile = useProfileStore((s) => s.profile);
  const mapsKey = useKeysStore((s) => s.keys?.googleMapsKey || '');
  const theme = useKeysStore((s) => s.settings.theme);
  const trip = useTripStore((s) => s.activeTrip);

  const [step, setStep] = useState(0);
  const [prompt, setPrompt] = useState('');
  const [startAddress, setStartAddress] = useState(profile.home?.address || '');
  const [startLocation, setStartLocation] = useState<LatLng | null>(
    profile.home?.location || null,
  );
  const [startPlaceId, setStartPlaceId] = useState(profile.home?.placeId);
  const [highways, setHighways] = useState<HighwayPreference>(profile.highwayPreference || 'mix');
  const [ageGroup, setAgeGroup] = useState<AgeGroup>(profile.ageGroup || 'young_adult');
  const [tags, setTags] = useState<ActivityTag[]>(
    profile.activityTags?.length ? [...profile.activityTags] : [],
  );
  const [speed, setSpeed] = useState<GenerationSpeed>('beautiful');
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setStep(0);
    setDone(false);
    setError('');
    setPrompt('');
    setStartAddress(profile.home?.address || '');
    setStartLocation(profile.home?.location || null);
    setStartPlaceId(profile.home?.placeId);
    setHighways(profile.highwayPreference || 'mix');
    setAgeGroup(profile.ageGroup || 'young_adult');
    setTags(profile.activityTags?.length ? [...profile.activityTags] : []);
    setSpeed('beautiful');
  }, [open]);

  useEffect(() => {
    if (!open || !mapsKey || !inputRef.current || !window.google?.maps?.places || step !== 0) return;
    const ac = new google.maps.places.Autocomplete(inputRef.current, {
      fields: ['formatted_address', 'geometry', 'place_id', 'name'],
    });
    ac.addListener('place_changed', () => {
      const place = ac.getPlace();
      if (!place.geometry?.location) return;
      setStartAddress(place.formatted_address || place.name || '');
      setStartLocation({
        lat: place.geometry.location.lat(),
        lng: place.geometry.location.lng(),
      });
      setStartPlaceId(place.place_id);
    });
  }, [open, mapsKey, step]);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [progress?.log.length, progress?.streamPreview]);

  const ageTags = useMemo(
    () => ACTIVITY_TAG_OPTIONS.filter((t) => !t.ages || t.ages.includes(ageGroup)),
    [ageGroup],
  );

  async function generate() {
    const value = prompt.trim() || 'surprise me with a great roadtrip from my start point';
    if (!startAddress) {
      setError('Pick a starting point first');
      setStep(0);
      return;
    }
    setRunning(true);
    setError('');
    setDone(false);
    setStep(4);
    const prefs: Partial<TripPrefs> = {
      startAddress,
      startLocation,
      startPlaceId,
      prompt: value,
      highwayPreference: highways,
      activityTags: tags,
      ageGroup,
      generationSpeed: speed,
    };
    try {
      const result = await runAutopilot(value, prefs);
      showToast(`locked in · ${result.title}`, 'success');
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Autopilot glitched');
    } finally {
      setRunning(false);
    }
  }

  function close() {
    if (running) return;
    setOpen(false);
    clearProgress();
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center bg-[var(--bg-overlay)] p-3 sm:items-center no-print"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={close}
        >
          <motion.div
            initial={{ y: 40, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 20, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="relative flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] shadow-[var(--shadow-soft)]"
          >
            <div className="relative z-10 flex items-start justify-between gap-3 border-b border-[var(--border)] px-5 py-4">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-[var(--bg-muted)] px-3 py-1 text-sm text-[var(--accent)]">
                  <Sparkles className="h-4 w-4" /> Trip wizard
                  {running && (
                    <span className="ml-1 inline-flex items-center gap-1 text-[var(--fg-muted)]">
                      <span className="relative flex h-2 w-2">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--accent)] opacity-60" />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--accent)]" />
                      </span>
                      cooking
                    </span>
                  )}
                </div>
                <h2 className="mt-1 font-display text-2xl md:text-3xl">build your roadtrip</h2>
              </div>
              <button type="button" disabled={running} onClick={close} className="rounded-full bg-[var(--bg-muted)] p-2">
                <X className="h-4 w-4" />
              </button>
            </div>

            {!running && !done && (
              <div className="relative z-10 flex flex-wrap gap-1.5 px-5 pt-3">
                {WIZARD_STEPS.slice(0, 4).map((label, i) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setStep(i)}
                    className={cn(
                      'rounded-full px-2.5 py-1 text-[11px]',
                      step === i
                        ? 'bg-[var(--fg)] text-[var(--bg)]'
                        : 'bg-[var(--bg-muted)] text-[var(--fg-muted)]',
                    )}
                  >
                    {i + 1}. {label}
                  </button>
                ))}
              </div>
            )}

            <div className="relative z-10 grid min-h-0 flex-1 gap-0 overflow-hidden lg:grid-cols-2">
              {/* Left: steps */}
              <div className="min-h-0 overflow-y-auto px-5 py-4">
                {step === 0 && !running && !done && (
                  <div className="space-y-4">
                    <h3 className="font-display text-xl">Starting point</h3>
                    <p className="text-sm text-[var(--fg-muted)]">
                      Every trip starts here. Defaults to home.
                    </p>
                    <input
                      ref={inputRef}
                      value={startAddress}
                      onChange={(e) => setStartAddress(e.target.value)}
                      placeholder="Where are we leaving from?"
                      className="glass-input h-12 w-full rounded-2xl px-4"
                    />
                    <TextArea
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      placeholder='optional vibe · "3 day surprise, food + views"'
                      className="min-h-[72px]"
                    />
                    <div className="flex justify-end">
                      <Button
                        variant="accent"
                        disabled={!startAddress}
                        onClick={() => setStep(1)}
                      >
                        Next <ArrowRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}

                {step === 1 && !running && !done && (
                  <div className="space-y-4">
                    <h3 className="font-display text-xl">Highways or scenic?</h3>
                    <div className="grid gap-2">
                      {(
                        [
                          ['highways', 'Highways', 'Fastest · interstates OK'],
                          ['mix', 'Mix', 'Balanced · some highway, some charm'],
                          ['scenic_roads', 'Scenic roads', 'Avoid interstates when we can'],
                        ] as const
                      ).map(([id, label, blurb]) => (
                        <button
                          key={id}
                          type="button"
                          onClick={() => setHighways(id)}
                          className={cn(
                            'rounded-2xl p-4 text-left transition',
                            highways === id
                              ? 'bg-[var(--accent)] text-[var(--accent-fg)]'
                              : 'bg-[var(--bg-muted)]',
                          )}
                        >
                          <div className="font-medium">{label}</div>
                          <div className={cn('text-sm', highways === id ? 'opacity-80' : 'text-[var(--fg-muted)]')}>
                            {blurb}
                          </div>
                        </button>
                      ))}
                    </div>
                    <div className="flex justify-between">
                      <Button variant="secondary" onClick={() => setStep(0)}>
                        <ArrowLeft className="h-4 w-4" /> Back
                      </Button>
                      <Button variant="accent" onClick={() => setStep(2)}>
                        Next <ArrowRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}

                {step === 2 && !running && !done && (
                  <div className="space-y-4">
                    <h3 className="font-display text-xl">Age + activity tags</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {AGE_GROUP_OPTIONS.map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => {
                            setAgeGroup(opt.id);
                            setTags((prev) =>
                              prev.filter((t) => {
                                const meta = ACTIVITY_TAG_OPTIONS.find((o) => o.id === t);
                                return !meta?.ages || meta.ages.includes(opt.id);
                              }),
                            );
                          }}
                          className={cn(
                            'rounded-2xl p-3 text-left text-sm',
                            ageGroup === opt.id
                              ? 'bg-[var(--fg)] text-[var(--bg)]'
                              : 'bg-[var(--bg-muted)]',
                          )}
                        >
                          <div className="font-medium">{opt.label}</div>
                          <div className="mt-0.5 text-[11px] opacity-70">{opt.blurb}</div>
                        </button>
                      ))}
                    </div>
                    <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
                      {ageTags.map((tag) => {
                        const active = tags.includes(tag.id);
                        return (
                          <button
                            key={tag.id}
                            type="button"
                            onClick={() =>
                              setTags((prev) =>
                                active ? prev.filter((t) => t !== tag.id) : [...prev, tag.id],
                              )
                            }
                            className={cn(
                              'rounded-full px-2.5 py-1 text-xs',
                              active
                                ? 'bg-[var(--accent)] text-[var(--accent-fg)]'
                                : 'bg-[var(--bg-muted)] text-[var(--fg-muted)]',
                            )}
                          >
                            {tag.label}
                          </button>
                        );
                      })}
                    </div>
                    <div className="flex justify-between">
                      <Button variant="secondary" onClick={() => setStep(1)}>
                        <ArrowLeft className="h-4 w-4" /> Back
                      </Button>
                      <Button variant="accent" onClick={() => setStep(3)}>
                        Next <ArrowRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}

                {step === 3 && !running && !done && (
                  <div className="space-y-4">
                    <h3 className="font-display text-xl">Generation mode</h3>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <button
                        type="button"
                        onClick={() => setSpeed('fast')}
                        className={cn(
                          'rounded-3xl p-5 text-left',
                          speed === 'fast'
                            ? 'bg-[var(--accent)] text-[var(--accent-fg)]'
                            : 'border border-[var(--border)] bg-[var(--bg-elevated)]',
                        )}
                      >
                        <Zap className="mb-2 h-5 w-5" />
                        <div className="font-display text-xl">Fast</div>
                        <p className={cn('mt-1 text-sm', speed === 'fast' ? 'opacity-80' : 'text-[var(--fg-muted)]')}>
                          Lean plan · fewer stops · quicker
                        </p>
                      </button>
                      <button
                        type="button"
                        onClick={() => setSpeed('beautiful')}
                        className={cn(
                          'rounded-3xl p-5 text-left',
                          speed === 'beautiful'
                            ? 'bg-[var(--accent)] text-[var(--accent-fg)]'
                            : 'border border-[var(--border)] bg-[var(--bg-elevated)]',
                        )}
                      >
                        <Camera className="mb-2 h-5 w-5" />
                        <div className="font-display text-xl">Beautiful</div>
                        <p className={cn('mt-1 text-sm', speed === 'beautiful' ? 'opacity-80' : 'text-[var(--fg-muted)]')}>
                          Richer · more scenic + side quests
                        </p>
                      </button>
                    </div>
                    <div className="rounded-2xl bg-[var(--bg-muted)] p-3 text-xs text-[var(--fg-muted)]">
                      <div>Start · {startAddress || '—'}</div>
                      <div>Roads · {highways}</div>
                      <div>Age · {ageGroup} · {tags.length} tags</div>
                    </div>
                    <div className="flex justify-between">
                      <Button variant="secondary" onClick={() => setStep(2)}>
                        <ArrowLeft className="h-4 w-4" /> Back
                      </Button>
                      <Button variant="accent" size="lg" onClick={generate}>
                        <Sparkles className="h-4 w-4" /> Generate trip
                      </Button>
                    </div>
                  </div>
                )}

                {(running || done || step === 4) && (
                  <div className="space-y-3">
                    {progress && (
                      <>
                        <div className="overflow-hidden rounded-2xl bg-[var(--bg-muted)]">
                          <div className="relative h-2 overflow-hidden bg-black/10 dark:bg-white/10">
                            <motion.div
                              className="h-full bg-gradient-to-r from-[var(--accent)] via-[var(--color-sky)] to-[var(--color-sage)]"
                              animate={{ width: `${progress.percent}%` }}
                            />
                          </div>
                          <div className="flex justify-between px-4 py-3 text-sm">
                            <span className="font-medium">{progress.step}</span>
                            <span className="text-[var(--fg-subtle)]">{progress.percent}%</span>
                          </div>
                        </div>
                        <div
                          ref={logRef}
                          className="max-h-52 space-y-1 overflow-y-auto rounded-2xl bg-[var(--bg-muted)] p-3"
                        >
                          {progress.log.map((entry) => (
                            <div key={entry.id} className="stream-line flex gap-2 px-2 py-1 text-sm">
                              <LogIcon kind={entry.kind} />
                              <span className="text-[var(--fg-muted)]">{entry.text}</span>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                    {error && (
                      <div className="rounded-2xl border border-[var(--color-danger)]/30 bg-[var(--color-danger)]/10 px-4 py-3 text-sm text-[var(--color-danger)]">
                        {error}
                        <div className="mt-2">
                          <Button size="sm" variant="secondary" onClick={generate}>
                            retry
                          </Button>
                        </div>
                      </div>
                    )}
                    {done && trip && (
                      <div className="space-y-3">
                        <div className="rounded-2xl bg-[var(--bg-muted)] p-4">
                          <div className="font-display text-xl">{trip.title}</div>
                          <p className="mt-1 text-sm text-[var(--fg-muted)]">{trip.vibe}</p>
                          <div className="mt-2 flex flex-wrap gap-2 text-xs">
                            <span className="rounded-full bg-[var(--bg-elevated)] px-2 py-0.5">
                              {trip.stops.length} waypoints
                            </span>
                            <span className="rounded-full bg-[var(--bg-elevated)] px-2 py-0.5">
                              {trip.stops.filter((s) => s.isSideQuest).length} side quests
                            </span>
                            <span className="rounded-full bg-[var(--bg-elevated)] px-2 py-0.5">
                              {Math.round(trip.totalMiles)} mi
                            </span>
                          </div>
                        </div>
                        <Button variant="accent" className="w-full" onClick={close}>
                          View on map
                        </Button>
                      </div>
                    )}
                    {running && (
                      <div className="flex items-center justify-center gap-2 text-sm text-[var(--fg-muted)]">
                        <Spinner className="h-4 w-4" /> building your arc…
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Right: live map */}
              <div className="relative hidden min-h-[280px] border-l border-[var(--border)] lg:block">
                {mapsKey ? (
                  <APIProvider apiKey={mapsKey} libraries={['places']}>
                    <Map
                      defaultCenter={startLocation || { lat: 39.8283, lng: -98.5795 }}
                      defaultZoom={startLocation ? 9 : 4}
                      gestureHandling="greedy"
                      disableDefaultUI
                      styles={theme === 'dark' ? MAP_STYLES_DARK : MAP_STYLES_LIGHT}
                      className="h-full w-full"
                    >
                      {done && trip ? (
                        <WaypointPreview />
                      ) : startLocation ? (
                        <StartMarker position={startLocation} />
                      ) : null}
                    </Map>
                  </APIProvider>
                ) : (
                  <div className="flex h-full items-center justify-center text-[var(--fg-muted)]">
                    Maps key needed
                  </div>
                )}
                <div className="pointer-events-none absolute left-3 top-3 flex flex-wrap gap-1.5">
                  <span className="pointer-events-auto inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] px-2.5 py-1 text-[11px] shadow-sm">
                    <Navigation className="h-3 w-3" /> map + waypoints
                  </span>
                  {done && (
                    <span className="pointer-events-auto inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] px-2.5 py-1 text-[11px] text-[var(--color-sky)] shadow-sm">
                      <Compass className="h-3 w-3" /> side quests teal
                    </span>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
