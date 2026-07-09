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
} from 'lucide-react';
import { Button, Spinner, TextArea } from '@/components/ui';
import { runAutopilot } from '@/lib/ai/engine';
import { useUIStore } from '@/stores/uiStore';
import { cn } from '@/lib/utils';
import type { AutopilotLogEntry } from '@/types';

const SUGGESTIONS = [
  '5 day fall trip through New England under $1,500',
  'Surprise me, 3 days from home',
  'Long weekend Pacific Coast Highway with great food',
  'Family camping loop through national parks, 6 days',
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
      showToast(`Ready: ${trip.title}`, 'success');
      window.setTimeout(() => {
        setOpen(false);
        setPrompt('');
        clearProgress();
      }, 900);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Autopilot failed');
    } finally {
      setRunning(false);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center bg-[var(--bg-overlay)] p-4 backdrop-blur-sm sm:items-center no-print"
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
            className="liquid-composer relative w-full max-w-2xl overflow-hidden rounded-[28px] p-6 md:p-7"
          >
            <div className="liquid-orb left-[-10%] top-[-20%] h-40 w-40 bg-[var(--color-amber)]/30" />
            <div className="liquid-orb right-[-5%] bottom-[-30%] h-48 w-48 bg-[var(--color-sky)]/25" />

            <div className="relative z-10">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full glass-soft px-3 py-1 text-sm text-[var(--accent)]">
                    <Sparkles className="h-4 w-4" /> Autopilot AI
                    {running && (
                      <span className="ml-1 inline-flex items-center gap-1 text-[var(--fg-muted)]">
                        <span className="relative flex h-2 w-2">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--accent)] opacity-60" />
                          <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--accent)]" />
                        </span>
                        live
                      </span>
                    )}
                  </div>
                  <h2 className="mt-2 font-display text-3xl">Where should the road take you?</h2>
                  <p className="mt-1 text-sm text-[var(--fg-muted)]">
                    Watch Autopilot think, resolve real places, and draw your route live.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={running}
                  onClick={() => {
                    setOpen(false);
                    clearProgress();
                  }}
                  className="rounded-full glass-soft p-2 hover:bg-[var(--glass-strong)]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {!running && (
                <>
                  <TextArea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder='e.g. "5 day fall trip through New England under $1,500"'
                    className="glass-input relative z-10"
                    disabled={running}
                  />
                  <div className="mt-3 flex flex-wrap gap-2">
                    {SUGGESTIONS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => start(s)}
                        className="rounded-full glass-soft px-3 py-1.5 text-left text-xs text-[var(--fg-muted)] transition hover:text-[var(--fg)]"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {running && progress && (
                <div className="mt-2 space-y-4">
                  <div className="rounded-2xl glass-soft p-4">
                    <div className="mb-2 flex items-center justify-between text-sm">
                      <span className="font-medium">{progress.step}</span>
                      <span className="tabular-nums text-[var(--fg-subtle)]">{progress.percent}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
                      <motion.div
                        className="h-full rounded-full bg-gradient-to-r from-[var(--accent)] via-[var(--color-sky)] to-[var(--color-sage)]"
                        animate={{ width: `${progress.percent}%` }}
                        transition={{ ease: 'easeOut', duration: 0.35 }}
                      />
                    </div>
                    <p className="mt-3 text-sm text-[var(--fg-muted)]">{progress.detail}</p>
                  </div>

                  <div
                    ref={logRef}
                    className="max-h-56 space-y-1.5 overflow-y-auto rounded-2xl glass-soft p-3"
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
                      <div className="mt-2 rounded-xl border border-[var(--glass-border-inner)] bg-black/5 p-2 font-mono text-[10px] leading-relaxed text-[var(--fg-subtle)] dark:bg-white/5">
                        <div className="mb-1 flex items-center gap-1 text-[var(--accent)]">
                          <Camera className="h-3 w-3" /> streaming draft
                        </div>
                        <span className="opacity-80">{progress.streamPreview}</span>
                        <span className="ml-0.5 inline-block h-3 w-1 animate-pulse bg-[var(--accent)] align-middle" />
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2 text-xs text-[var(--fg-subtle)]">
                    <span className="inline-flex items-center gap-1 rounded-full glass-soft px-2.5 py-1">
                      <Brain className="h-3 w-3" /> {progress.phase}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full glass-soft px-2.5 py-1">
                      <Navigation className="h-3 w-3" /> Maps + Places live
                    </span>
                  </div>
                </div>
              )}

              {error && (
                <div className="mt-4 rounded-2xl border border-[var(--color-danger)]/30 bg-[var(--color-danger)]/10 px-4 py-3 text-sm text-[var(--color-danger)]">
                  {error}
                  <div className="mt-2">
                    <Button size="sm" variant="secondary" onClick={() => start()}>
                      Retry
                    </Button>
                  </div>
                </div>
              )}

              {!running && (
                <div className="mt-5 flex justify-end gap-2">
                  <Button variant="ghost" onClick={() => setOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    variant="accent"
                    size="lg"
                    disabled={!prompt.trim()}
                    onClick={() => start()}
                    className="shadow-lg shadow-[var(--accent)]/20"
                  >
                    <Sparkles className="h-4 w-4" />
                    Launch Autopilot
                  </Button>
                </div>
              )}

              {running && (
                <div className="mt-4 flex items-center justify-center gap-2 text-sm text-[var(--fg-muted)]">
                  <Spinner className="h-4 w-4" /> Building your roadtrip…
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
