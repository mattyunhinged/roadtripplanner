import { ArrowLeft, Copy, Printer } from 'lucide-react';
import { Button, EmptyState } from '@/components/ui';
import { categoryLabel, googleMapsDayUrl, tripToShareText } from '@/lib/ai/tripPatch';
import { formatCurrency, formatDuration, formatMiles } from '@/lib/utils';
import { useTripStore } from '@/stores/tripStore';
import { useUIStore } from '@/stores/uiStore';

export function ExportScreen() {
  const trip = useTripStore((s) => s.activeTrip);
  const setScreen = useUIStore((s) => s.setScreen);
  const showToast = useUIStore((s) => s.showToast);

  if (!trip) {
    return (
      <div className="min-h-full bg-[var(--bg)] px-6 py-10">
        <EmptyState
          title="Nothing to export"
          description="Create a trip first."
          action={<Button onClick={() => setScreen('planner')}>Back</Button>}
        />
      </div>
    );
  }

  const shareText = tripToShareText(trip);

  return (
    <div className="min-h-full overflow-y-auto bg-[var(--bg)]">
      <div className="mx-auto max-w-3xl px-6 py-10">
        <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setScreen('planner')}
            className="inline-flex items-center gap-2 text-sm text-[var(--fg-muted)] hover:text-[var(--fg)]"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={async () => {
                await navigator.clipboard.writeText(shareText);
                showToast('Summary copied', 'success');
              }}
            >
              <Copy className="h-4 w-4" /> Copy summary
            </Button>
            <Button variant="accent" onClick={() => window.print()}>
              <Printer className="h-4 w-4" /> Print
            </Button>
          </div>
        </div>

        <article className="print-area rounded-3xl border border-[var(--border)] bg-[var(--bg-elevated)] p-8">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--fg-subtle)]">On The Road · by Ryzord</p>
          <h1 className="mt-2 font-display text-4xl">{trip.title}</h1>
          <p className="mt-2 text-[var(--fg-muted)]">{trip.vibe}</p>
          <div className="mt-4 flex flex-wrap gap-4 text-sm">
            <span>{trip.totalDays} days</span>
            <span>{Math.round(trip.totalMiles)} miles</span>
            <span>{formatCurrency(trip.budget.total)} estimated</span>
          </div>

          <div className="mt-8 space-y-8">
            {trip.days.map((day) => {
              const stops = trip.stops
                .filter((s) => s.dayIndex === day.index)
                .sort((a, b) => a.order - b.order);
              const legs = trip.legs.filter((l) => l.dayIndex === day.index);
              return (
                <section key={day.index}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h2 className="font-display text-2xl">
                        Day {day.index + 1}
                        {day.title ? ` · ${day.title}` : ''}
                      </h2>
                      {day.summary && <p className="text-sm text-[var(--fg-muted)]">{day.summary}</p>}
                    </div>
                    <a
                      className="no-print text-sm text-[var(--accent)] underline"
                      href={googleMapsDayUrl(stops)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open day in Google Maps
                    </a>
                  </div>
                  <ul className="mt-3 space-y-2">
                    {stops.map((stop) => (
                      <li key={stop.id} className="rounded-2xl bg-[var(--bg-muted)] px-4 py-3">
                        <div className="font-medium">
                          {stop.timeWindow ? `${stop.timeWindow} — ` : ''}
                          {stop.name}{' '}
                          <span className="text-xs text-[var(--fg-subtle)]">
                            ({categoryLabel(stop.category)})
                          </span>
                        </div>
                        {stop.aiNotes && (
                          <p className="mt-1 text-sm text-[var(--fg-muted)]">{stop.aiNotes}</p>
                        )}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-xs text-[var(--fg-subtle)]">
                    Driving:{' '}
                    {formatMiles(legs.reduce((s, l) => s + l.distanceMeters, 0))} ·{' '}
                    {formatDuration(legs.reduce((s, l) => s + l.durationSeconds, 0))} · Spend{' '}
                    {formatCurrency(day.estimatedSpend)}
                  </p>
                </section>
              );
            })}
          </div>

          <section className="mt-10 border-t border-[var(--border)] pt-6">
            <h2 className="font-display text-2xl">Budget</h2>
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
              <div>Fuel · {formatCurrency(trip.budget.fuel)}</div>
              <div>Lodging · {formatCurrency(trip.budget.lodging)}</div>
              <div>Food · {formatCurrency(trip.budget.food)}</div>
              <div>Activities · {formatCurrency(trip.budget.activities)}</div>
            </div>
            <p className="mt-3 text-lg font-medium">Total · {formatCurrency(trip.budget.total)}</p>
            {trip.budget.notes && (
              <p className="mt-1 text-xs text-[var(--fg-subtle)]">{trip.budget.notes}</p>
            )}
          </section>
        </article>
      </div>
    </div>
  );
}
