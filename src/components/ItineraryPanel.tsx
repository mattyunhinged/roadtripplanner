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
  Compass,
  ExternalLink,
  GripVertical,
  Sparkles,
  Star,
} from 'lucide-react';
import { categoryLabel, googleMapsDayUrl } from '@/lib/ai/tripPatch';
import { runAskAi, recalculateRoutes } from '@/lib/ai/engine';
import { cn, formatCurrency, formatDuration, formatMiles } from '@/lib/utils';
import { useProfileStore } from '@/stores/profileStore';
import { useTripStore } from '@/stores/tripStore';
import { useUIStore } from '@/stores/uiStore';
import { CATEGORY_COLORS, type DriveLeg, type Stop } from '@/types';

function SortableStopCard({ stop }: { stop: Stop }) {
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

  const active = hoveredStopId === stop.id || selectedStopId === stop.id;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group relative overflow-hidden rounded-2xl transition',
        isDragging && 'z-10 opacity-90 shadow-xl scale-[1.02]',
        active && 'ring-2 ring-[var(--accent)]/50',
        stop.isSideQuest ? 'ring-1 ring-[var(--color-sky)]/40' : '',
      )}
      onMouseEnter={() => setHoveredStopId(stop.id)}
      onMouseLeave={() => setHoveredStopId(null)}
      onClick={() => setSelectedStopId(stop.id)}
    >
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-[var(--bg-muted)]">
        {stop.photoUrl ? (
          <img
            src={stop.photoUrl}
            alt={stop.name}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          />
        ) : (
          <div
            className="flex h-full w-full items-end p-3"
            style={{
              background: `linear-gradient(145deg, ${CATEGORY_COLORS[stop.category]}55, transparent 70%), var(--bg-muted)`,
            }}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />

        <button
          type="button"
          className="absolute left-2 top-2 rounded-full bg-black/45 p-1.5 text-white/90 active:cursor-grabbing"
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>

        <div className="absolute right-2 top-2 flex gap-1.5">
          {stop.isSideQuest && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-sky)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
              <Compass className="h-3 w-3" /> Side quest
            </span>
          )}
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white"
            style={{ background: CATEGORY_COLORS[stop.category] }}
          >
            {categoryLabel(stop.category)}
          </span>
        </div>

        <div className="absolute inset-x-0 bottom-0 p-3 text-white">
          <div className="flex items-end justify-between gap-2">
            <div className="min-w-0">
              {stop.timeWindow && (
                <div className="mb-0.5 text-[10px] uppercase tracking-wider text-white/70">
                  {stop.timeWindow}
                </div>
              )}
              <div className="truncate font-display text-lg leading-tight">{stop.name}</div>
              {stop.aiNotes && (
                <p className="mt-0.5 line-clamp-1 text-xs text-white/75">{stop.aiNotes}</p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              {stop.rating != null && (
                <span className="inline-flex items-center gap-0.5 rounded-full bg-black/45 px-1.5 py-0.5 text-[10px]">
                  <Star className="h-3 w-3 fill-[var(--accent)] text-[var(--accent)]" />
                  {stop.rating.toFixed(1)}
                </span>
              )}
              {stop.mapsUrl && (
                <a
                  href={stop.mapsUrl}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="rounded-full bg-black/45 p-1.5 hover:bg-black/60"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DriveChip({ leg, onAsk }: { leg: DriveLeg; onAsk: () => void }) {
  return (
    <div className="my-2 flex items-center justify-between gap-2 px-1">
      <div className="flex flex-wrap items-center gap-2 text-[11px] text-[var(--fg-subtle)]">
        <span className="h-px w-4 bg-[var(--border)]" />
        <span>
          {formatMiles(leg.distanceMeters)} · {formatDuration(leg.durationSeconds)}
        </span>
        {leg.exceedsMaxDrive && (
          <span className="inline-flex items-center gap-1 text-[var(--color-danger)]">
            <AlertTriangle className="h-3 w-3" /> long haul
          </span>
        )}
        {leg.fuelSuggested && <span className="text-[var(--color-sand)]">fuel up</span>}
        <span className="h-px flex-1 min-w-4 bg-[var(--border)]" />
      </div>
      <button
        type="button"
        onClick={onAsk}
        className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[var(--bg-muted)] px-2 py-1 text-[10px] text-[var(--fg-muted)] hover:text-[var(--fg)]"
      >
        <Sparkles className="h-3 w-3 text-[var(--accent)]" /> detour?
      </button>
    </div>
  );
}

function SideQuestRail({ stops }: { stops: Stop[] }) {
  const setSelectedStopId = useUIStore((s) => s.setSelectedStopId);
  const setHoveredStopId = useUIStore((s) => s.setHoveredStopId);
  if (!stops.length) return null;

  return (
    <div className="mb-4">
      <div className="mb-2 flex items-center gap-2 px-1 text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--color-sky)]">
        <Compass className="h-3.5 w-3.5" /> Side quests
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {stops.map((stop) => (
          <button
            key={stop.id}
            type="button"
            onClick={() => setSelectedStopId(stop.id)}
            onMouseEnter={() => setHoveredStopId(stop.id)}
            onMouseLeave={() => setHoveredStopId(null)}
            className="group relative h-28 w-36 shrink-0 overflow-hidden rounded-2xl"
          >
            {stop.photoUrl ? (
              <img
                src={stop.photoUrl}
                alt={stop.name}
                className="h-full w-full object-cover transition group-hover:scale-105"
              />
            ) : (
              <div
                className="h-full w-full"
                style={{ background: `${CATEGORY_COLORS[stop.category]}44` }}
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-2 text-left text-white">
              <div className="line-clamp-2 text-xs font-medium leading-snug">{stop.name}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

export function ItineraryPanel() {
  const trip = useTripStore((s) => s.activeTrip);
  const displayName = useProfileStore((s) => s.profile.displayName);
  const guests = useProfileStore((s) => s.profile.guests);
  const reorderDayStops = useTripStore((s) => s.reorderDayStops);
  const dayFilter = useUIStore((s) => s.dayFilter);
  const setDayFilter = useUIStore((s) => s.setDayFilter);
  const setAutopilotOpen = useUIStore((s) => s.setAutopilotOpen);
  const setTripWizardOpen = useUIStore((s) => s.setTripWizardOpen);
  const showToast = useUIStore((s) => s.showToast);
  const [busy, setBusy] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const days = useMemo(() => {
    if (!trip) return [];
    return trip.days.filter((d) => dayFilter === 'all' || d.index === dayFilter);
  }, [trip, dayFilter]);

  const heroPhotos = useMemo(() => {
    if (!trip) return [];
    return trip.stops.filter((s) => s.photoUrl).slice(0, 4);
  }, [trip]);

  if (!trip) {
    return (
      <div className="flex h-full flex-col justify-center gap-5 px-6 py-10">
        <div className="relative mx-auto h-36 w-full max-w-xs overflow-hidden rounded-3xl">
          <div
            className="absolute inset-0"
            style={{
              background:
                'radial-gradient(circle at 30% 30%, rgba(240,180,90,0.35), transparent 50%), radial-gradient(circle at 80% 70%, rgba(107,184,212,0.3), transparent 45%), var(--bg-muted)',
            }}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <Compass className="h-12 w-12 text-[var(--accent)] opacity-80" />
          </div>
        </div>
        <div className="text-center">
          <h2 className="font-display text-3xl">
            {displayName ? `blank map energy, ${displayName.split(/\s+/)[0]}` : 'blank map energy'}
          </h2>
          <p className="mt-2 text-sm text-[var(--fg-muted)]">
            {guests?.length
              ? `Plan for you + ${guests.length} guest${guests.length === 1 ? '' : 's'}. Hit New trip — one flow, whole route.`
              : 'Hit Autopilot. One sentence. We\'ll cook the whole route.'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setTripWizardOpen(true)}
          className="mx-auto inline-flex items-center gap-2 rounded-2xl bg-[var(--accent)] px-5 py-3 text-sm font-medium text-[var(--accent-fg)] shadow-lg shadow-[var(--accent)]/25"
        >
          <Sparkles className="h-4 w-4" /> New trip wizard
        </button>
        <button
          type="button"
          onClick={() => setAutopilotOpen(true)}
          className="mx-auto text-xs text-[var(--fg-subtle)] underline"
        >
          or quick one-liner Autopilot
        </button>
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
      {/* Visual trip header */}
      <div className="relative shrink-0 overflow-hidden border-b border-[var(--border)]">
        {heroPhotos.length > 0 ? (
          <div className="grid h-28 grid-cols-4 gap-0.5">
            {heroPhotos.map((s) => (
              <img key={s.id} src={s.photoUrl} alt="" className="h-full w-full object-cover" />
            ))}
          </div>
        ) : (
          <div className="h-16 bg-[var(--bg-muted)]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--bg-elevated)] via-[var(--bg-elevated)]/85 to-transparent" />
        <div className="relative px-5 pb-3 pt-2">
          <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--fg-subtle)]">
            {displayName ? `${displayName.split(/\s+/)[0]}'s trip` : 'your trip'}
          </div>
          <h2 className="font-display text-2xl leading-tight">{trip.title}</h2>
          {trip.vibe && (
            <p className="mt-0.5 line-clamp-2 text-xs text-[var(--fg-muted)]">{trip.vibe}</p>
          )}
          <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
            <span className="rounded-full bg-[var(--bg-muted)] px-2 py-0.5">{trip.totalDays}d</span>
            <span className="rounded-full bg-[var(--bg-muted)] px-2 py-0.5">
              {Math.round(trip.totalMiles)} mi
            </span>
            <span className="rounded-full bg-[var(--bg-muted)] px-2 py-0.5">
              {formatCurrency(trip.budget.total)}
            </span>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setDayFilter('all')}
              className={cn(
                'rounded-full px-2.5 py-1 text-[11px] transition',
                dayFilter === 'all'
                  ? 'bg-[var(--fg)] text-[var(--bg)]'
                  : 'bg-[var(--bg-muted)] text-[var(--fg-muted)]',
              )}
            >
              All
            </button>
            {trip.days.map((day) => (
              <button
                key={day.index}
                type="button"
                onClick={() => setDayFilter(day.index)}
                className={cn(
                  'rounded-full px-2.5 py-1 text-[11px] transition',
                  dayFilter === day.index
                    ? 'bg-[var(--fg)] text-[var(--bg)]'
                    : 'bg-[var(--bg-muted)] text-[var(--fg-muted)]',
                )}
              >
                D{day.index + 1}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3">
        {busy && (
          <div className="mb-2 rounded-xl bg-[var(--bg-muted)] px-3 py-2 text-xs text-[var(--fg-muted)]">
            Recalculating the vibes…
          </div>
        )}

        {dayFilter === 'all' && (
          <SideQuestRail stops={trip.stops.filter((s) => s.isSideQuest)} />
        )}

        {days.map((day) => {
          const allDayStops = trip.stops
            .filter((s) => s.dayIndex === day.index)
            .sort((a, b) => a.order - b.order);
          const mainStops = allDayStops.filter((s) => !s.isSideQuest);
          const sideStops = allDayStops.filter((s) => s.isSideQuest);
          const stopIds = allDayStops.map((s) => s.id);
          const displayStops = mainStops.length ? mainStops : allDayStops;

          return (
            <section key={day.index} className="mb-6">
              <div className="mb-2 flex items-start justify-between gap-2 px-1">
                <div>
                  <h3 className="font-display text-lg leading-tight">
                    <span className="text-[var(--fg-subtle)]">D{day.index + 1}</span>
                    {day.title ? ` · ${day.title}` : ''}
                  </h3>
                  <div className="mt-0.5 text-[11px] text-[var(--fg-subtle)]">
                    {Math.round(day.miles)} mi · {day.drivingHours.toFixed(1)}h ·{' '}
                    {formatCurrency(day.estimatedSpend)}
                  </div>
                </div>
                <a
                  href={googleMapsDayUrl(allDayStops)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-full bg-[var(--bg-muted)] px-2.5 py-1 text-[11px] text-[var(--fg-muted)] hover:text-[var(--fg)]"
                >
                  Maps <ExternalLink className="h-3 w-3" />
                </a>
              </div>

              {sideStops.length > 0 && dayFilter !== 'all' && (
                <SideQuestRail stops={sideStops} />
              )}

              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={(e) => onDragEnd(day.index, e, stopIds)}
              >
                <SortableContext items={stopIds} strategy={verticalListSortingStrategy}>
                  <div className="space-y-2">
                    {displayStops.map((stop, idx) => {
                      const next = displayStops[idx + 1];
                      const leg = next
                        ? trip.legs.find(
                            (l) => l.fromStopId === stop.id && l.toStopId === next.id,
                          )
                        : undefined;
                      return (
                        <div key={stop.id}>
                          <SortableStopCard stop={stop} />
                          {leg && (
                            <DriveChip
                              leg={leg}
                              onAsk={async () => {
                                try {
                                  const msg = await runAskAi(
                                    'leg',
                                    `Add a fun scenic or food side quest between ${stop.name} and ${next.name}. Keep it chill.`,
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
                  </div>
                </SortableContext>
              </DndContext>
            </section>
          );
        })}
      </div>

      <div className="border-t border-[var(--border)] px-4 py-2.5 text-[10px] text-[var(--fg-subtle)]">
        fuel {formatCurrency(trip.budget.fuel)} · stay {formatCurrency(trip.budget.lodging)} · eats{' '}
        {formatCurrency(trip.budget.food)} · fun {formatCurrency(trip.budget.activities)}
      </div>
    </div>
  );
}
