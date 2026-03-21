/**
 * Storage – IndexedDB persistence for Manusverkstaden
 *
 * Saves and restores full project state so work survives
 * page reloads, browser crashes, and accidental tab closures.
 */

const DB_NAME = 'manusverkstaden-db';
const DB_VERSION = 1;
const STORE_NAME = 'projects';
const PROJECT_KEY = 'current';

/** Open (or create) the database. */
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Save project state to IndexedDB.
 *
 * Converts Sets to Arrays for JSON compatibility.
 * @param {Object} data - Full project state
 */
export async function saveProject(data) {
  try {
    const db = await openDB();
    const serializable = {
      ...data,
      accepted: data.accepted instanceof Set ? [...data.accepted] : data.accepted || [],
      rejected: data.rejected instanceof Set ? [...data.rejected] : data.rejected || [],
      timestamp: Date.now(),
    };

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(serializable, PROJECT_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.error('Auto-save failed:', err);
  }
}

/**
 * Load project state from IndexedDB.
 *
 * Converts Arrays back to Sets where appropriate.
 * @returns {Object|null} Saved state, or null if nothing exists
 */
export async function loadProject() {
  try {
    const db = await openDB();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const request = tx.objectStore(STORE_NAME).get(PROJECT_KEY);

      request.onsuccess = () => {
        const data = request.result;
        if (!data) return resolve(null);

        resolve({
          ...data,
          accepted: new Set(data.accepted || []),
          rejected: new Set(data.rejected || []),
        });
      };

      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error('Load failed:', err);
    return null;
  }
}

/**
 * Delete saved project from IndexedDB.
 */
export async function clearProject() {
  try {
    const db = await openDB();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(PROJECT_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.error('Clear failed:', err);
  }
}

/**
 * Check if a saved project exists (without loading the full data).
 * @returns {boolean}
 */
export async function hasSavedProject() {
  try {
    const db = await openDB();

    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const request = tx.objectStore(STORE_NAME).count();
      request.onsuccess = () => resolve(request.result > 0);
      request.onerror = () => resolve(false);
    });
  } catch {
    return false;
  }
}
