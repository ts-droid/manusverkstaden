/**
 * Connection Monitor – detects server availability and queues failed saves.
 *
 * Features:
 * - Heartbeat ping to /api/health every 30s (backs off when offline)
 * - Listens to browser online/offline events
 * - Queues failed API saves in localStorage for replay
 * - Auto-flushes queue when connection returns (via registered flush callback)
 * - Exposes reactive status for UI banner
 */

const HEALTH_URL = '/api/health';
const QUEUE_KEY = 'mv_pending_saves';
const HEARTBEAT_ONLINE = 30_000;   // 30s when online
const HEARTBEAT_OFFLINE = 10_000;  // 10s when offline (check more often)
const MAX_QUEUE_SIZE = 200;        // Prevent localStorage overflow
const MAX_QUEUE_AGE_MS = 24 * 60 * 60 * 1000; // 24h — discard older entries

let _status = 'online'; // 'online' | 'offline' | 'reconnecting'
let _listeners = [];
let _heartbeatTimer = null;
let _flushing = false;
let _flushCallback = null; // Set by api-client to replay with proper auth
let _started = false;

// ─── Status ───

export function getConnectionStatus() {
  return _status;
}

/**
 * Subscribe to connection status changes.
 * @param {function} fn - Called with ('online'|'offline'|'reconnecting')
 * @returns {function} Unsubscribe function
 */
export function onStatusChange(fn) {
  _listeners.push(fn);
  return () => {
    _listeners = _listeners.filter(l => l !== fn);
  };
}

function setStatus(newStatus) {
  if (newStatus === _status) return;
  const prev = _status;
  _status = newStatus;
  console.log(`[Connection] ${prev} → ${newStatus}`);
  _listeners.forEach(fn => {
    try { fn(newStatus); } catch (e) { console.error('[Connection] listener error:', e); }
  });

  // When we come back online, flush pending saves
  if (newStatus === 'online' && prev !== 'online') {
    flushQueue();
  }
}

// ─── Heartbeat ───

async function checkHealth() {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(HEALTH_URL, {
      method: 'GET',
      signal: controller.signal,
      cache: 'no-store',
    });
    clearTimeout(timeout);

    if (res.ok) {
      setStatus('online');
    } else {
      setStatus('offline');
    }
  } catch {
    setStatus('offline');
  }
}

function scheduleHeartbeat() {
  if (_heartbeatTimer) clearTimeout(_heartbeatTimer);
  const interval = _status === 'online' ? HEARTBEAT_ONLINE : HEARTBEAT_OFFLINE;
  _heartbeatTimer = setTimeout(async () => {
    await checkHealth();
    scheduleHeartbeat();
  }, interval);
}

// ─── Pending Save Queue ───

function loadQueue() {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const items = JSON.parse(raw);
    // Prune old entries
    const cutoff = Date.now() - MAX_QUEUE_AGE_MS;
    return items.filter(item => item.ts > cutoff);
  } catch {
    return [];
  }
}

function saveQueue(items) {
  try {
    // Keep only latest entries if too many
    const trimmed = items.slice(-MAX_QUEUE_SIZE);
    localStorage.setItem(QUEUE_KEY, JSON.stringify(trimmed));
  } catch (e) {
    console.error('[Connection] Failed to save queue:', e);
  }
}

/**
 * Add a failed save to the retry queue.
 * @param {string} path - API path (e.g. '/chapters/123')
 * @param {string} method - HTTP method
 * @param {object} body - Request body
 */
export function queueSave(path, method, body) {
  const queue = loadQueue();

  // Deduplicate: if same path+method exists, replace with latest
  const existingIdx = queue.findIndex(item => item.path === path && item.method === method);
  const entry = { path, method, body, ts: Date.now() };

  if (existingIdx !== -1) {
    queue[existingIdx] = entry;
  } else {
    queue.push(entry);
  }

  saveQueue(queue);
  console.log(`[Connection] Queued save: ${method} ${path} (${queue.length} pending)`);
}

/**
 * Get count of pending saves.
 */
export function getPendingCount() {
  return loadQueue().length;
}

/**
 * Register a callback that replays a single queued save with proper auth.
 * Called by api-client to avoid circular dependency.
 * @param {function} fn - async (path, method, body) => boolean (true = success)
 */
export function registerFlushCallback(fn) {
  _flushCallback = fn;
}

/**
 * Flush all pending saves to the server.
 * Called automatically when connection returns.
 */
async function flushQueue() {
  if (_flushing) return;
  if (!_flushCallback) return; // No callback registered yet
  _flushing = true;

  const queue = loadQueue();
  if (queue.length === 0) {
    _flushing = false;
    return;
  }

  console.log(`[Connection] Flushing ${queue.length} pending saves...`);
  setStatus('reconnecting');

  const failed = [];
  for (const item of queue) {
    try {
      const success = await _flushCallback(item.path, item.method, item.body);
      if (!success) failed.push(item);
    } catch {
      failed.push(item);
    }
  }

  saveQueue(failed);

  if (failed.length === 0) {
    console.log('[Connection] All pending saves flushed successfully');
    setStatus('online');
  } else {
    console.log(`[Connection] ${failed.length} saves still pending`);
    setStatus('offline');
  }

  _flushing = false;
}

// ─── Init ───

/**
 * Start monitoring connection status.
 * Call once on app startup. Safe to call multiple times (idempotent).
 */
export function startConnectionMonitor() {
  if (_started) return;
  _started = true;

  // Browser events
  window.addEventListener('online', () => {
    console.log('[Connection] Browser reports online');
    checkHealth(); // Verify with actual server ping
  });

  window.addEventListener('offline', () => {
    console.log('[Connection] Browser reports offline');
    setStatus('offline');
  });

  // Initial check
  if (!navigator.onLine) {
    setStatus('offline');
  } else {
    checkHealth();
  }

  // Start heartbeat
  scheduleHeartbeat();

  // Warn before closing with pending saves
  window.addEventListener('beforeunload', (e) => {
    const pending = getPendingCount();
    if (pending > 0 && _status !== 'online') {
      e.preventDefault();
      e.returnValue = 'Du har osparade ändringar. Stäng inte webbläsaren förrän servern är tillgänglig igen.';
    }
  });
}
