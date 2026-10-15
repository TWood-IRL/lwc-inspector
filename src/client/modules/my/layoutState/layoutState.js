// Pure helpers for the workspace layout (tree/source split, collapse state).
export const WIDTH_KEY = 'lwci-tree-width';
export const COLLAPSED_KEY = 'lwci-tree-collapsed';
export const DEFAULT_TREE_WIDTH = 288;
export const MIN_TREE_WIDTH = 200;
export const MAX_TREE_WIDTH = 640;
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

// Widest the tree may be, leaving room for the source pane.
export function maxTreeWidth(containerWidth) {
    if (!Number.isFinite(containerWidth) || containerWidth <= 0) {
        return MAX_TREE_WIDTH;
    }
    return clamp(
        containerWidth - MIN_SOURCE_WIDTH - SPLITTER_WIDTH,
        MIN_TREE_WIDTH,
        MAX_TREE_WIDTH
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
        if (raw === null || raw.trim() === '') return DEFAULT_TREE_WIDTH;
        const n = Number(raw);
        return Number.isFinite(n)
            ? clamp(n, MIN_TREE_WIDTH, MAX_TREE_WIDTH)
            : DEFAULT_TREE_WIDTH;
    } catch {
        return DEFAULT_TREE_WIDTH;
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
