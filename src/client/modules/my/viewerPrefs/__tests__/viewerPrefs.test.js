import {
    STORAGE_KEY,
    DEFAULTS,
    getPrefs,
    setPrefs,
    resetPrefs,
    stepFontSize,
    resetFontSize,
    subscribe,
    sanitize,
    clampFontSize,
    lineHeightMultiplier,
    __resetForTests
} from '../viewerPrefs';

beforeEach(() => {
    window.localStorage.clear();
    __resetForTests();
});

describe('viewerPrefs defaults and validation', () => {
    it('returns defaults when nothing is stored', () => {
        expect(getPrefs()).toEqual(DEFAULTS);
    });

    it('sanitizes bad values per field and drops unknown keys', () => {
        expect(
            sanitize({
                fontSize: 99,
                tabWidth: 3,
                lineNumbers: 'yes',
                syntaxTheme: 'neon',
                lineHeight: 'huge',
                wordWrap: true,
                bogus: 1
            })
        ).toEqual({ ...DEFAULTS, wordWrap: true });
        expect(sanitize(null)).toEqual(DEFAULTS);
        expect(sanitize('x')).toEqual(DEFAULTS);
        expect(sanitize({ fontSize: 12.5 }).fontSize).toBe(DEFAULTS.fontSize);
    });

    it('clamps font sizes', () => {
        expect(clampFontSize(5)).toBe(11);
        expect(clampFontSize(50)).toBe(20);
        expect(clampFontSize(14.4)).toBe(14);
        expect(clampFontSize('abc')).toBe(DEFAULTS.fontSize);
    });

    it('maps line height names to multipliers', () => {
        expect(lineHeightMultiplier('compact')).toBeLessThan(
            lineHeightMultiplier('normal')
        );
        expect(lineHeightMultiplier('relaxed')).toBeGreaterThan(
            lineHeightMultiplier('normal')
        );
        expect(lineHeightMultiplier('nope')).toBe(
            lineHeightMultiplier('normal')
        );
    });
});

describe('viewerPrefs persistence', () => {
    it('persists with a version and reloads', () => {
        setPrefs({ fontSize: 16, syntaxTheme: 'paper' });
        const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
        expect(stored.v).toBe(1);
        expect(stored.prefs.fontSize).toBe(16);
        __resetForTests();
        expect(getPrefs().fontSize).toBe(16);
        expect(getPrefs().syntaxTheme).toBe('paper');
    });

    it('ignores corrupt JSON', () => {
        window.localStorage.setItem(STORAGE_KEY, '{nope');
        expect(getPrefs()).toEqual(DEFAULTS);
    });

    it('ignores other versions', () => {
        window.localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({ v: 99, prefs: { fontSize: 18 } })
        );
        expect(getPrefs()).toEqual(DEFAULTS);
    });

    it('validates stored values', () => {
        window.localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({ v: 1, prefs: { fontSize: 18, tabWidth: 7 } })
        );
        expect(getPrefs().fontSize).toBe(18);
        expect(getPrefs().tabWidth).toBe(4);
    });

    it('still works when storage throws', () => {
        const get = jest
            .spyOn(Storage.prototype, 'getItem')
            .mockImplementation(() => {
                throw new Error('blocked');
            });
        const set = jest
            .spyOn(Storage.prototype, 'setItem')
            .mockImplementation(() => {
                throw new Error('blocked');
            });
        expect(getPrefs()).toEqual(DEFAULTS);
        expect(setPrefs({ fontSize: 15 }).fontSize).toBe(15);
        expect(getPrefs().fontSize).toBe(15);
        get.mockRestore();
        set.mockRestore();
    });
});

describe('viewerPrefs updates', () => {
    it('merges patches and ignores invalid values', () => {
        setPrefs({ tabWidth: 8, fontSize: 500, nope: true });
        expect(getPrefs().tabWidth).toBe(8);
        expect(getPrefs().fontSize).toBe(DEFAULTS.fontSize);
        expect(getPrefs().nope).toBeUndefined();
    });

    it('steps font size within bounds', () => {
        stepFontSize(1);
        expect(getPrefs().fontSize).toBe(14);
        stepFontSize(100);
        expect(getPrefs().fontSize).toBe(20);
        stepFontSize(-100);
        expect(getPrefs().fontSize).toBe(11);
        resetFontSize();
        expect(getPrefs().fontSize).toBe(13);
    });

    it('resets everything', () => {
        setPrefs({ fontSize: 18, lineNumbers: false });
        resetPrefs();
        expect(getPrefs()).toEqual(DEFAULTS);
    });

    it('returns frozen objects', () => {
        expect(Object.isFrozen(getPrefs())).toBe(true);
    });
});

describe('viewerPrefs subscribers', () => {
    it('notifies on change but not on no-ops', () => {
        const fn = jest.fn();
        subscribe(fn);
        setPrefs({ fontSize: 15 });
        expect(fn).toHaveBeenCalledTimes(1);
        expect(fn.mock.calls[0][0].fontSize).toBe(15);
        setPrefs({ fontSize: 15 });
        setPrefs({ fontSize: 999 });
        expect(fn).toHaveBeenCalledTimes(1);
    });

    it('stops notifying after unsubscribe', () => {
        const fn = jest.fn();
        const off = subscribe(fn);
        off();
        setPrefs({ fontSize: 15 });
        expect(fn).not.toHaveBeenCalled();
    });

    it('isolates a throwing subscriber', () => {
        const bad = jest.fn(() => {
            throw new Error('x');
        });
        const good = jest.fn();
        subscribe(bad);
        subscribe(good);
        setPrefs({ wordWrap: true });
        expect(good).toHaveBeenCalledTimes(1);
    });

    it('is safe to unsubscribe during a notification', () => {
        const calls = [];
        const offA = subscribe(() => {
            calls.push('a');
            offA();
        });
        subscribe(() => calls.push('b'));
        setPrefs({ wordWrap: true });
        setPrefs({ wordWrap: false });
        expect(calls).toEqual(['a', 'b', 'b']);
    });

    it('picks up changes from other tabs via the storage event', () => {
        const fn = jest.fn();
        subscribe(fn);
        window.localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({ v: 1, prefs: { fontSize: 19 } })
        );
        window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY }));
        expect(getPrefs().fontSize).toBe(19);
        expect(fn).toHaveBeenCalledTimes(1);
        window.dispatchEvent(new StorageEvent('storage', { key: 'other' }));
        expect(fn).toHaveBeenCalledTimes(1);
    });
});
