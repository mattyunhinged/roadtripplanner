import { useState } from 'react';
import { ArrowLeft, Copy, ExternalLink, ImageIcon, Printer, Sparkles } from 'lucide-react';
import { Button, EmptyState, Spinner } from '@/components/ui';
import { categoryLabel, googleMapsDayUrl, tripToShareText } from '@/lib/ai/tripPatch';
import { generateTripBoard } from '@/lib/ai/engine';
import { formatCurrency, formatDuration, formatMiles } from '@/lib/utils';
import { useKeysStore } from '@/stores/keysStore';
import { useTripStore } from '@/stores/tripStore';
import { useUIStore } from '@/stores/uiStore';

export function ExportScreen() {
  const trip = useTripStore((s) => s.activeTrip);
  const setScreen = useUIStore((s) => s.setScreen);
  const showToast = useUIStore((s) => s.showToast);
  const clearProgress = useUIStore((s) => s.clearAutopilotProgress);
  const provider = useKeysStore((s) => s.keys?.aiProvider);
  const [boardBusy, setBoardBusy] = useState(false);
  const [boardError, setBoardError] = useState('');

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
  const canBoard = provider === 'openai';

  async function makeBoard() {
    setBoardBusy(true);
    setBoardError('');
    try {
      await generateTripBoard(trip);
      showToast('Trip Board ready', 'success');
    } catch (error) {
      setBoardError(error instanceof Error ? error.message : 'Board generation failed');
    } finally {
      setBoardBusy(false);
      window.setTimeout(() => clearProgress(), 600);
    }
  }

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
          <div className="flex flex-wrap gap-2">
            {canBoard && (
              <Button variant="accent" onClick={makeBoard} disabled={boardBusy}>
                {boardBusy ? <Spinner /> : <Sparkles className="h-4 w-4" />}
                {trip.boardImageUrl ? 'Regenerate Trip Board' : 'Export Trip Board'}
              </Button>
            )}
            <Button
              variant="secondary"
              onClick={async () => {
                await navigator.clipboard.writeText(shareText);
                showToast('Summary copied', 'success');
              }}
            >
              <Copy className="h-4 w-4" /> Copy summary
            </Button>
            <Button variant="secondary" onClick={() => window.print()}>
              <Printer className="h-4 w-4" /> Print
            </Button>
          </div>
        </div>

        {!canBoard && (
          <div className="no-print mb-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-3 shadow-sm text-sm text-[var(--fg-muted)]">
            <ImageIcon className="mr-2 inline h-4 w-4 text-[var(--accent)]" />
            Trip Board art is available when you use an OpenAI API key (Images API).
          </div>
        )}
        {boardError && (
          <div className="no-print mb-4 rounded-2xl border border-[var(--color-danger)]/30 bg-[var(--color-danger)]/10 px-4 py-3 text-sm text-[var(--color-danger)]">
            {boardError}
          </div>
        )}

        <article className="print-area overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)]">
          {trip.boardImageUrl && (
            <div className="relative">
              <img
                src={trip.boardImageUrl}
                alt={`${trip.title} trip board`}
                className="max-h-[420px] w-full object-cover"
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-6">
                <p className="text-xs uppercase tracking-[0.2em] text-white/70">Trip Board · OpenAI</p>
                <h1 className="font-display text-3xl text-white md:text-4xl">{trip.title}</h1>
              </div>
            </div>
          )}

          <div className="p-8">
            {!trip.boardImageUrl && (
              <>
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--fg-subtle)]">
                  On The Road · by Ryzord
                </p>
                <h1 className="mt-2 font-display text-4xl">{trip.title}</h1>
              </>
            )}
            <p className="mt-2 text-[var(--fg-muted)]">{trip.vibe}</p>
            <div className="mt-4 flex flex-wrap gap-4 text-sm">
              <span>{trip.totalDays} days</span>
              <span>{Math.round(trip.totalMiles)} miles</span>
              <span>{formatCurrency(trip.budget.total)} estimated</span>
            </div>

            {/* Photo strip from Google Places */}
            {trip.stops.some((s) => s.photoUrl) && (
              <div className="no-print mt-6 flex gap-2 overflow-x-auto pb-2">
                {trip.stops
                  .filter((s) => s.photoUrl)
                  .slice(0, 10)
                  .map((stop) => (
                    <a
                      key={stop.id}
                      href={stop.mapsUrl || googleMapsDayUrl([stop])}
                      target="_blank"
                      rel="noreferrer"
                      className="group relative h-24 w-32 shrink-0 overflow-hidden rounded-2xl"
                      title={stop.name}
                    >
                      <img
                        src={stop.photoUrl}
                        alt={stop.name}
                        className="h-full w-full object-cover transition group-hover:scale-105"
                      />
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 py-1.5 text-[10px] text-white">
                        {stop.name}
                      </div>
                    </a>
                  ))}
              </div>
            )}

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
                        {day.summary && (
                          <p className="text-sm text-[var(--fg-muted)]">{day.summary}</p>
                        )}
                      </div>
                      <a
                        className="no-print inline-flex items-center gap-1 text-sm text-[var(--accent)] underline"
                        href={googleMapsDayUrl(stops)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open day in Google Maps <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </div>
                    <ul className="mt-3 space-y-2">
                      {stops.map((stop) => (
                        <li
                          key={stop.id}
                          className="flex gap-3 overflow-hidden rounded-2xl bg-[var(--bg-muted)]"
                        >
                          {stop.photoUrl ? (
                            <a
                              href={stop.mapsUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="relative h-24 w-28 shrink-0"
                            >
                              <img
                                src={stop.photoUrl}
                                alt={stop.name}
                                className="h-full w-full object-cover"
                              />
                            </a>
                          ) : null}
                          <div className="min-w-0 flex-1 px-4 py-3">
                            <div className="font-medium">
                              {stop.timeWindow ? `${stop.timeWindow} — ` : ''}
                              {stop.mapsUrl ? (
                                <a
                                  href={stop.mapsUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="hover:text-[var(--accent)] hover:underline"
                                >
                                  {stop.name}
                                </a>
                              ) : (
                                stop.name
                              )}{' '}
                              <span className="text-xs text-[var(--fg-subtle)]">
                                ({categoryLabel(stop.category)})
                              </span>
                            </div>
                            {stop.aiNotes && (
                              <p className="mt-1 text-sm text-[var(--fg-muted)]">{stop.aiNotes}</p>
                            )}
                            {stop.mapsUrl && (
                              <a
                                href={stop.mapsUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="no-print mt-1 inline-flex items-center gap-1 text-xs text-[var(--accent)]"
                              >
                                Open in Google Maps <ExternalLink className="h-3 w-3" />
                              </a>
                            )}
                          </div>
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
          </div>
        </article>
      </div>
    </div>
  );
}
