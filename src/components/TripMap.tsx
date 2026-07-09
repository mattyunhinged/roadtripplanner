import { useEffect, useMemo, useState } from 'react';
import { APIProvider, Map, useMap } from '@vis.gl/react-google-maps';
import { motion, AnimatePresence } from 'framer-motion';
import { Replace, Sparkles, Star, Trash2, X, ExternalLink } from 'lucide-react';
import { Button, Spinner } from '@/components/ui';
import { MAP_STYLES_DARK, MAP_STYLES_LIGHT, decodePolyline } from '@/lib/google/maps';
import { runAskAi } from '@/lib/ai/engine';
import { categoryLabel } from '@/lib/ai/tripPatch';
import { cn, formatCurrency, priceLevelLabel } from '@/lib/utils';
import { useKeysStore } from '@/stores/keysStore';
import { useProfileStore } from '@/stores/profileStore';
import { useTripStore } from '@/stores/tripStore';
import { useUIStore } from '@/stores/uiStore';
import { CATEGORY_COLORS, type Stop } from '@/types';

function markerIcon(color: string, sequence: number, highlight: boolean): google.maps.Icon {
  const size = highlight ? 44 : 36;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 40 40">
      <circle cx="20" cy="20" r="16" fill="${color}" stroke="white" stroke-width="3"/>
      <text x="20" y="24" text-anchor="middle" fill="white" font-size="12" font-family="Outfit, sans-serif" font-weight="700">${sequence}</text>
    </svg>
  `;
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new google.maps.Size(size, size),
    anchor: new google.maps.Point(size / 2, size / 2),
  };
}

function RouteLayer() {
  const map = useMap();
  const trip = useTripStore((s) => s.activeTrip);
  const dayFilter = useUIStore((s) => s.dayFilter);
  const theme = useKeysStore((s) => s.settings.theme);
  const hoveredStopId = useUIStore((s) => s.hoveredStopId);

  useEffect(() => {
    if (!map || !trip) return;
    const paths: google.maps.Polyline[] = [];
    const legs = trip.legs.filter((l) => dayFilter === 'all' || l.dayIndex === dayFilter);
    const seen = new Set<string>();

    for (const leg of legs) {
      const encoded = leg.polyline;
      if (!encoded || seen.has(encoded + leg.fromStopId)) continue;
      seen.add(encoded + leg.fromStopId);
      const path = decodePolyline(encoded);
      if (!path.length) continue;
      const highlight =
        hoveredStopId && (leg.fromStopId === hoveredStopId || leg.toStopId === hoveredStopId);
      paths.push(
        new google.maps.Polyline({
          path,
          map,
          strokeColor: highlight ? '#E8A54B' : theme === 'dark' ? '#C4A574' : '#C4842E',
          strokeOpacity: highlight ? 1 : 0.85,
          strokeWeight: highlight ? 6 : 4,
          geodesic: true,
        }),
      );
    }

    return () => paths.forEach((p) => p.setMap(null));
  }, [map, trip, dayFilter, theme, hoveredStopId]);

  return null;
}

function MarkersLayer({ stops }: { stops: Stop[] }) {
  const map = useMap();
  const selectedStopId = useUIStore((s) => s.selectedStopId);
  const hoveredStopId = useUIStore((s) => s.hoveredStopId);
  const setSelectedStopId = useUIStore((s) => s.setSelectedStopId);
  const setHoveredStopId = useUIStore((s) => s.setHoveredStopId);

  useEffect(() => {
    if (!map) return;
    const markers: google.maps.Marker[] = [];
    stops.forEach((stop, index) => {
      const highlight = selectedStopId === stop.id || hoveredStopId === stop.id;
      const marker = new google.maps.Marker({
        map,
        position: stop.location,
        title: stop.name,
        icon: markerIcon(CATEGORY_COLORS[stop.category], index + 1, highlight),
        zIndex: highlight ? 999 : index + 1,
      });
      marker.addListener('click', () => setSelectedStopId(stop.id));
      marker.addListener('mouseover', () => setHoveredStopId(stop.id));
      marker.addListener('mouseout', () => setHoveredStopId(null));
      markers.push(marker);
    });
    return () => markers.forEach((m) => m.setMap(null));
  }, [map, stops, selectedStopId, hoveredStopId, setSelectedStopId, setHoveredStopId]);

  return null;
}

function FitBounds({ stops }: { stops: Stop[] }) {
  const map = useMap();
  const home = useProfileStore((s) => s.profile.home?.location || null);
  const tripId = useTripStore((s) => s.activeTrip?.id);
  const dayFilter = useUIStore((s) => s.dayFilter);

  useEffect(() => {
    if (!map) return;
    if (stops.length) {
      const bounds = new google.maps.LatLngBounds();
      stops.forEach((s) => bounds.extend(s.location));
      map.fitBounds(bounds, 80);
      return;
    }
    if (home) {
      map.setCenter(home);
      map.setZoom(10);
    }
  }, [map, tripId, dayFilter, home, stops]);

  return null;
}

function MapClickHandler({ onAdd }: { onAdd: (lat: number, lng: number) => void }) {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    const listener = map.addListener('click', (e: google.maps.MapMouseEvent) => {
      if (!e.latLng) return;
      onAdd(e.latLng.lat(), e.latLng.lng());
    });
    return () => listener.remove();
  }, [map, onAdd]);
  return null;
}

function PlaceCard({ stop, onClose }: { stop: Stop; onClose: () => void }) {
  const removeStop = useTripStore((s) => s.removeStop);
  const showToast = useUIStore((s) => s.showToast);
  const [asking, setAsking] = useState(false);
  const [askText, setAskText] = useState('');
  const [photoIndex, setPhotoIndex] = useState(0);
  const photos = stop.photoUrls?.length ? stop.photoUrls : stop.photoUrl ? [stop.photoUrl] : [];
  const activePhoto = photos[photoIndex] || photos[0];

  async function ask() {
    if (!askText.trim()) return;
    setAsking(true);
    try {
      const msg = await runAskAi('stop', askText.trim(), stop);
      showToast(msg, 'success');
      setAskText('');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Ask AI failed', 'error');
    } finally {
      setAsking(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      className="glass-strong absolute bottom-4 left-4 right-4 z-20 max-w-md overflow-hidden rounded-3xl md:left-6 md:right-auto"
    >
      {activePhoto ? (
        <div className="relative h-44 w-full overflow-hidden">
          <img src={activePhoto} alt={stop.name} className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/55 to-transparent" />
          {photos.length > 1 && (
            <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5">
              {photos.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setPhotoIndex(i)}
                  className={cn(
                    'h-1.5 rounded-full transition',
                    i === photoIndex ? 'w-4 bg-white' : 'w-1.5 bg-white/50',
                  )}
                />
              ))}
            </div>
          )}
          {stop.mapsUrl && (
            <a
              href={stop.mapsUrl}
              target="_blank"
              rel="noreferrer"
              className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full glass-strong px-2.5 py-1 text-xs text-[var(--fg)]"
            >
              Maps <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      ) : (
        <div
          className="h-24"
          style={{
            background: `linear-gradient(135deg, ${CATEGORY_COLORS[stop.category]}33, transparent)`,
          }}
        />
      )}
      <div className="relative z-10 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-wider text-[var(--fg-subtle)]">
              {categoryLabel(stop.category)} · Day {stop.dayIndex + 1}
            </div>
            <h3 className="font-display text-xl">
              {stop.mapsUrl ? (
                <a href={stop.mapsUrl} target="_blank" rel="noreferrer" className="hover:underline">
                  {stop.name}
                </a>
              ) : (
                stop.name
              )}
            </h3>
            {stop.address && <p className="mt-1 text-sm text-[var(--fg-muted)]">{stop.address}</p>}
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-1 hover:bg-[var(--bg-muted)]">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-3 text-sm text-[var(--fg-muted)]">
          {stop.rating != null && (
            <span className="inline-flex items-center gap-1">
              <Star className="h-3.5 w-3.5 fill-[var(--accent)] text-[var(--accent)]" />{' '}
              {stop.rating.toFixed(1)}
            </span>
          )}
          {stop.priceLevel != null && <span>{priceLevelLabel(stop.priceLevel)}</span>}
          {stop.costEstimate != null && <span>{formatCurrency(stop.costEstimate)}</span>}
          {stop.timeWindow && <span>{stop.timeWindow}</span>}
        </div>
        {stop.hours && <p className="mt-2 line-clamp-2 text-xs text-[var(--fg-subtle)]">{stop.hours}</p>}
        {stop.aiNotes && (
          <p className="mt-3 rounded-2xl glass-soft px-3 py-2 text-sm text-[var(--fg-muted)]">
            {stop.aiNotes}
          </p>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          {stop.mapsUrl && (
            <a
              href={stop.mapsUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-9 items-center gap-2 rounded-xl glass-soft px-3 text-sm"
            >
              <ExternalLink className="h-3.5 w-3.5" /> Google Maps
            </a>
          )}
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              removeStop(stop.id);
              onClose();
            }}
          >
            <Trash2 className="h-3.5 w-3.5" /> Remove
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={async () => {
              setAsking(true);
              try {
                const msg = await runAskAi(
                  'replace',
                  `Swap this ${stop.category} for a better alternative nearby`,
                  stop,
                );
                showToast(msg, 'success');
              } catch (error) {
                showToast(error instanceof Error ? error.message : 'Replace failed', 'error');
              } finally {
                setAsking(false);
              }
            }}
          >
            <Replace className="h-3.5 w-3.5" /> Replace
          </Button>
        </div>
        <div className="mt-3 flex gap-2">
          <input
            value={askText}
            onChange={(e) => setAskText(e.target.value)}
            placeholder="Ask AI about this stop…"
            className="glass-input h-10 flex-1 rounded-xl px-3 text-sm outline-none"
          />
          <Button size="sm" variant="accent" onClick={ask} disabled={asking}>
            {asking ? <Spinner className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

export function TripMap({ onMapClickAdd }: { onMapClickAdd?: (lat: number, lng: number) => void }) {
  const mapsKey = useKeysStore((s) => s.keys?.googleMapsKey || '');
  const theme = useKeysStore((s) => s.settings.theme);
  const trip = useTripStore((s) => s.activeTrip);
  const dayFilter = useUIStore((s) => s.dayFilter);
  const selectedStopId = useUIStore((s) => s.selectedStopId);
  const setSelectedStopId = useUIStore((s) => s.setSelectedStopId);

  const visibleStops = useMemo(() => {
    const stops = trip?.stops || [];
    return stops
      .filter((s) => dayFilter === 'all' || s.dayIndex === dayFilter)
      .sort((a, b) => a.dayIndex - b.dayIndex || a.order - b.order);
  }, [trip, dayFilter]);

  const selected = trip?.stops.find((s) => s.id === selectedStopId) || null;

  if (!mapsKey) {
    return (
      <div className="flex h-full items-center justify-center bg-[var(--bg-muted)] text-[var(--fg-muted)]">
        Add a Google Maps key to load the map
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <APIProvider apiKey={mapsKey} libraries={['places', 'geometry']}>
        <Map
          defaultCenter={{ lat: 39.8283, lng: -98.5795 }}
          defaultZoom={4}
          gestureHandling="greedy"
          disableDefaultUI
          styles={theme === 'dark' ? MAP_STYLES_DARK : MAP_STYLES_LIGHT}
          className="h-full w-full"
        >
          <FitBounds stops={visibleStops} />
          <RouteLayer />
          <MarkersLayer stops={visibleStops} />
          {onMapClickAdd && <MapClickHandler onAdd={onMapClickAdd} />}
        </Map>
      </APIProvider>

      <AnimatePresence>
        {selected && <PlaceCard stop={selected} onClose={() => setSelectedStopId(null)} />}
      </AnimatePresence>
    </div>
  );
}
