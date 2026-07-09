import { useEffect, useMemo, useState } from 'react';
import { Check, KeyRound, MapPinned, Sparkles } from 'lucide-react';
import { BrandLockup, Button, FieldError, Input, Label, Segmented, Spinner } from '@/components/ui';
import { getAIProvider } from '@/lib/ai/provider';
import { validateGoogleMapsKey } from '@/lib/google/maps';
import { detectProvider, cn } from '@/lib/utils';
import { useKeysStore } from '@/stores/keysStore';
import { useUIStore } from '@/stores/uiStore';
import type { AIProviderId } from '@/types';

type KeyStatus = 'idle' | 'checking' | 'valid' | 'invalid';

export function KeySetupScreen() {
  const setKeys = useKeysStore((s) => s.setKeys);
  const settings = useKeysStore((s) => s.settings);
  const setScreen = useUIStore((s) => s.setScreen);

  const [aiKey, setAiKey] = useState('');
  const [provider, setProvider] = useState<AIProviderId>('openai');
  const [mapsKey, setMapsKey] = useState('');
  const [persist, setPersist] = useState(true);
  const [aiStatus, setAiStatus] = useState<KeyStatus>('idle');
  const [mapsStatus, setMapsStatus] = useState<KeyStatus>('idle');
  const [aiError, setAiError] = useState('');
  const [mapsError, setMapsError] = useState('');

  useEffect(() => {
    const detected = detectProvider(aiKey);
    if (detected) setProvider(detected);
  }, [aiKey]);

  const canContinue = aiStatus === 'valid' && mapsStatus === 'valid';

  const model = useMemo(
    () => (provider === 'openai' ? settings.openaiModel : settings.anthropicModel),
    [provider, settings],
  );

  async function validateAI() {
    if (!aiKey.trim()) {
      setAiStatus('invalid');
      setAiError('Paste an OpenAI or Anthropic API key');
      return;
    }
    setAiStatus('checking');
    setAiError('');
    const result = await getAIProvider(provider).validate(aiKey.trim(), model);
    if (result.valid) {
      setAiStatus('valid');
    } else {
      setAiStatus('invalid');
      setAiError(result.error || 'AI key validation failed');
    }
  }

  async function validateMaps() {
    if (!mapsKey.trim()) {
      setMapsStatus('invalid');
      setMapsError('Paste a Google Maps API key');
      return;
    }
    setMapsStatus('checking');
    setMapsError('');
    const result = await validateGoogleMapsKey(mapsKey.trim());
    if (result.valid) {
      setMapsStatus('valid');
    } else {
      setMapsStatus('invalid');
      setMapsError(result.error || 'Maps key validation failed');
    }
  }

  function continueSetup() {
    setKeys({
      aiKey: aiKey.trim(),
      aiProvider: provider,
      googleMapsKey: mapsKey.trim(),
      persist,
    });
    setScreen('onboarding');
  }

  return (
    <div className="relative min-h-full overflow-hidden">
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 20% 10%, rgba(232,165,75,0.18), transparent 55%), radial-gradient(ellipse 70% 50% at 90% 80%, rgba(143,168,138,0.16), transparent 50%), linear-gradient(160deg, var(--bg) 0%, var(--bg-muted) 100%)',
        }}
      />
      <div className="relative mx-auto flex min-h-full max-w-5xl flex-col justify-center gap-10 px-6 py-12 lg:flex-row lg:items-center lg:gap-16">
        <div className="max-w-md">
          <BrandLockup large />
          <h1 className="mt-8 font-display text-4xl leading-tight md:text-5xl">
            Your AI roadtrip planner, ready when you are.
          </h1>
          <p className="mt-4 text-lg text-[var(--fg-muted)]">
            Autopilot builds complete trips — routes, food, lodging, scenic detours — synced to a live map.
          </p>
          <div className="mt-8 flex flex-wrap gap-3 text-sm text-[var(--fg-subtle)]">
            <span className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] px-3 py-1.5">
              <Sparkles className="h-4 w-4 text-[var(--accent)]" /> Autopilot AI
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] px-3 py-1.5">
              <MapPinned className="h-4 w-4 text-[var(--color-sage)]" /> Live Google Maps
            </span>
          </div>
        </div>

        <div className="liquid-composer w-full max-w-md rounded-[28px] p-6 md:p-8">
          <div className="relative z-10">
          <div className="mb-6 flex items-center gap-2 text-sm font-medium text-[var(--fg-muted)]">
            <KeyRound className="h-4 w-4" /> First launch setup
          </div>

          <div className="space-y-5">
            <div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <Label className="mb-0">AI provider key</Label>
                <Segmented
                  value={provider}
                  onChange={setProvider}
                  options={[
                    { value: 'openai', label: 'OpenAI' },
                    { value: 'anthropic', label: 'Anthropic' },
                  ]}
                />
              </div>
              <div className="flex gap-2">
                <Input
                  type="password"
                  autoComplete="off"
                  placeholder={provider === 'anthropic' ? 'sk-ant-…' : 'sk-…'}
                  value={aiKey}
                  onChange={(e) => {
                    setAiKey(e.target.value);
                    setAiStatus('idle');
                    setAiError('');
                  }}
                />
                <Button variant="secondary" onClick={validateAI} disabled={aiStatus === 'checking'}>
                  {aiStatus === 'checking' ? <Spinner /> : aiStatus === 'valid' ? <Check className="h-4 w-4 text-[var(--color-success)]" /> : 'Test'}
                </Button>
              </div>
              <FieldError>{aiError}</FieldError>
              {aiStatus === 'valid' && (
                <p className="mt-1.5 text-sm text-[var(--color-success)]">AI key looks good</p>
              )}
            </div>

            <div>
              <Label>Google Maps API key</Label>
              <div className="flex gap-2">
                <Input
                  type="password"
                  autoComplete="off"
                  placeholder="AIza…"
                  value={mapsKey}
                  onChange={(e) => {
                    setMapsKey(e.target.value);
                    setMapsStatus('idle');
                    setMapsError('');
                  }}
                />
                <Button variant="secondary" onClick={validateMaps} disabled={mapsStatus === 'checking'}>
                  {mapsStatus === 'checking' ? <Spinner /> : mapsStatus === 'valid' ? <Check className="h-4 w-4 text-[var(--color-success)]" /> : 'Test'}
                </Button>
              </div>
              <FieldError>{mapsError}</FieldError>
              {mapsStatus === 'valid' && (
                <p className="mt-1.5 text-sm text-[var(--color-success)]">Maps key looks good</p>
              )}
              <p className="mt-2 text-xs text-[var(--fg-subtle)]">
                Enable Maps JavaScript, Places, Directions, Geocoding, and Distance Matrix APIs.
              </p>
            </div>

            <label className="flex items-center gap-3 text-sm text-[var(--fg-muted)]">
              <input
                type="checkbox"
                checked={persist}
                onChange={(e) => setPersist(e.target.checked)}
                className="h-4 w-4 accent-[var(--accent)]"
              />
              Remember keys on this device
            </label>

            <Button
              className="w-full"
              variant="accent"
              size="lg"
              disabled={!canContinue}
              onClick={continueSetup}
            >
              Continue
            </Button>
          </div>
          </div>
        </div>
      </div>
      <div className={cn('pointer-events-none absolute -right-20 top-10 h-64 w-64 rounded-full opacity-30 blur-3xl', 'bg-[var(--color-amber)]')} />
    </div>
  );
}
