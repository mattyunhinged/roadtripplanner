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
  const updateMessage = useChatStore((s) => s.updateMessage);
  const streaming = useChatStore((s) => s.streaming);
  const setStreaming = useChatStore((s) => s.setStreaming);
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [liveStatus, setLiveStatus] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open, liveStatus]);

  async function send() {
    const text = input.trim();
    if (!text || streaming) return;
    setInput('');
    setError('');
    setLiveStatus('Listening to your request…');
    addMessage({ role: 'user', content: text });
    setStreaming(true);
    const placeholder = addMessage({ role: 'assistant', content: '' });
    let buffer = '';
    try {
      const reply = await runTripEdit(text, undefined, (token) => {
        buffer += token;
        setLiveStatus('Streaming reply & planning edits…');
        // Show a friendly preview while JSON streams
        const preview = buffer.includes('"message"')
          ? buffer.match(/"message"\s*:\s*"([^"]*)/)?.[1] || 'Working on your trip…'
          : 'Thinking through your trip…';
        updateMessage(placeholder.id, preview + '…');
      });
      updateMessage(placeholder.id, reply);
      // mark patch applied
      const msgs = useChatStore.getState().messages.map((m) =>
        m.id === placeholder.id ? { ...m, content: reply, tripPatchApplied: true } : m,
      );
      useChatStore.setState({ messages: msgs });
      setLiveStatus('');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Copilot failed';
      setError(msg);
      updateMessage(placeholder.id, `I hit a snag: ${msg}`);
      setLiveStatus('');
    } finally {
      setStreaming(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="no-print fixed bottom-24 right-4 z-30 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--accent-fg)] shadow-lg shadow-[var(--accent)]/30 md:bottom-6 md:right-6"
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
            className="no-print fixed inset-y-0 right-0 z-40 flex w-full max-w-md flex-col border-l border-[var(--border)] bg-[var(--bg-elevated)] shadow-[var(--shadow-soft)] md:rounded-l-2xl"
          >
            <div className="relative z-10 flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
              <div>
                <div className="font-display text-xl">Trip copilot</div>
                <div className="text-xs text-[var(--fg-subtle)]">
                  Live edits · map updates instantly
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full bg-[var(--bg-muted)] p-2"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="relative z-10 flex-1 space-y-3 overflow-y-auto px-4 py-4">
              {messages.length === 0 && (
                <div className="space-y-2">
                  <div className="rounded-2xl bg-[var(--bg-muted)] p-4 text-sm text-[var(--fg-muted)]">
                    spitball anything. i&apos;ll edit the trip live.
                  </div>
                  {[
                    'make day 2 more chill',
                    'we’re vegetarian — fix food',
                    'add a chaotic side quest',
                  ].map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => {
                        setInput(chip);
                      }}
                      className="mr-2 inline-flex rounded-full bg-[var(--bg-muted)] px-3 py-1.5 text-xs text-[var(--fg-muted)] hover:text-[var(--fg)]"
                    >
                      {chip}
                    </button>
                  ))}
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
                  {m.content || (streaming ? '…' : '')}
                </div>
              ))}
              {streaming && liveStatus && (
                <div className="inline-flex items-center gap-2 rounded-2xl bg-[var(--bg-muted)] px-3 py-2 text-sm text-[var(--fg-muted)]">
                  <Spinner className="h-4 w-4" /> {liveStatus}
                </div>
              )}
              {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}
              <div ref={bottomRef} />
            </div>

            <div className="relative z-10 border-t border-[var(--border)] p-3">
              <div className="flex gap-2">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && send()}
                  placeholder="Talk about this trip…"
                  className="glass-input h-11 flex-1 rounded-xl px-3 outline-none"
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
