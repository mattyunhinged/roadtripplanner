import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, X } from 'lucide-react';
import { Button, Spinner, TextArea } from '@/components/ui';
import { runAutopilot } from '@/lib/ai/engine';
import { useUIStore } from '@/stores/uiStore';

const SUGGESTIONS = [
  '5 day fall trip through New England under $1,500',
  'Surprise me, 3 days from home',
  'Long weekend Pacific Coast Highway with great food',
  'Family camping loop through national parks, 6 days',
];

export function AutopilotModal() {
  const open = useUIStore((s) => s.autopilotOpen);
  const setOpen = useUIStore((s) => s.setAutopilotOpen);
  const progress = useUIStore((s) => s.autopilotProgress);
  const showToast = useUIStore((s) => s.showToast);
  const [prompt, setPrompt] = useState('');
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');

  async function start(text?: string) {
    const value = (text ?? prompt).trim();
    if (!value) return;
    setPrompt(value);
    setRunning(true);
    setError('');
    try {
      const trip = await runAutopilot(value);
      showToast(`Ready: ${trip.title}`, 'success');
      setOpen(false);
      setPrompt('');
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
          className="fixed inset-0 z-50 flex items-end justify-center bg-[var(--bg-overlay)] p-4 sm:items-center no-print"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => !running && setOpen(false)}
        >
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="glass-panel w-full max-w-xl rounded-3xl p-6"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <div className="inline-flex items-center gap-2 text-sm text-[var(--accent)]">
                  <Sparkles className="h-4 w-4" /> Autopilot AI
                </div>
                <h2 className="mt-1 font-display text-3xl">Where should the road take you?</h2>
                <p className="mt-1 text-sm text-[var(--fg-muted)]">
                  One sentence is enough. We&apos;ll build the whole trip.
                </p>
              </div>
              <button
                type="button"
                disabled={running}
                onClick={() => setOpen(false)}
                className="rounded-full p-2 hover:bg-[var(--bg-muted)]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <TextArea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder='e.g. "5 day fall trip through New England under $1,500"'
              disabled={running}
            />

            <div className="mt-3 flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={running}
                  onClick={() => start(s)}
                  className="rounded-full border border-[var(--border)] px-3 py-1.5 text-left text-xs text-[var(--fg-muted)] hover:border-[var(--border-strong)] hover:text-[var(--fg)]"
                >
                  {s}
                </button>
              ))}
            </div>

            {running && progress && (
              <div className="mt-5 rounded-2xl bg-[var(--bg-muted)] p-4">
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="font-medium">{progress.step}</span>
                  <span className="text-[var(--fg-subtle)]">{progress.percent}%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-[var(--border)]">
                  <motion.div
                    className="h-full rounded-full bg-[var(--accent)]"
                    animate={{ width: `${progress.percent}%` }}
                    transition={{ ease: 'easeOut', duration: 0.4 }}
                  />
                </div>
                <p className="mt-3 animate-pulse-soft text-sm text-[var(--fg-muted)]">
                  {progress.detail}
                </p>
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

            <div className="mt-5 flex justify-end gap-2">
              <Button variant="ghost" disabled={running} onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button variant="accent" size="lg" disabled={running || !prompt.trim()} onClick={() => start()}>
                {running ? <Spinner /> : <Sparkles className="h-4 w-4" />}
                {running ? 'Building trip…' : 'Launch Autopilot'}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
