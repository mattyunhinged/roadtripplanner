import { useState } from 'react';
import { Check, Moon, Plus, Sun, Trash2, Users, X } from 'lucide-react';
import { Button, FieldError, Input, Label, Segmented, Spinner } from '@/components/ui';
import { getAIProvider } from '@/lib/ai/provider';
import { validateGoogleMapsKey } from '@/lib/google/maps';
import { detectProvider } from '@/lib/utils';
import { maskKey } from '@/lib/storage';
import { useKeysStore } from '@/stores/keysStore';
import { useProfileStore } from '@/stores/profileStore';
import { useUIStore } from '@/stores/uiStore';
import {
  ANTHROPIC_MODELS,
  GUEST_AGE_OPTIONS,
  OPENAI_MODELS,
  type AIProviderId,
  type GuestAgeRange,
  type TripGuest,
} from '@/types';

export function SettingsScreen() {
  const keys = useKeysStore((s) => s.keys);
  const settings = useKeysStore((s) => s.settings);
  const setKeys = useKeysStore((s) => s.setKeys);
  const updateKeys = useKeysStore((s) => s.updateKeys);
  const clearKeys = useKeysStore((s) => s.clearKeys);
  const setSettings = useKeysStore((s) => s.setSettings);
  const profile = useProfileStore((s) => s.profile);
  const setProfile = useProfileStore((s) => s.setProfile);
  const setScreen = useUIStore((s) => s.setScreen);
  const showToast = useUIStore((s) => s.showToast);

  const [aiKey, setAiKey] = useState(keys?.aiKey || '');
  const [mapsKey, setMapsKey] = useState(keys?.googleMapsKey || '');
  const [provider, setProvider] = useState<AIProviderId>(keys?.aiProvider || 'openai');
  const [persist, setPersist] = useState(keys?.persist ?? true);
  const [aiStatus, setAiStatus] = useState<'idle' | 'checking' | 'valid' | 'invalid'>('idle');
  const [mapsStatus, setMapsStatus] = useState<'idle' | 'checking' | 'valid' | 'invalid'>('idle');
  const [aiError, setAiError] = useState('');
  const [mapsError, setMapsError] = useState('');
  const [mpg, setMpg] = useState(String(settings.vehicleMpg ?? ''));
  const [displayName, setDisplayName] = useState(profile.displayName || '');
  const [guests, setGuests] = useState<TripGuest[]>(
    profile.guests?.length ? profile.guests.map((g) => ({ ...g })) : [],
  );
  const [guestDraftName, setGuestDraftName] = useState('');
  const [guestDraftAge, setGuestDraftAge] = useState<GuestAgeRange>('young_adult');

  function persistCrew(nextName = displayName, nextGuests = guests) {
    const count = 1 + nextGuests.length;
    let partyType = profile.partyType;
    if (count === 1) partyType = 'solo';
    else if (count === 2) partyType = 'couple';
    else partyType = 'family';
    if (nextGuests.some((g) => g.ageRange === 'child' || g.ageRange === 'teen')) {
      partyType = 'family';
    }
    setProfile({
      displayName: nextName.trim(),
      guests: nextGuests,
      partyType,
    });
  }

  async function save() {
    const model = provider === 'openai' ? settings.openaiModel : settings.anthropicModel;
    setAiStatus('checking');
    setMapsStatus('checking');
    const ai = await getAIProvider(provider).validate(aiKey.trim(), model);
    const maps = await validateGoogleMapsKey(mapsKey.trim());
    setAiStatus(ai.valid ? 'valid' : 'invalid');
    setMapsStatus(maps.valid ? 'valid' : 'invalid');
    setAiError(ai.error || '');
    setMapsError(maps.error || '');
    if (!ai.valid || !maps.valid) return;

    setKeys({
      aiKey: aiKey.trim(),
      aiProvider: provider,
      googleMapsKey: mapsKey.trim(),
      persist,
    });
    setSettings({
      vehicleMpg: mpg ? Number(mpg) : null,
    });
    persistCrew();
    showToast('Settings saved', 'success');
    setScreen('planner');
  }

  return (
    <div className="min-h-full overflow-y-auto bg-[var(--bg)]">
      <div className="mx-auto max-w-2xl px-6 py-10">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="font-display text-3xl">Settings</h1>
          <button type="button" onClick={() => setScreen('planner')} className="rounded-full p-2 hover:bg-[var(--bg-muted)]">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-8">
          <section className="rounded-3xl border border-[var(--border)] bg-[var(--bg-elevated)] p-5">
            <h2 className="font-medium">You & crew</h2>
            <p className="mt-1 text-sm text-[var(--fg-muted)]">
              Autopilot addresses you by name and plans for every guest&apos;s age range.
            </p>
            <div className="mt-4 space-y-4">
              <div>
                <Label>Your name</Label>
                <Input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  onBlur={() => persistCrew()}
                  placeholder="First name"
                />
              </div>
              <div>
                <div className="mb-2 flex items-center gap-2 text-sm text-[var(--fg-muted)]">
                  <Users className="h-4 w-4 text-[var(--accent)]" />
                  Guests · {guests.length}
                </div>
                <div className="space-y-2">
                  {guests.map((g) => (
                    <div key={g.id} className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <Input
                        value={g.name}
                        onChange={(e) => {
                          const next = guests.map((x) =>
                            x.id === g.id ? { ...x, name: e.target.value } : x,
                          );
                          setGuests(next);
                        }}
                        onBlur={() => persistCrew(displayName, guests)}
                        placeholder="Guest name"
                      />
                      <select
                        value={g.ageRange}
                        onChange={(e) => {
                          const next = guests.map((x) =>
                            x.id === g.id
                              ? { ...x, ageRange: e.target.value as GuestAgeRange }
                              : x,
                          );
                          setGuests(next);
                          persistCrew(displayName, next);
                        }}
                        className="h-11 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 sm:w-44"
                      >
                        {GUEST_AGE_OPTIONS.map((opt) => (
                          <option key={opt.id} value={opt.id}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => {
                          const next = guests.filter((x) => x.id !== g.id);
                          setGuests(next);
                          persistCrew(displayName, next);
                        }}
                        className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-[var(--fg-muted)] hover:bg-[var(--bg-muted)] hover:text-[var(--color-danger)]"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <Input
                    value={guestDraftName}
                    onChange={(e) => setGuestDraftName(e.target.value)}
                    placeholder="Add guest name"
                  />
                  <select
                    value={guestDraftAge}
                    onChange={(e) => setGuestDraftAge(e.target.value as GuestAgeRange)}
                    className="h-11 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 sm:w-44"
                  >
                    {GUEST_AGE_OPTIONS.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <Button
                    variant="secondary"
                    disabled={!guestDraftName.trim()}
                    onClick={() => {
                      const next = [
                        ...guests,
                        {
                          id: crypto.randomUUID(),
                          name: guestDraftName.trim(),
                          ageRange: guestDraftAge,
                        },
                      ];
                      setGuests(next);
                      setGuestDraftName('');
                      persistCrew(displayName, next);
                    }}
                  >
                    <Plus className="h-4 w-4" /> Add
                  </Button>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-[var(--border)] bg-[var(--bg-elevated)] p-5">
            <h2 className="font-medium">Appearance</h2>
            <div className="mt-3 flex items-center gap-3">
              <Button
                variant={settings.theme === 'light' ? 'primary' : 'secondary'}
                onClick={() => setSettings({ theme: 'light' })}
              >
                <Sun className="h-4 w-4" /> Light
              </Button>
              <Button
                variant={settings.theme === 'dark' ? 'primary' : 'secondary'}
                onClick={() => setSettings({ theme: 'dark' })}
              >
                <Moon className="h-4 w-4" /> Dark
              </Button>
            </div>
          </section>

          <section className="rounded-3xl border border-[var(--border)] bg-[var(--bg-elevated)] p-5">
            <h2 className="font-medium">AI provider</h2>
            <div className="mt-3 space-y-4">
              <Segmented
                value={provider}
                onChange={(v) => {
                  setProvider(v);
                  const detected = detectProvider(aiKey);
                  if (detected) setProvider(detected);
                }}
                options={[
                  { value: 'openai', label: 'OpenAI' },
                  { value: 'anthropic', label: 'Anthropic' },
                ]}
              />
              <div>
                <Label>API key {keys?.aiKey ? `(${maskKey(keys.aiKey)})` : ''}</Label>
                <Input
                  type="password"
                  value={aiKey}
                  onChange={(e) => {
                    setAiKey(e.target.value);
                    const detected = detectProvider(e.target.value);
                    if (detected) setProvider(detected);
                    setAiStatus('idle');
                  }}
                />
                <FieldError>{aiError}</FieldError>
                {aiStatus === 'valid' && (
                  <p className="mt-1 text-sm text-[var(--color-success)] inline-flex items-center gap-1">
                    <Check className="h-3.5 w-3.5" /> Valid
                  </p>
                )}
              </div>
              <div>
                <Label>Model</Label>
                <select
                  className="h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3"
                  value={provider === 'openai' ? settings.openaiModel : settings.anthropicModel}
                  onChange={(e) =>
                    setSettings(
                      provider === 'openai'
                        ? { openaiModel: e.target.value }
                        : { anthropicModel: e.target.value },
                    )
                  }
                >
                  {(provider === 'openai' ? OPENAI_MODELS : ANTHROPIC_MODELS).map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-[var(--border)] bg-[var(--bg-elevated)] p-5">
            <h2 className="font-medium">Google Maps</h2>
            <div className="mt-3">
              <Label>API key {keys?.googleMapsKey ? `(${maskKey(keys.googleMapsKey)})` : ''}</Label>
              <Input
                type="password"
                value={mapsKey}
                onChange={(e) => {
                  setMapsKey(e.target.value);
                  setMapsStatus('idle');
                }}
              />
              <FieldError>{mapsError}</FieldError>
            </div>
          </section>

          <section className="rounded-3xl border border-[var(--border)] bg-[var(--bg-elevated)] p-5">
            <h2 className="font-medium">Vehicle / MPG</h2>
            <p className="mt-1 text-sm text-[var(--fg-muted)]">
              Full brand + model picker lives in onboarding. Override MPG/MPGe here anytime.
            </p>
            <div className="mt-3">
              <Label>MPG / MPGe</Label>
              <Input value={mpg} onChange={(e) => setMpg(e.target.value)} placeholder="28" />
            </div>
          </section>

          <label className="flex items-center gap-3 text-sm text-[var(--fg-muted)]">
            <input
              type="checkbox"
              checked={persist}
              onChange={(e) => setPersist(e.target.checked)}
              className="accent-[var(--accent)]"
            />
            Persist keys on this device
          </label>

          <div className="flex flex-wrap gap-3">
            <Button variant="accent" onClick={save}>
              {(aiStatus === 'checking' || mapsStatus === 'checking') && <Spinner />}
              Save settings
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                clearKeys();
                setScreen('keys');
              }}
            >
              <Trash2 className="h-4 w-4" /> Remove keys
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                updateKeys({ persist: false });
                showToast('Keys will not persist after this session', 'info');
              }}
            >
              Session only
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
