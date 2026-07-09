import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Camera,
  MapPin,
  Navigation,
  Route,
  Sparkles,
  TriangleAlert,
  X,
  CheckCircle2,
  Brain,
  Compass,
} from 'lucide-react';
import { Button, Spinner, TextArea } from '@/components/ui';
import { runAutopilot } from '@/lib/ai/engine';
import { useProfileStore } from '@/stores/profileStore';
import { useUIStore } from '@/stores/uiStore';
import { cn } from '@/lib/utils';
import type { AutopilotLogEntry } from '@/types';

const SUGGESTIONS = [
  'surprise me · 3 days · main character energy',
  '5 day New England fall trip under $1.5k',
  'PCH weekend · food + overlooks only',
  'national parks loop · camping · 6 days',
];

function LogIcon({ kind }: { kind?: AutopilotLogEntry['kind'] }) {
  if (kind === 'place') return <MapPin className="h-3.5 w-3.5 text-[var(--color-sage)]" />;
  if (kind === 'route') return <Route className="h-3.5 w-3.5 text-[var(--color-sky)]" />;
  if (kind === 'thought') return <Brain className="h-3.5 w-3.5 text-[var(--accent)]" />;
  if (kind === 'success') return <CheckCircle2 className="h-3.5 w-3.5 text-[var(--color-success)]" />;
  if (kind === 'warn') return <TriangleAlert className="h-3.5 w-3.5 text-[var(--color-danger)]" />;
  return <Sparkles className="h-3.5 w-3.5 text-[var(--fg-subtle)]" />;
}

export function AutopilotModal() {
  const open = useUIStore((s) => s.autopilotOpen);
  const setOpen = useUIStore((s) => s.setAutopilotOpen);
  const progress = useUIStore((s) => s.autopilotProgress);
  const clearProgress = useUIStore((s) => s.clearAutopilotProgress);
  const showToast = useUIStore((s) => s.showToast);
  const displayName = useProfileStore((s) => s.profile.displayName);
  const firstName = displayName.trim().split(/\s+/)[0] || '';
  const [prompt, setPrompt] = useState('');
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [progress?.log.length, progress?.streamPreview]);

  async function start(text?: string) {
    const value = (text ?? prompt).trim();
    if (!value) return;
    setPrompt(value);
    setRunning(true);
    setError('');
    try {
      const trip = await runAutopilot(value);
      showToast(`locked in · ${trip.title}`, 'success');
      window.setTimeout(() => {
        setOpen(false);
        setPrompt('');
        clearProgress();
      }, 1100);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Autopilot glitched out');
    } finally {
      setRunning(false);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center bg-[var(--bg-overlay)] p-4 sm:items-center no-print"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => !running && setOpen(false)}
        >
          <motion.div
            initial={{ y: 40, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 20, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-6 shadow-[var(--shadow-soft)] md:p-7"
          >
            <div className="relative z-10">
              <div className="mb-5 flex items-start justify-between gap-3">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full bg-[var(--bg-muted)] px-3 py-1 text-sm text-[var(--accent)]">
                    <Sparkles className="h-4 w-4" /> Autopilot
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
                  <h2 className="mt-2 font-display text-3xl md:text-4xl">
                    {firstName ? `${firstName}, where we going?` : 'where we going?'}
                  </h2>
                  <p className="mt-1 text-sm text-[var(--fg-muted)]">
                    one sentence. we&apos;ll build the whole trip + side quests.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={running}
                  onClick={() => {
                    setOpen(false);
                    clearProgress();
                  }}
                  className="rounded-full bg-[var(--bg-muted)] p-2 hover:bg-[var(--bg)]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {!running && (
                <>
                  <TextArea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder='e.g. "surprise me, 3 days, food + views"'
                    className="glass-input relative z-10 min-h-[88px] text-base"
                    disabled={running}
                  />
                  <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {SUGGESTIONS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => start(s)}
                        className="rounded-2xl bg-[var(--bg-muted)] px-3 py-3 text-left text-sm text-[var(--fg-muted)] transition hover:text-[var(--fg)] hover:ring-1 hover:ring-[var(--accent)]/40"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {running && progress && (
                <div className="mt-1 space-y-4">
                  <div className="overflow-hidden rounded-2xl bg-[var(--bg-muted)]">
                    <div className="relative h-2 overflow-hidden bg-black/10 dark:bg-white/10">
                      <motion.div
                        className="h-full rounded-full bg-gradient-to-r from-[var(--accent)] via-[var(--color-sky)] to-[var(--color-sage)]"
                        animate={{ width: `${progress.percent}%` }}
                        transition={{ ease: 'easeOut', duration: 0.35 }}
                      />
                    </div>
                    <div className="flex items-center justify-between px-4 py-3 text-sm">
                      <span className="font-medium">{progress.step}</span>
                      <span className="tabular-nums text-[var(--fg-subtle)]">{progress.percent}%</span>
                    </div>
                  </div>

                  <div
                    ref={logRef}
                    className="max-h-64 space-y-1 overflow-y-auto rounded-2xl bg-[var(--bg-muted)] p-3"
                  >
                    {progress.log.map((entry) => (
                      <div
                        key={entry.id}
                        className="stream-line flex items-start gap-2 rounded-xl px-2 py-1.5 text-sm"
                      >
                        <span className="mt-0.5 shrink-0">
                          <LogIcon kind={entry.kind} />
                        </span>
                        <span
                          className={cn(
                            'text-[var(--fg-muted)]',
                            entry.kind === 'success' && 'text-[var(--color-success)]',
                            entry.kind === 'warn' && 'text-[var(--color-danger)]',
                            entry.kind === 'thought' && 'text-[var(--fg)]',
                          )}
                        >
                          {entry.text}
                        </span>
                      </div>
                    ))}
                    {progress.streamPreview && progress.phase === 'thinking' && (
                      <div className="mt-2 rounded-2xl border border-[var(--border)] bg-[var(--bg)] p-2.5 font-mono text-[10px] leading-relaxed text-[var(--fg-subtle)] dark:bg-white/5">
                        <div className="mb-1 flex items-center gap-1 text-[var(--accent)]">
                          <Camera className="h-3 w-3" /> brain dump
                        </div>
                        <span className="opacity-80">{progress.streamPreview}</span>
                        <span className="ml-0.5 inline-block h-3 w-1 animate-pulse bg-[var(--accent)] align-middle" />
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2 text-xs text-[var(--fg-subtle)]">
                    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--bg-muted)] px-2.5 py-1">
                      <Brain className="h-3 w-3" /> {progress.phase}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--bg-muted)] px-2.5 py-1">
                      <Compass className="h-3 w-3" /> side quests loading
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--bg-muted)] px-2.5 py-1">
                      <Navigation className="h-3 w-3" /> maps live
                    </span>
                  </div>
                </div>
              )}

              {error && (
                <div className="mt-4 rounded-2xl border border-[var(--color-danger)]/30 bg-[var(--color-danger)]/10 px-4 py-3 text-sm text-[var(--color-danger)]">
                  {error}
                  <div className="mt-2">
                    <Button size="sm" variant="secondary" onClick={() => start()}>
                      try again
                    </Button>
                  </div>
                </div>
              )}

              {!running && (
                <div className="mt-5 flex justify-end gap-2">
                  <Button variant="ghost" onClick={() => setOpen(false)}>
                    nah
                  </Button>
                  <Button
                    variant="accent"
                    size="lg"
                    disabled={!prompt.trim()}
                    onClick={() => start()}
                    className="shadow-lg shadow-[var(--accent)]/20"
                  >
                    <Sparkles className="h-4 w-4" />
                    let&apos;s ride
                  </Button>
                </div>
              )}

              {running && (
                <div className="mt-4 flex items-center justify-center gap-2 text-sm text-[var(--fg-muted)]">
                  <Spinner className="h-4 w-4" /> building your arc…
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
