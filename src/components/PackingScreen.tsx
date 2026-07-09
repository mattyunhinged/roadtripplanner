import { useState } from 'react';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { Button, EmptyState, Spinner } from '@/components/ui';
import { generatePackingList } from '@/lib/ai/engine';
import { useTripStore } from '@/stores/tripStore';
import { useUIStore } from '@/stores/uiStore';
import { cn } from '@/lib/utils';

export function PackingScreen() {
  const trip = useTripStore((s) => s.activeTrip);
  const updateActiveTrip = useTripStore((s) => s.updateActiveTrip);
  const setScreen = useUIStore((s) => s.setScreen);
  const showToast = useUIStore((s) => s.showToast);
  const [busy, setBusy] = useState(false);

  async function generate() {
    setBusy(true);
    try {
      await generatePackingList();
      showToast('Packing list ready', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not generate packing list', 'error');
    } finally {
      setBusy(false);
    }
  }

  const items = trip?.packingList || [];
  const grouped = items.reduce<Record<string, typeof items>>((acc, item) => {
    (acc[item.category] ||= []).push(item);
    return acc;
  }, {});

  return (
    <div className="min-h-full overflow-y-auto bg-[var(--bg)]">
      <div className="mx-auto max-w-3xl px-6 py-10">
        <button
          type="button"
          onClick={() => setScreen('planner')}
          className="mb-6 inline-flex items-center gap-2 text-sm text-[var(--fg-muted)] hover:text-[var(--fg)]"
        >
          <ArrowLeft className="h-4 w-4" /> Back to planner
        </button>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-4xl">Packing list</h1>
            <p className="mt-2 text-[var(--fg-muted)]">
              Based on {trip?.title || 'your trip'}, season, and activities.
            </p>
          </div>
          <Button variant="accent" onClick={generate} disabled={busy || !trip}>
            {busy ? <Spinner /> : <Sparkles className="h-4 w-4" />}
            Generate
          </Button>
        </div>

        {!trip ? (
          <EmptyState title="No active trip" description="Plan a trip first, then generate a packing list." />
        ) : items.length === 0 ? (
          <EmptyState
            title="Nothing packed yet"
            description="Generate a list tailored to this roadtrip."
            action={
              <Button variant="accent" onClick={generate} disabled={busy}>
                Generate packing list
              </Button>
            }
          />
        ) : (
          <div className="mt-8 space-y-6">
            {Object.entries(grouped).map(([category, list]) => (
              <section key={category}>
                <h2 className="mb-2 text-sm uppercase tracking-[0.16em] text-[var(--fg-subtle)]">
                  {category}
                </h2>
                <div className="space-y-2">
                  {list.map((item) => (
                    <label
                      key={item.id}
                      className={cn(
                        'flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-3',
                        item.packed && 'opacity-60',
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={item.packed}
                        onChange={(e) => {
                          updateActiveTrip((t) => ({
                            ...t,
                            packingList: (t.packingList || []).map((p) =>
                              p.id === item.id ? { ...p, packed: e.target.checked } : p,
                            ),
                          }));
                        }}
                        className="accent-[var(--accent)]"
                      />
                      <span className={cn(item.packed && 'line-through')}>{item.label}</span>
                    </label>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
