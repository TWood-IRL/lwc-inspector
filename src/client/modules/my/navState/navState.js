// Pure helpers for deep links (URL hash) and the recently viewed list.
// No LWC or DOM dependencies beyond an injectable Storage, so they are easy to test.

export const TYPE_TO_SLUG = { lwcComps: 'lwc', auraComps: 'aura' };
export const SLUG_TO_TYPE = { lwc: 'lwcComps', aura: 'auraComps' };

export const RECENTS_KEY = 'lwci.recents';
export const RECENTS_VERSION = 1;
export const MAX_RECENTS = 8;

const safeDecode = (value) => {
    try {
        return decodeURIComponent(value);
    } catch {
        return null;
    }
};

/**
 * Parses "#/lwc/myComp/myComp.js" into { type, bundle, file }.
 * type is the component type value (lwcComps / auraComps).
 * Returns null when the hash is not a component link.
 */
export function parseHash(hash) {
    if (typeof hash !== 'string') {
        return null;
    }
    const parts = hash.replace(/^#\/?/, '').split('/');
    if (parts.length < 2 || parts.length > 3) {
        return null;
    }
    const [slug, bundle, file = ''] = parts.map(safeDecode);
    const type = SLUG_TO_TYPE[slug];
    if (!type || !bundle || file === null) {
        return null;
    }
    return { type, bundle, file: file || null };
}

/**
 * Inverse of parseHash. Returns '' when there is no usable selection.
 */
export function buildHash({ type, bundle, file } = {}) {
    const slug = TYPE_TO_SLUG[type];
    if (!slug || !bundle) {
        return '';
    }
    let hash = `#/${slug}/${encodeURIComponent(bundle)}`;
    if (file) {
        hash += `/${encodeURIComponent(file)}`;
    }
    return hash;
}

const isValidEntry = (entry) =>
    entry &&
    typeof entry.name === 'string' &&
    entry.name &&
    typeof entry.label === 'string' &&
    !!TYPE_TO_SLUG[entry.type];

const getStorage = (storage) => {
    try {
        return storage ?? globalThis.localStorage ?? null;
    } catch {
        return null;
    }
};

export function loadRecents(storage) {
    try {
        const raw = getStorage(storage)?.getItem(RECENTS_KEY);
        if (!raw) {
            return [];
        }
        const parsed = JSON.parse(raw);
        if (parsed?.v !== RECENTS_VERSION || !Array.isArray(parsed.items)) {
            return [];
        }
        return parsed.items.filter(isValidEntry).slice(0, MAX_RECENTS);
    } catch {
        return [];
    }
}

function saveRecents(items, storage) {
    try {
        getStorage(storage)?.setItem(
            RECENTS_KEY,
            JSON.stringify({ v: RECENTS_VERSION, items })
        );
    } catch {
        // storage unavailable or full: recents are a convenience only
    }
}

/**
 * Adds a bundle to the front of the list (deduped by type + name),
 * capped at MAX_RECENTS. Persists and returns the new list.
 */
export function addRecent({ name, label, type }, storage) {
    const entry = { name, label: label || name, type };
    if (!isValidEntry(entry)) {
        return loadRecents(storage);
    }
    const items = [
        entry,
        ...loadRecents(storage).filter(
            (item) => !(item.name === entry.name && item.type === entry.type)
        )
    ].slice(0, MAX_RECENTS);
    saveRecents(items, storage);
    return items;
}

export function clearRecents(storage) {
    try {
        getStorage(storage)?.removeItem(RECENTS_KEY);
    } catch {
        // ignore
    }
    return [];
}
