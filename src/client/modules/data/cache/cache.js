// Two-tier cache (memory + sessionStorage). Entries are namespaced by a scope
// (the logged-in org/user) so one login can never read another login's data.
// Until a scope is set nothing is persisted and nothing is read from storage.
const PREFIX = 'lwci:cache:v1:';
export const MAX_ENTRIES = 60;
export const MAX_ENTRY_CHARS = 750000;

const memory = new Map(); // key -> { value, ts }
let scope = null;

const clone = (value) => JSON.parse(JSON.stringify(value));

function storage() {
    try {
        return window.sessionStorage;
    } catch {
        return null;
    }
}

function storageKeys(store) {
    const keys = [];
    for (let i = 0; i < store.length; i++) {
        const key = store.key(i);
        if (key && key.startsWith(PREFIX)) keys.push(key);
    }
    return keys;
}

// Removes persisted entries, optionally keeping those under `keep`
function purgeStorage(keep) {
    const store = storage();
    if (!store) return;
    try {
        storageKeys(store)
            .filter((key) => !keep || !key.startsWith(keep))
            .forEach((key) => store.removeItem(key));
    } catch {
        // storage unavailable: memory cache still works
    }
}

const scopedPrefix = () => `${PREFIX}${encodeURIComponent(scope)}:`;

function persist(key, entry) {
    const store = storage();
    if (!store || scope === null) return;
    const text = JSON.stringify(entry);
    if (text.length > MAX_ENTRY_CHARS) return;
    try {
        store.setItem(scopedPrefix() + key, text);
    } catch {
        // quota exceeded: drop persisted entries and carry on from memory
        purgeStorage(null);
    }
}

function enforceCap() {
    while (memory.size > MAX_ENTRIES) {
        const oldest = memory.keys().next().value;
        memory.delete(oldest);
        try {
            if (scope !== null) storage()?.removeItem(scopedPrefix() + oldest);
        } catch {
            // ignore
        }
    }
}

/**
 * Sets the identity the cache is keyed on. A changed scope drops memory and
 * every persisted entry that belongs to a different scope.
 */
export function setScope(next) {
    const value = next === undefined || next === null ? null : String(next);
    if (value === scope) return;
    scope = value;
    memory.clear();
    purgeStorage(scope === null ? null : scopedPrefix());
}

export function getScope() {
    return scope;
}

export function clear() {
    memory.clear();
    purgeStorage(null);
}

export function remove(key) {
    memory.delete(key);
    try {
        if (scope !== null) storage()?.removeItem(scopedPrefix() + key);
    } catch {
        // ignore
    }
}

/** @returns {{value: *, ts: number}|null} a private copy of the entry */
export function get(key) {
    let entry = memory.get(key);
    if (!entry && scope !== null) {
        try {
            const raw = storage()?.getItem(scopedPrefix() + key);
            const parsed = raw ? JSON.parse(raw) : null;
            if (parsed && typeof parsed.ts === 'number' && 'value' in parsed) {
                entry = parsed;
                memory.set(key, entry);
            }
        } catch {
            entry = undefined;
        }
    }
    return entry ? { value: clone(entry.value), ts: entry.ts } : null;
}

export function set(key, value, ts = Date.now()) {
    const entry = { value: clone(value), ts };
    memory.delete(key); // re-insert so insertion order tracks recency
    memory.set(key, entry);
    enforceCap();
    persist(key, entry);
    return ts;
}

export function age(entry, now = Date.now()) {
    return entry ? Math.max(0, now - entry.ts) : Infinity;
}

/** "Updated just now" / "Updated 3 min ago" */
export function formatAge(ts, now = Date.now()) {
    if (!ts) return '';
    const minutes = Math.floor((now - ts) / 60000);
    if (minutes < 1) return 'Updated just now';
    if (minutes < 60) return `Updated ${minutes} min ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `Updated ${hours} hr ago`;
    return `Updated ${Math.floor(hours / 24)} d ago`;
}
