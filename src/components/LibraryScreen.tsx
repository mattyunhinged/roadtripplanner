import { format } from 'date-fns';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { Button, EmptyState } from '@/components/ui';
import { formatCurrency } from '@/lib/utils';
import { useTripStore } from '@/stores/tripStore';
import { useUIStore } from '@/stores/uiStore';

export function LibraryScreen() {
  const library = useTripStore((s) => s.library);
  const loadFromLibrary = useTripStore((s) => s.loadFromLibrary);
  const deleteFromLibrary = useTripStore((s) => s.deleteFromLibrary);
  const setScreen = useUIStore((s) => s.setScreen);

  return (
    <div className="min-h-full overflow-y-auto bg-[var(--bg)]">
      <div className="mx-auto max-w-4xl px-6 py-10">
        <button
          type="button"
          onClick={() => setScreen('planner')}
          className="mb-6 inline-flex items-center gap-2 text-sm text-[var(--fg-muted)] hover:text-[var(--fg)]"
        >
          <ArrowLeft className="h-4 w-4" /> Back to planner
        </button>
        <h1 className="font-display text-4xl">Trip library</h1>
        <p className="mt-2 text-[var(--fg-muted)]">Saved roadtrips on this device.</p>

        {library.length === 0 ? (
          <EmptyState
            title="No saved trips"
            description="Build a trip with Autopilot, then hit Save to keep it in your library."
            action={
              <Button variant="accent" onClick={() => setScreen('planner')}>
                Open planner
              </Button>
            }
          />
        ) : (
          <div className="mt-8 space-y-3">
            {library.map((trip) => (
              <div
                key={trip.id}
                className="flex flex-col gap-3 rounded-3xl border border-[var(--border)] bg-[var(--bg-elevated)] p-5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <h2 className="font-display text-xl">{trip.title}</h2>
                  <p className="mt-1 line-clamp-2 text-sm text-[var(--fg-muted)]">{trip.vibe}</p>
                  <div className="mt-2 flex flex-wrap gap-3 text-xs text-[var(--fg-subtle)]">
                    <span>{trip.totalDays} days</span>
                    <span>{Math.round(trip.totalMiles)} mi</span>
                    <span>{formatCurrency(trip.budget.total)}</span>
                    <span>Updated {format(new Date(trip.updatedAt), 'MMM d, yyyy')}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="accent"
                    onClick={() => {
                      loadFromLibrary(trip.id);
                      setScreen('planner');
                    }}
                  >
                    Open
                  </Button>
                  <Button variant="secondary" onClick={() => deleteFromLibrary(trip.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
