// Local cache for the Home page story sections.
// When the server is unreachable (or the device drops connectivity mid-session),
// the Home page falls back to the most recent data stored here instead of going blank.

const CACHE_KEY = "darijastories_home_cache";
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveHomeCache(section, data) {
  try {
    const cache = readCache();
    cache[section] = { data, ts: Date.now() };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // storage may be full or unavailable — ignore
  }
}

export function getHomeCache(section) {
  try {
    const cache = readCache();
    const entry = cache[section];
    if (!entry) return null;
    if (Date.now() - entry.ts > MAX_AGE_MS) return null;
    return entry.data;
  } catch {
    return null;
  }
}