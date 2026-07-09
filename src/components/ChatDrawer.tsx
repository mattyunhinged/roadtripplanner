import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { MessageCircle, Send, X } from 'lucide-react';
import { Button, Spinner } from '@/components/ui';
import { runTripEdit } from '@/lib/ai/engine';
import { useChatStore } from '@/stores/chatStore';
import { useUIStore } from '@/stores/uiStore';
import { cn } from '@/lib/utils';

export function ChatDrawer() {
  const open = useUIStore((s) => s.chatOpen);
  const setOpen = useUIStore((s) => s.setChatOpen);
  const messages = useChatStore((s) => s.messages);
  const addMessage = useChatStore((s) => s.addMessage);
  const streaming = useChatStore((s) => s.streaming);
  const setStreaming = useChatStore((s) => s.setStreaming);
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  async function send() {
    const text = input.trim();
    if (!text || streaming) return;
    setInput('');
    setError('');
    addMessage({ role: 'user', content: text });
    setStreaming(true);
    try {
      const reply = await runTripEdit(text);
      addMessage({ role: 'assistant', content: reply, tripPatchApplied: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Copilot failed';
      setError(msg);
      addMessage({ role: 'assistant', content: `I hit a snag: ${msg}` });
    } finally {
      setStreaming(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="no-print fixed bottom-24 right-4 z-30 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--accent-fg)] shadow-lg md:bottom-6 md:right-6"
        aria-label="Open AI copilot"
      >
        <MessageCircle className="h-5 w-5" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.aside
            initial={{ x: 420, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 420, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            className="no-print fixed inset-y-0 right-0 z-40 flex w-full max-w-md flex-col border-l border-[var(--border)] bg-[var(--bg-elevated)] shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
              <div>
                <div className="font-display text-xl">Trip copilot</div>
                <div className="text-xs text-[var(--fg-subtle)]">Edits update the map instantly</div>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="rounded-full p-2 hover:bg-[var(--bg-muted)]">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
              {messages.length === 0 && (
                <div className="rounded-2xl bg-[var(--bg-muted)] p-4 text-sm text-[var(--fg-muted)]">
                  Try: “make day 3 more relaxed”, “we&apos;re vegetarians, fix the food stops”, or “add a national park”.
                </div>
              )}
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={cn(
                    'max-w-[90%] rounded-2xl px-3 py-2 text-sm',
                    m.role === 'user'
                      ? 'ml-auto bg-[var(--fg)] text-[var(--bg)]'
                      : 'bg-[var(--bg-muted)] text-[var(--fg)]',
                  )}
                >
                  {m.content}
                </div>
              ))}
              {streaming && (
                <div className="inline-flex items-center gap-2 rounded-2xl bg-[var(--bg-muted)] px-3 py-2 text-sm text-[var(--fg-muted)]">
                  <Spinner className="h-4 w-4" /> Thinking…
                </div>
              )}
              {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}
              <div ref={bottomRef} />
            </div>

            <div className="border-t border-[var(--border)] p-3">
              <div className="flex gap-2">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && send()}
                  placeholder="Talk about this trip…"
                  className="h-11 flex-1 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 outline-none focus:border-[var(--accent)]"
                />
                <Button variant="accent" onClick={send} disabled={streaming || !input.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}
