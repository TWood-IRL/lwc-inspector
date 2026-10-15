// Theme helpers. The inline script in index.html applies the initial theme
// before first paint; keep the storage key and logic in sync with it.
export const STORAGE_KEY = 'lwci-theme';
export const THEME_COLORS = { light: '#0176d3', dark: '#014486' };

export function getStoredTheme() {
    try {
        const value = window.localStorage.getItem(STORAGE_KEY);
        return value === 'light' || value === 'dark' ? value : null;
    } catch {
        return null;
    }
}

export function storeTheme(theme) {
    try {
        window.localStorage.setItem(STORAGE_KEY, theme);
    } catch {
        // storage unavailable (private mode, blocked): choice just won't persist
    }
}

export function getSystemTheme() {
    return window.matchMedia &&
        window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
}

export function resolveTheme() {
    return getStoredTheme() || getSystemTheme();
}

export function applyTheme(theme) {
    const root = document.documentElement;
    root.setAttribute('data-theme', theme);
    root.style.colorScheme = theme;
    // eslint-disable-next-line @lwc/lwc/no-document-query
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
        meta.setAttribute('content', THEME_COLORS[theme]);
    }
}

export function nextTheme(theme) {
    return theme === 'dark' ? 'light' : 'dark';
}

// Calls onChange(theme) when the OS theme changes and the user has no
// explicit choice. Returns an unsubscribe function.
export function watchSystemTheme(onChange) {
    if (!window.matchMedia) {
        return () => {};
    }
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
        if (!getStoredTheme()) {
            onChange(getSystemTheme());
        }
    };
    if (mql.addEventListener) {
        mql.addEventListener('change', handler);
        return () => mql.removeEventListener('change', handler);
    }
    mql.addListener(handler);
    return () => mql.removeListener(handler);
}
