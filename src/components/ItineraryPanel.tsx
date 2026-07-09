import { useMemo, useState } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  AlertTriangle,
  ExternalLink,
  GripVertical,
  Sparkles,
  Star,
} from 'lucide-react';
import { Button } from '@/components/ui';
import { categoryLabel, googleMapsDayUrl } from '@/lib/ai/tripPatch';
import { runAskAi, recalculateRoutes } from '@/lib/ai/engine';
import { cn, formatCurrency, formatDuration, formatMiles, priceLevelLabel } from '@/lib/utils';
import { useTripStore } from '@/stores/tripStore';
import { useUIStore } from '@/stores/uiStore';
import { CATEGORY_COLORS, type DriveLeg, type Stop } from '@/types';

function SortableStop({ stop }: { stop: Stop }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: stop.id,
  });
  const setHoveredStopId = useUIStore((s) => s.setHoveredStopId);
  const setSelectedStopId = useUIStore((s) => s.setSelectedStopId);
  const hoveredStopId = useUIStore((s) => s.hoveredStopId);
  const selectedStopId = useUIStore((s) => s.selectedStopId);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group flex gap-3 rounded-2xl border border-transparent p-2 transition',
        (hoveredStopId === stop.id || selectedStopId === stop.id) &&
          'border-[var(--border-strong)] bg-[var(--bg-muted)]',
        isDragging && 'opacity-80 shadow-lg',
      )}
      onMouseEnter={() => setHoveredStopId(stop.id)}
      onMouseLeave={() => setHoveredStopId(null)}
      onClick={() => setSelectedStopId(stop.id)}
    >
      <button
        type="button"
        className="mt-1 cursor-grab text-[var(--fg-subtle)] active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <div
        className="mt-1 h-10 w-10 shrink-0 overflow-hidden rounded-xl"
        style={{ background: `${CATEGORY_COLORS[stop.category]}33` }}
      >
        {stop.photoUrl ? (
          <img src={stop.photoUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-[10px] font-bold" style={{ color: CATEGORY_COLORS[stop.category] }}>
            {categoryLabel(stop.category).slice(0, 3).toUpperCase()}
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate font-medium">{stop.name}</div>
            <div className="mt-0.5 flex flex-wrap gap-2 text-xs text-[var(--fg-subtle)]">
              <span>{categoryLabel(stop.category)}</span>
              {stop.timeWindow && <span>{stop.timeWindow}</span>}
              {stop.rating != null && (
                <span className="inline-flex items-center gap-0.5">
                  <Star className="h-3 w-3" /> {stop.rating.toFixed(1)}
                </span>
              )}
              {stop.priceLevel != null && <span>{priceLevelLabel(stop.priceLevel)}</span>}
              {stop.costEstimate != null && <span>{formatCurrency(stop.costEstimate)}</span>}
            </div>
          </div>
        </div>
        {stop.aiNotes && (
          <p className="mt-1 line-clamp-2 text-xs text-[var(--fg-muted)]">{stop.aiNotes}</p>
        )}
      </div>
    </div>
  );
}

function DriveSegment({ leg, onAsk }: { leg: DriveLeg; onAsk: () => void }) {
  return (
    <div className="my-1 ml-8 flex items-center justify-between gap-2 border-l-2 border-dashed border-[var(--border)] py-2 pl-4 text-xs text-[var(--fg-muted)]">
      <div className="flex flex-wrap items-center gap-2">
        <span>
          {formatMiles(leg.distanceMeters)} · {formatDuration(leg.durationSeconds)}
        </span>
        {leg.exceedsMaxDrive && (
          <span className="inline-flex items-center gap-1 text-[var(--color-danger)]">
            <AlertTriangle className="h-3 w-3" /> Over max drive
          </span>
        )}
        {leg.fuelSuggested && <span className="text-[var(--color-sand)]">Fuel suggested</span>}
      </div>
      <button
        type="button"
        onClick={onAsk}
        className="inline-flex items-center gap-1 rounded-full px-2 py-1 hover:bg-[var(--bg-muted)]"
      >
        <Sparkles className="h-3 w-3" /> Ask AI
      </button>
    </div>
  );
}

export function ItineraryPanel() {
  const trip = useTripStore((s) => s.activeTrip);
  const reorderDayStops = useTripStore((s) => s.reorderDayStops);
  const dayFilter = useUIStore((s) => s.dayFilter);
  const setDayFilter = useUIStore((s) => s.setDayFilter);
  const showToast = useUIStore((s) => s.showToast);
  const [busy, setBusy] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const days = useMemo(() => {
    if (!trip) return [];
    return trip.days.filter((d) => dayFilter === 'all' || d.index === dayFilter);
  }, [trip, dayFilter]);

  if (!trip) {
    return (
      <div className="flex h-full flex-col justify-center px-6 text-center">
        <h2 className="font-display text-3xl">No trip yet</h2>
        <p className="mt-2 text-[var(--fg-muted)]">
          Hit Autopilot and describe the roadtrip you want — or plan it manually.
        </p>
      </div>
    );
  }

  async function onDragEnd(dayIndex: number, event: DragEndEvent, stopIds: string[]) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = stopIds.indexOf(String(active.id));
    const newIndex = stopIds.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(stopIds, oldIndex, newIndex);
    reorderDayStops(dayIndex, next);
    setBusy(true);
    try {
      await recalculateRoutes();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Route update failed', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-[var(--border)] px-5 py-4">
        <div className="text-xs uppercase tracking-[0.18em] text-[var(--fg-subtle)]">Trip</div>
        <h2 className="font-display text-2xl leading-tight">{trip.title}</h2>
        {trip.vibe && <p className="mt-1 text-sm text-[var(--fg-muted)]">{trip.vibe}</p>}
        <div className="mt-3 flex flex-wrap gap-3 text-sm">
          <span>{trip.totalDays} days</span>
          <span>{Math.round(trip.totalMiles)} mi</span>
          <span>{formatCurrency(trip.budget.total)}</span>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setDayFilter('all')}
            className={cn(
              'rounded-full px-3 py-1 text-xs',
              dayFilter === 'all'
                ? 'bg-[var(--fg)] text-[var(--bg)]'
                : 'bg-[var(--bg-muted)] text-[var(--fg-muted)]',
            )}
          >
            All days
          </button>
          {trip.days.map((day) => (
            <button
              key={day.index}
              type="button"
              onClick={() => setDayFilter(day.index)}
              className={cn(
                'rounded-full px-3 py-1 text-xs',
                dayFilter === day.index
                  ? 'bg-[var(--fg)] text-[var(--bg)]'
                  : 'bg-[var(--bg-muted)] text-[var(--fg-muted)]',
              )}
            >
              Day {day.index + 1}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3">
        {busy && (
          <div className="mb-2 rounded-xl bg-[var(--bg-muted)] px-3 py-2 text-xs text-[var(--fg-muted)]">
            Recalculating route…
          </div>
        )}
        {days.map((day) => {
          const stops = trip.stops
            .filter((s) => s.dayIndex === day.index)
            .sort((a, b) => a.order - b.order);
          const stopIds = stops.map((s) => s.id);
          return (
            <section key={day.index} className="mb-6">
              <div className="mb-2 flex items-start justify-between gap-2 px-2">
                <div>
                  <h3 className="font-display text-lg">
                    Day {day.index + 1}
                    {day.title ? ` · ${day.title}` : ''}
                  </h3>
                  {day.summary && (
                    <p className="text-xs text-[var(--fg-muted)]">{day.summary}</p>
                  )}
                  <div className="mt-1 text-xs text-[var(--fg-subtle)]">
                    {Math.round(day.miles)} mi · {day.drivingHours.toFixed(1)}h driving ·{' '}
                    {formatCurrency(day.estimatedSpend)}
                  </div>
                </div>
                <a
                  href={googleMapsDayUrl(stops)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-full bg-[var(--bg-muted)] px-2.5 py-1 text-xs text-[var(--fg-muted)] hover:text-[var(--fg)]"
                >
                  Open in Maps <ExternalLink className="h-3 w-3" />
                </a>
              </div>

              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={(e) => onDragEnd(day.index, e, stopIds)}
              >
                <SortableContext items={stopIds} strategy={verticalListSortingStrategy}>
                  {stops.map((stop, idx) => {
                    const next = stops[idx + 1];
                    const leg = next
                      ? trip.legs.find((l) => l.fromStopId === stop.id && l.toStopId === next.id)
                      : undefined;
                    return (
                      <div key={stop.id}>
                        <SortableStop stop={stop} />
                        {leg && (
                          <DriveSegment
                            leg={leg}
                            onAsk={async () => {
                              try {
                                const msg = await runAskAi(
                                  'leg',
                                  `Find a great lunch or scenic stop between ${stop.name} and ${next.name}`,
                                );
                                showToast(msg, 'success');
                              } catch (error) {
                                showToast(
                                  error instanceof Error ? error.message : 'Ask AI failed',
                                  'error',
                                );
                              }
                            }}
                          />
                        )}
                      </div>
                    );
                  })}
                </SortableContext>
              </DndContext>
            </section>
          );
        })}
      </div>

      <div className="border-t border-[var(--border)] px-5 py-3 text-xs text-[var(--fg-subtle)]">
        Budget · Fuel {formatCurrency(trip.budget.fuel)} · Lodging{' '}
        {formatCurrency(trip.budget.lodging)} · Food {formatCurrency(trip.budget.food)} · Activities{' '}
        {formatCurrency(trip.budget.activities)}
      </div>
    </div>
  );
}
