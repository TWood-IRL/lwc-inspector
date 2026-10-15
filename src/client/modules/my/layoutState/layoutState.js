// Pure helpers for the workspace layout (list/source split, collapse state).
// Legacy storage keys: the 'tree' naming predates the flat component list.
// Kept as-is so users' saved width/collapsed preferences keep working.
export const WIDTH_KEY = 'lwci-tree-width';
export const COLLAPSED_KEY = 'lwci-tree-collapsed';
export const DEFAULT_LIST_WIDTH = 288;
export const MIN_LIST_WIDTH = 200;
export const MAX_LIST_WIDTH = 640;
export const MIN_SOURCE_WIDTH = 320;
export const SPLITTER_WIDTH = 20;
export const KEY_STEP = 16;

export function clamp(value, min, max) {
    const n = Number(value);
    if (!Number.isFinite(n)) return min;
    // A degenerate range collapses to min
    const upper = Math.max(min, max);
    return Math.min(upper, Math.max(min, n));
}

// Widest the component list may be, leaving room for the source pane.
export function maxListWidth(containerWidth) {
    if (!Number.isFinite(containerWidth) || containerWidth <= 0) {
        return MAX_LIST_WIDTH;
    }
    return clamp(
        containerWidth - MIN_SOURCE_WIDTH - SPLITTER_WIDTH,
        MIN_LIST_WIDTH,
        MAX_LIST_WIDTH
    );
}

// Next width for a keyboard event, or null when the key is not handled.
export function widthForKey(key, current, min, max, step = KEY_STEP) {
    switch (key) {
        case 'ArrowLeft':
        case 'ArrowUp':
            return clamp(current - step, min, max);
        case 'ArrowRight':
        case 'ArrowDown':
            return clamp(current + step, min, max);
        case 'Home':
            return min;
        case 'End':
            return max;
        default:
            return null;
    }
}

export function loadWidth() {
    try {
        const raw = window.localStorage.getItem(WIDTH_KEY);
        if (raw === null || raw.trim() === '') return DEFAULT_LIST_WIDTH;
        const n = Number(raw);
        return Number.isFinite(n)
            ? clamp(n, MIN_LIST_WIDTH, MAX_LIST_WIDTH)
            : DEFAULT_LIST_WIDTH;
    } catch {
        return DEFAULT_LIST_WIDTH;
    }
}

export function saveWidth(width) {
    try {
        window.localStorage.setItem(WIDTH_KEY, String(Math.round(width)));
    } catch {
        // storage unavailable: width just won't persist
    }
}

export function clearWidth() {
    try {
        window.localStorage.removeItem(WIDTH_KEY);
    } catch {
        // ignore
    }
}

export function loadCollapsed() {
    try {
        return window.localStorage.getItem(COLLAPSED_KEY) === 'true';
    } catch {
        return false;
    }
}

export function saveCollapsed(collapsed) {
    try {
        window.localStorage.setItem(COLLAPSED_KEY, String(!!collapsed));
    } catch {
        // storage unavailable: state just won't persist
    }
}
