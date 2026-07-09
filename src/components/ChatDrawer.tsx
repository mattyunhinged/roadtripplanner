import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, MessageCircle, Send, Sparkles, Trash2, X } from 'lucide-react';
import { Button, Spinner } from '@/components/ui';
import { runAskAi } from '@/lib/ai/engine';
import { useChatStore } from '@/stores/chatStore';
import { useProfileStore } from '@/stores/profileStore';
import { useTripStore } from '@/stores/tripStore';
import { useUIStore } from '@/stores/uiStore';
import { cn } from '@/lib/utils';

const SUGGESTIONS = [
  'make day 2 more chill',
  "we're vegetarian — fix food",
  'add a chaotic side quest',
  'cut driving time tomorrow',
];

export function ChatDrawer() {
  const open = useUIStore((s) => s.chatOpen);
  const setOpen = useUIStore((s) => s.setChatOpen);
  const selectedStopId = useUIStore((s) => s.selectedStopId);
  const mobileSheetExpanded = useUIStore((s) => s.mobileSheetExpanded);
  const setTripWizardOpen = useUIStore((s) => s.setTripWizardOpen);
  const displayName = useProfileStore((s) => s.profile.displayName);
  const firstName = displayName.trim().split(/\s+/)[0] || '';
  const trip = useTripStore((s) => s.activeTrip);
  const messages = useChatStore((s) => s.messages);
  const streaming = useChatStore((s) => s.streaming);
  const status = useChatStore((s) => s.status);
  const clearChat = useChatStore((s) => s.clear);
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const behavior: ScrollBehavior = streaming ? 'auto' : 'smooth';
    bottomRef.current?.scrollIntoView({ behavior });
  }, [messages, open, status, streaming]);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => inputRef.current?.focus(), 180);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !streaming) setOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, streaming, setOpen]);

  async function send(textOverride?: string) {
    const text = (textOverride ?? input).trim();
    if (!text || streaming) return;
    if (!trip) {
      setError('Create a trip first — then I can edit the map live.');
      return;
    }
    setInput('');
    setError('');
    try {
      await runAskAi('copilot', text);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Copilot failed');
    }
  }

  const showFab = !open && !selectedStopId && !mobileSheetExpanded;

  return (
    <>
      <AnimatePresence>
        {showFab && (
          <motion.button
            type="button"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            onClick={() => setOpen(true)}
            className="no-print fixed bottom-24 right-4 z-30 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--accent-fg)] shadow-lg shadow-[var(--accent)]/30 md:bottom-6 md:right-6"
            aria-label="Open AI copilot"
          >
            <MessageCircle className="h-5 w-5" />
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && (
          <>
            <motion.button
              type="button"
              aria-label="Close copilot"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="no-print fixed inset-0 z-[70] bg-black/35 backdrop-blur-[2px]"
              onClick={() => !streaming && setOpen(false)}
            />
            <motion.aside
              role="dialog"
              aria-modal="true"
              aria-label="Trip copilot"
              initial={{ x: 420, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 420, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}
              className="no-print fixed inset-y-0 right-0 z-[80] flex w-full max-w-md flex-col border-l border-[var(--border)] bg-[var(--bg-elevated)] shadow-[var(--shadow-soft)] md:rounded-l-2xl"
            >
              <div className="relative z-10 flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
                <div>
                  <div className="font-display text-xl">
                    {firstName ? `${firstName}'s copilot` : 'Trip copilot'}
                  </div>
                  <div className="text-xs text-[var(--fg-subtle)]">
                    {trip
                      ? 'Live edits · map updates instantly'
                      : 'Create a trip to unlock live map edits'}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {messages.length > 0 && (
                    <button
                      type="button"
                      onClick={() => clearChat()}
                      disabled={streaming}
                      className="rounded-full bg-[var(--bg-muted)] p-2 text-[var(--fg-muted)] hover:text-[var(--fg)] disabled:opacity-40"
                      aria-label="Clear chat"
                      title="Clear chat"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="rounded-full bg-[var(--bg-muted)] p-2"
                    aria-label="Close"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div ref={listRef} className="relative z-10 flex-1 space-y-3 overflow-y-auto px-4 py-4">
                {!trip && (
                  <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-muted)] p-4 text-sm text-[var(--fg-muted)]">
                    <p className="mb-3">
                      I need an active trip before I can rearrange stops on the map.
                    </p>
                    <Button size="sm" variant="accent" onClick={() => setTripWizardOpen(true)}>
                      <Sparkles className="h-3.5 w-3.5" /> New trip
                    </Button>
                  </div>
                )}

                {trip && messages.length === 0 && (
                  <div className="space-y-2">
                    <div className="rounded-2xl bg-[var(--bg-muted)] p-4 text-sm text-[var(--fg-muted)]">
                      {firstName
                        ? `Spitball anything, ${firstName}. I'll edit the trip live.`
                        : "Spitball anything. I'll edit the trip live."}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {SUGGESTIONS.map((chip) => (
                        <button
                          key={chip}
                          type="button"
                          disabled={streaming}
                          onClick={() => void send(chip)}
                          className="inline-flex rounded-full bg-[var(--bg-muted)] px-3 py-1.5 text-xs text-[var(--fg-muted)] transition hover:bg-[var(--fg)] hover:text-[var(--bg)] disabled:opacity-40"
                        >
                          {chip}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={cn(
                      'max-w-[90%] rounded-2xl px-3 py-2 text-sm leading-relaxed',
                      m.role === 'user'
                        ? 'ml-auto bg-[var(--fg)] text-[var(--bg)]'
                        : 'bg-[var(--bg-muted)] text-[var(--fg)]',
                    )}
                  >
                    {m.content || '…'}
                    {m.role === 'assistant' && m.tripPatchApplied && (
                      <div className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-[var(--color-success)]">
                        <Check className="h-3 w-3" /> Trip updated
                      </div>
                    )}
                  </div>
                ))}

                {streaming && status && (
                  <div className="inline-flex items-center gap-2 text-xs text-[var(--fg-subtle)]">
                    <Spinner className="h-3.5 w-3.5" /> {status}
                  </div>
                )}

                {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}
                <div ref={bottomRef} />
              </div>

              <div className="relative z-10 border-t border-[var(--border)] p-3">
                <div className="flex gap-2">
                  <input
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        void send();
                      }
                    }}
                    placeholder={trip ? 'Talk about this trip…' : 'Create a trip first…'}
                    disabled={!trip || streaming}
                    className="glass-input h-11 flex-1 rounded-xl px-3 outline-none disabled:opacity-50"
                  />
                  <Button
                    variant="accent"
                    onClick={() => void send()}
                    disabled={streaming || !input.trim() || !trip}
                  >
                    {streaming ? <Spinner className="h-4 w-4" /> : <Send className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
