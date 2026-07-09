import type { LatLng, Stop, DriveLeg } from '../../types';
import { v4 as uuid } from 'uuid';

export const MAP_STYLES_DARK: google.maps.MapTypeStyle[] = [
  { elementType: 'geometry', stylers: [{ color: '#1a1f1c' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1a1f1c' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8a918b' }] },
  { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#2a322e' }] },
  { featureType: 'administrative.land_parcel', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#222a26' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2c342f' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#1a1f1c' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#3d4a42' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#c4a574' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0f1412' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#5ba3a8' }] },
];

export const MAP_STYLES_LIGHT: google.maps.MapTypeStyle[] = [
  { elementType: 'geometry', stylers: [{ color: '#efeae2' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#efeae2' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#5c655f' }] },
  { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#d4cdc2' }] },
  { featureType: 'administrative.land_parcel', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#dfe8dc' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#e4ddd2' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#f3efe8' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#c4842e' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#c9d9d8' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#5ba3a8' }] },
];

export interface ResolvedPlace {
  placeId: string;
  name: string;
  location: LatLng;
  address?: string;
  rating?: number;
  priceLevel?: number;
  hours?: string;
  photoUrl?: string;
  photoUrls?: string[];
  mapsUrl?: string;
  website?: string;
  phone?: string;
}

export function placeMapsUrl(place: {
  placeId?: string;
  name?: string;
  address?: string;
  location: LatLng;
}): string {
  if (place.placeId) {
    return `https://www.google.com/maps/place/?q=place_id:${place.placeId}`;
  }
  const q = encodeURIComponent(place.address || place.name || `${place.location.lat},${place.location.lng}`);
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}

function getMaps(): typeof google.maps {
  if (!window.google?.maps) {
    throw new Error('Google Maps failed to load. Check your Maps API key.');
  }
  return window.google.maps;
}

export async function validateGoogleMapsKey(apiKey: string): Promise<{ valid: boolean; error?: string }> {
  if (!apiKey.trim()) return { valid: false, error: 'Google Maps API key is required' };

  return new Promise((resolve) => {
    const existing = document.getElementById('otr-maps-validate');
    if (existing) existing.remove();

    const callbackName = `__otrMapsValidate_${Date.now()}`;
    const timeout = window.setTimeout(() => {
      cleanup();
      resolve({ valid: false, error: 'Maps key validation timed out' });
    }, 12000);

    const cleanup = () => {
      window.clearTimeout(timeout);
      delete (window as unknown as Record<string, unknown>)[callbackName];
      script.remove();
    };

    (window as unknown as Record<string, unknown>)[callbackName] = () => {
      try {
        const geocoder = new google.maps.Geocoder();
        geocoder.geocode({ address: 'Austin, TX' }, (results, status) => {
          cleanup();
          if (status === 'OK' && results?.length) {
            resolve({ valid: true });
          } else if (status === 'REQUEST_DENIED') {
            resolve({
              valid: false,
              error: 'Maps key denied. Enable Maps JavaScript, Places, Directions, and Geocoding APIs.',
            });
          } else {
            resolve({ valid: false, error: `Geocoding failed: ${status}` });
          }
        });
      } catch (error) {
        cleanup();
        resolve({
          valid: false,
          error: error instanceof Error ? error.message : 'Maps validation failed',
        });
      }
    };

    const script = document.createElement('script');
    script.id = 'otr-maps-validate';
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places,geometry&callback=${callbackName}`;
    script.async = true;
    script.onerror = () => {
      cleanup();
      resolve({ valid: false, error: 'Failed to load Google Maps. Check the API key.' });
    };
    document.head.appendChild(script);
  });
}

export async function geocodeAddress(address: string): Promise<ResolvedPlace | null> {
  const maps = getMaps();
  const geocoder = new maps.Geocoder();
  const response = await geocoder.geocode({ address });
  const result = response.results[0];
  if (!result) return null;
  const location = {
    lat: result.geometry.location.lat(),
    lng: result.geometry.location.lng(),
  };
  return {
    placeId: result.place_id,
    name: result.formatted_address,
    address: result.formatted_address,
    location,
    mapsUrl: placeMapsUrl({
      placeId: result.place_id,
      address: result.formatted_address,
      location,
    }),
  };
}

export async function reverseGeocode(location: LatLng): Promise<ResolvedPlace | null> {
  const maps = getMaps();
  const geocoder = new maps.Geocoder();
  const response = await geocoder.geocode({ location });
  const result = response.results[0];
  if (!result) return null;
  return {
    placeId: result.place_id,
    name: result.formatted_address,
    address: result.formatted_address,
    location,
    mapsUrl: placeMapsUrl({
      placeId: result.place_id,
      address: result.formatted_address,
      location,
    }),
  };
}

export async function searchPlace(
  query: string,
  near?: LatLng,
): Promise<ResolvedPlace | null> {
  const maps = getMaps();
  const service = new maps.places.PlacesService(document.createElement('div'));

  const find = await new Promise<google.maps.places.PlaceResult | null>((resolve) => {
    service.findPlaceFromQuery(
      {
        query,
        fields: ['place_id', 'name', 'geometry', 'formatted_address', 'rating', 'photos'],
        locationBias: near ? new maps.LatLng(near.lat, near.lng) : undefined,
      },
      (results, status) => {
        if (status === maps.places.PlacesServiceStatus.OK && results?.[0]) {
          resolve(results[0]);
        } else {
          resolve(null);
        }
      },
    );
  });

  if (!find?.place_id) {
    // fallback text search
    const text = await new Promise<google.maps.places.PlaceResult | null>((resolve) => {
      service.textSearch(
        {
          query,
          location: near ? new maps.LatLng(near.lat, near.lng) : undefined,
          radius: near ? 50000 : undefined,
        },
        (results, status) => {
          if (status === maps.places.PlacesServiceStatus.OK && results?.[0]) resolve(results[0]);
          else resolve(null);
        },
      );
    });
    if (!text?.place_id) return null;
    return getPlaceDetails(text.place_id);
  }

  return getPlaceDetails(find.place_id);
}

export async function getPlaceDetails(placeId: string): Promise<ResolvedPlace | null> {
  const maps = getMaps();
  const service = new maps.places.PlacesService(document.createElement('div'));

  return new Promise((resolve) => {
    service.getDetails(
      {
        placeId,
        fields: [
          'place_id',
          'name',
          'geometry',
          'formatted_address',
          'rating',
          'price_level',
          'opening_hours',
          'photos',
          'website',
          'formatted_phone_number',
        ],
      },
      (place, status) => {
        if (status !== maps.places.PlacesServiceStatus.OK || !place?.geometry?.location) {
          resolve(null);
          return;
        }
        const photoUrls =
          place.photos?.slice(0, 4).map((p) => p.getUrl({ maxWidth: 1200, maxHeight: 900 })) || [];
        const photoUrl = photoUrls[0];
        const hours = place.opening_hours?.weekday_text?.join(' · ');
        const resolvedPlaceId = place.place_id || placeId;
        resolve({
          placeId: resolvedPlaceId,
          name: place.name || 'Unknown place',
          location: {
            lat: place.geometry.location.lat(),
            lng: place.geometry.location.lng(),
          },
          address: place.formatted_address,
          rating: place.rating,
          priceLevel: place.price_level,
          hours,
          photoUrl,
          photoUrls,
          mapsUrl: placeMapsUrl({
            placeId: resolvedPlaceId,
            name: place.name,
            address: place.formatted_address,
            location: {
              lat: place.geometry.location.lat(),
              lng: place.geometry.location.lng(),
            },
          }),
          website: place.website,
          phone: place.formatted_phone_number,
        });
      },
    );
  });
}

export async function getDirectionsBetween(
  points: LatLng[],
): Promise<{
  legs: { distanceMeters: number; durationSeconds: number; start: LatLng; end: LatLng }[];
  polyline: string;
  overviewPath: LatLng[];
} | null> {
  if (points.length < 2) return null;
  const maps = getMaps();
  const service = new maps.DirectionsService();

  const origin = points[0];
  const destination = points[points.length - 1];
  const waypoints = points.slice(1, -1).map((p) => ({
    location: new maps.LatLng(p.lat, p.lng),
    stopover: true,
  }));

  return new Promise((resolve) => {
    service.route(
      {
        origin: new maps.LatLng(origin.lat, origin.lng),
        destination: new maps.LatLng(destination.lat, destination.lng),
        waypoints,
        travelMode: maps.TravelMode.DRIVING,
        optimizeWaypoints: false,
      },
      (result, status) => {
        if (status !== 'OK' || !result?.routes?.[0]) {
          resolve(null);
          return;
        }
        const route = result.routes[0];
        const legs = route.legs.map((leg) => ({
          distanceMeters: leg.distance?.value || 0,
          durationSeconds: leg.duration?.value || 0,
          start: {
            lat: leg.start_location.lat(),
            lng: leg.start_location.lng(),
          },
          end: {
            lat: leg.end_location.lat(),
            lng: leg.end_location.lng(),
          },
        }));
        resolve({
          legs,
          polyline: route.overview_polyline,
          overviewPath: route.overview_path.map((p) => ({ lat: p.lat(), lng: p.lng() })),
        });
      },
    );
  });
}

export async function buildDriveLegs(
  stops: Stop[],
  maxDriveHours: number,
): Promise<DriveLeg[]> {
  const ordered = stops.slice().sort((a, b) => a.dayIndex - b.dayIndex || a.order - b.order);
  if (ordered.length < 2) return [];

  // Directions API has waypoint limits; chunk by contiguous day groups but also allow cross-day continuity
  const legs: DriveLeg[] = [];
  const chunkSize = 20;

  for (let i = 0; i < ordered.length - 1; i += chunkSize - 1) {
    const chunk = ordered.slice(i, Math.min(i + chunkSize, ordered.length));
    if (chunk.length < 2) break;
    const directions = await getDirectionsBetween(chunk.map((s) => s.location));
    if (!directions) continue;

    directions.legs.forEach((leg, idx) => {
      const from = chunk[idx];
      const to = chunk[idx + 1];
      if (!from || !to) return;
      const durationHours = leg.durationSeconds / 3600;
      legs.push({
        id: uuid(),
        fromStopId: from.id,
        toStopId: to.id,
        dayIndex: to.dayIndex,
        distanceMeters: leg.distanceMeters,
        durationSeconds: leg.durationSeconds,
        polyline: directions.polyline,
        exceedsMaxDrive: durationHours > maxDriveHours,
        fuelSuggested: durationHours >= 3 || leg.distanceMeters / 1609.344 >= 150,
      });
    });
  }

  return legs;
}

export async function findFuelAlongRoute(
  from: LatLng,
  to: LatLng,
): Promise<ResolvedPlace | null> {
  const mid: LatLng = {
    lat: (from.lat + to.lat) / 2,
    lng: (from.lng + to.lng) / 2,
  };
  return searchPlace('gas station', mid);
}

export function decodePolyline(encoded: string): LatLng[] {
  const points: LatLng[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let b: number;
    let shift = 0;
    let result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }

  return points;
}
