// Code viewer preferences: a small pure store shared by every viewer
// instance. Persists to localStorage (versioned, validated) and notifies
// subscribers on change. No LWC or DOM dependencies beyond window.localStorage.
export const STORAGE_KEY = 'lwci-viewer-prefs';
export const VERSION = 1;

export const FONT_SIZE_MIN = 11;
export const FONT_SIZE_MAX = 20;
export const TAB_WIDTHS = [2, 4, 8];

export const SYNTAX_THEMES = [
    { value: 'auto', label: 'Auto (follow site)' },
    { value: 'midnight', label: 'Midnight' },
    { value: 'paper', label: 'Paper' },
    { value: 'solarized', label: 'Solarized' },
    { value: 'contrast', label: 'High contrast' }
];

// Unitless multipliers of the font size
export const LINE_HEIGHTS = {
    compact: 1.35,
    normal: 1.55,
    relaxed: 1.8
};

export const DEFAULTS = Object.freeze({
    fontSize: 13,
    tabWidth: 4,
    lineNumbers: true,
    wordWrap: false,
    syntaxTheme: 'midnight',
    lineHeight: 'normal',
    highlightLine: true
});

const validators = {
    fontSize: (v) =>
        Number.isInteger(v) && v >= FONT_SIZE_MIN && v <= FONT_SIZE_MAX,
    tabWidth: (v) => TAB_WIDTHS.includes(v),
    lineNumbers: (v) => typeof v === 'boolean',
    wordWrap: (v) => typeof v === 'boolean',
    syntaxTheme: (v) => SYNTAX_THEMES.some((t) => t.value === v),
    lineHeight: (v) => Object.prototype.hasOwnProperty.call(LINE_HEIGHTS, v),
    highlightLine: (v) => typeof v === 'boolean'
};

export function clampFontSize(value) {
    const n = Math.round(Number(value));
    if (!Number.isFinite(n)) {
        return DEFAULTS.fontSize;
    }
    return Math.min(FONT_SIZE_MAX, Math.max(FONT_SIZE_MIN, n));
}

// Returns a complete, valid prefs object. Unknown keys are dropped and each
// invalid value falls back to its default.
export function sanitize(input) {
    const source = input && typeof input === 'object' ? input : {};
    const out = {};
    for (const key of Object.keys(DEFAULTS)) {
        out[key] = validators[key](source[key]) ? source[key] : DEFAULTS[key];
    }
    return out;
}

function storage() {
    try {
        return window.localStorage;
    } catch {
        return null;
    }
}

function load() {
    try {
        const raw = storage().getItem(STORAGE_KEY);
        if (!raw) {
            return sanitize();
        }
        const parsed = JSON.parse(raw);
        if (!parsed || parsed.v !== VERSION) {
            return sanitize();
        }
        return sanitize(parsed.prefs);
    } catch {
        return sanitize();
    }
}

function save(prefs) {
    try {
        storage().setItem(STORAGE_KEY, JSON.stringify({ v: VERSION, prefs }));
    } catch {
        // storage unavailable or full: preferences just won't persist
    }
}

let current;
const subscribers = new Set();
let storageListening = false;

function same(a, b) {
    return Object.keys(DEFAULTS).every((k) => a[k] === b[k]);
}

function emit() {
    // Copy so a subscriber unsubscribing mid-loop is safe
    for (const fn of Array.from(subscribers)) {
        try {
            fn(current);
        } catch {
            // one broken subscriber must not starve the others
        }
    }
}

function commit(next, persist = true) {
    if (current && same(current, next)) {
        return current;
    }
    current = Object.freeze(next);
    if (persist) {
        save(current);
    }
    emit();
    return current;
}

function onStorage(event) {
    if (event.key !== null && event.key !== STORAGE_KEY) {
        return;
    }
    getPrefs();
    commit(load(), false);
}

export function getPrefs() {
    if (!current) {
        current = Object.freeze(load());
    }
    return current;
}

// Merges a partial update; invalid values are ignored (keep the old value)
export function setPrefs(patch) {
    const base = { ...getPrefs() };
    for (const key of Object.keys(patch || {})) {
        if (validators[key] && validators[key](patch[key])) {
            base[key] = patch[key];
        }
    }
    return commit(base);
}

export function resetPrefs() {
    getPrefs();
    return commit({ ...DEFAULTS });
}

// Change the font size by delta px (clamped); returns the new prefs
export function stepFontSize(delta) {
    return setPrefs({ fontSize: clampFontSize(getPrefs().fontSize + delta) });
}

export function resetFontSize() {
    return setPrefs({ fontSize: DEFAULTS.fontSize });
}

// fn(prefs) is called on every change, including from other tabs.
// Returns an unsubscribe function.
export function subscribe(fn) {
    getPrefs();
    subscribers.add(fn);
    if (!storageListening && typeof window !== 'undefined') {
        storageListening = true;
        window.addEventListener('storage', onStorage);
    }
    return () => {
        subscribers.delete(fn);
        if (!subscribers.size && storageListening) {
            storageListening = false;
            window.removeEventListener('storage', onStorage);
        }
    };
}

export function lineHeightMultiplier(name) {
    return LINE_HEIGHTS[name] || LINE_HEIGHTS.normal;
}

// Test hook: drop the in-memory cache so the next read reloads from storage
export function __resetForTests() {
    current = undefined;
    subscribers.clear();
    if (storageListening) {
        window.removeEventListener('storage', onStorage);
        storageListening = false;
    }
}
