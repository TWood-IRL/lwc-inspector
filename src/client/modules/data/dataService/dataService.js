import * as cache from 'data/cache';

export const TTL_MS = 10 * 60 * 1000;
export const MAX_ATTEMPTS = 3;
export const BASE_DELAY_MS = 500;

const inflight = new Map(); // cache key -> promise
let searchSlot = null; // { key, controller, promise } for the latest search

export function abortError() {
    const error = new Error('Request aborted');
    error.name = 'AbortError';
    return error;
}
export const isAbortError = (error) => error?.name === 'AbortError';

function isRetryable(error) {
    if (isAbortError(error)) return false;
    if (error.status === undefined) return true; // network failure
    return error.status >= 500 || error.status === 429;
}

function sleep(ms, signal) {
    return new Promise((resolve, reject) => {
        if (signal?.aborted) {
            reject(abortError());
            return;
        }
        let timer;
        const onAbort = () => {
            clearTimeout(timer);
            reject(abortError());
        };
        timer = setTimeout(() => {
            signal?.removeEventListener('abort', onAbort);
            resolve();
        }, ms);
        signal?.addEventListener('abort', onAbort, { once: true });
    });
}

async function getJsonOnce(url, signal) {
    let response;
    try {
        response = await (signal ? fetch(url, { signal }) : fetch(url));
    } catch (error) {
        if (signal?.aborted) throw abortError();
        throw error;
    }
    if (signal?.aborted) throw abortError();
    if (!response.ok) {
        const error = new Error(`Request failed (${response.status})`);
        error.status = response.status;
        throw error;
    }
    return response.json();
}

// Retries network errors, 5xx and 429 with exponential backoff (never 4xx)
/* eslint-disable no-await-in-loop -- attempts are sequential by design */
async function getJson(url, signal) {
    for (let attempt = 1; ; attempt++) {
        try {
            return await getJsonOnce(url, signal);
        } catch (error) {
            if (attempt >= MAX_ATTEMPTS || !isRetryable(error)) throw error;
            await sleep(BASE_DELAY_MS * 2 ** (attempt - 1), signal);
        }
    }
}

/* eslint-enable no-await-in-loop */

// Fetches, de-duplicates concurrent identical requests and stores the result
function load(key, url) {
    if (inflight.has(key)) return inflight.get(key);
    const promise = getJson(url)
        .then((body) => {
            cache.set(key, body);
            return body;
        })
        .finally(() => {
            if (inflight.get(key) === promise) inflight.delete(key);
        });
    inflight.set(key, promise);
    return promise;
}

const isOffline = () =>
    typeof navigator !== 'undefined' && navigator.onLine === false;

/**
 * Cache-first read. Fresh entries are returned as is. Stale entries are
 * returned immediately and revalidated in the background (stale-while-
 * revalidate) when `swr` is set; `onRevalidate(body)` receives the new data.
 * Without swr a stale entry is refetched, unless we are offline.
 */
async function cached(
    key,
    url,
    { force, swr, onRevalidate, onRevalidateError }
) {
    const entry = force ? null : cache.get(key);
    if (entry) {
        if (cache.age(entry) < TTL_MS || isOffline()) return entry.value;
        if (swr) {
            load(key, url)
                .then((body) => onRevalidate?.(body))
                .catch((error) => onRevalidateError?.(error));
            return entry.value;
        }
    }
    return load(key, url);
}

const listKey = (type) => `list:${type}`;
const itemKey = (id) => `item:${id}`;
const searchKey = (type, term) => `search:${type}:${term}`;

/**
 * @param {string} compTypeValue
 * @param {{force?: boolean, onRevalidate?: Function}} [options]
 */
export function getLightningComponentBundles(compTypeValue, options = {}) {
    return cached(
        listKey(compTypeValue),
        `/api/LightningComponents?type=${encodeURIComponent(compTypeValue)}`,
        { swr: true, ...options }
    );
}

// pass the Id, get the contents of the bundle (cached per bundle)
export function getLightningComponentBundleById(id, options = {}) {
    return cached(
        itemKey(id),
        `/api/LightningComponent/${encodeURIComponent(id)}`,
        options
    );
}

/**
 * Only the latest search is allowed to resolve: starting a new one aborts the
 * previous request, whose promise rejects with an AbortError.
 */
export function searchLightningComponentBundle(
    compTypeValue,
    searchTerm,
    options = {}
) {
    const key = searchKey(compTypeValue, searchTerm);
    if (searchSlot?.key === key && searchSlot.promise && !options.force) {
        return searchSlot.promise; // identical search already running
    }
    searchSlot?.controller.abort();
    const controller = new AbortController();
    const slot = { key, controller, promise: null };
    searchSlot = slot;

    const hit = options.force ? null : cache.get(key);
    const params = new URLSearchParams({ type: compTypeValue, q: searchTerm });
    if (hit && (cache.age(hit) < TTL_MS || isOffline())) {
        slot.promise = Promise.resolve(hit.value);
        return slot.promise;
    }
    slot.promise = getJson(
        `/api/LightningComponents?${params}`,
        controller.signal
    )
        .then((body) => {
            // never resolve for a superseded search, even if fetch ignored abort
            if (searchSlot !== slot) throw abortError();
            cache.set(key, body);
            return body;
        })
        .finally(() => {
            if (searchSlot === slot) slot.promise = null;
        });
    return slot.promise;
}

/** Timestamp (ms) the cached bundle list for this type was fetched, or null */
export function getBundlesUpdatedAt(compTypeValue) {
    return cache.get(listKey(compTypeValue))?.ts ?? null;
}

/**
 * Public refresh. With force (default) cached lists, items and searches are
 * dropped so everything is re-fetched; returns the fresh bundle list.
 */
export function refresh(compTypeValue, force = true) {
    if (force) {
        cache.clear();
    }
    return getLightningComponentBundles(compTypeValue, { force });
}

export function clearCache() {
    cache.clear();
}
