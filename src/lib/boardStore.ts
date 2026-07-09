const DB_NAME = 'otr-boards';
const STORE = 'images';
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('IndexedDB open failed'));
  });
}

export async function saveBoardImage(tripId: string, imageUrl: string): Promise<void> {
  if (!tripId || !imageUrl) return;
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(imageUrl, tripId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('Failed to save board image'));
    });
    db.close();
  } catch {
    // private mode / quota — in-memory trip still holds the image
  }
}

export async function loadBoardImage(tripId: string): Promise<string | null> {
  if (!tripId) return null;
  try {
    const db = await openDb();
    const value = await new Promise<string | null>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(tripId);
      req.onsuccess = () => resolve((req.result as string) || null);
      req.onerror = () => reject(req.error || new Error('Failed to load board image'));
    });
    db.close();
    return value;
  } catch {
    return null;
  }
}

export async function deleteBoardImage(tripId: string): Promise<void> {
  if (!tripId) return;
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(tripId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('Failed to delete board image'));
    });
    db.close();
  } catch {
    // ignore
  }
}

/** Strip huge data-URLs from trips before writing to localStorage. */
export function tripForLocalStorage<T extends { id: string; boardImageUrl?: string }>(
  trip: T,
): T {
  const url = trip.boardImageUrl;
  if (url && url.startsWith('data:') && url.length > 40_000) {
    void saveBoardImage(trip.id, url);
    return { ...trip, boardImageUrl: `idb:${trip.id}` };
  }
  if (url && url.startsWith('data:')) {
    void saveBoardImage(trip.id, url);
  }
  return trip;
}

export async function hydrateBoardImage<T extends { id: string; boardImageUrl?: string }>(
  trip: T | null,
): Promise<T | null> {
  if (!trip?.boardImageUrl) return trip;
  if (trip.boardImageUrl.startsWith('data:') || trip.boardImageUrl.startsWith('http')) {
    return trip;
  }
  try {
    if (typeof indexedDB === 'undefined') return trip;
    if (trip.boardImageUrl.startsWith('idb:') || trip.boardImageUrl === `idb:${trip.id}`) {
      const stored = await loadBoardImage(trip.id);
      if (stored) return { ...trip, boardImageUrl: stored };
    }
    const stored = await loadBoardImage(trip.id);
    if (stored) return { ...trip, boardImageUrl: stored };
  } catch {
    // ignore corrupt board refs
  }
  return trip;
}
