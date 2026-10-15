import {
    STORAGE_KEY,
    applyTheme,
    getStoredTheme,
    nextTheme,
    resolveTheme,
    storeTheme,
    watchSystemTheme
} from 'my/theme';

let listeners;
let systemDark;

const mockMatchMedia = () => {
    listeners = [];
    window.matchMedia = jest.fn(() => ({
        get matches() {
            return systemDark;
        },
        addEventListener: (_, fn) => listeners.push(fn),
        removeEventListener: (_, fn) => {
            listeners = listeners.filter((l) => l !== fn);
        }
    }));
};

describe('my/theme', () => {
    beforeEach(() => {
        systemDark = false;
        window.localStorage.clear();
        document.head.innerHTML = '<meta name="theme-color" content="#000">';
        document.documentElement.removeAttribute('data-theme');
        mockMatchMedia();
    });

    it('follows the system preference when nothing is stored', () => {
        expect(resolveTheme()).toBe('light');
        systemDark = true;
        expect(resolveTheme()).toBe('dark');
    });

    it('prefers a stored choice over the system preference', () => {
        systemDark = true;
        storeTheme('light');
        expect(window.localStorage.getItem(STORAGE_KEY)).toBe('light');
        expect(resolveTheme()).toBe('light');
    });

    it('ignores invalid stored values', () => {
        window.localStorage.setItem(STORAGE_KEY, 'purple');
        expect(getStoredTheme()).toBeNull();
    });

    it('survives unavailable storage', () => {
        const spy = jest
            .spyOn(Storage.prototype, 'getItem')
            .mockImplementation(() => {
                throw new Error('blocked');
            });
        const setSpy = jest
            .spyOn(Storage.prototype, 'setItem')
            .mockImplementation(() => {
                throw new Error('blocked');
            });
        expect(getStoredTheme()).toBeNull();
        expect(() => storeTheme('dark')).not.toThrow();
        spy.mockRestore();
        setSpy.mockRestore();
    });

    it('applies the theme to <html> and theme-color meta', () => {
        applyTheme('dark');
        expect(document.documentElement.getAttribute('data-theme')).toBe(
            'dark'
        );
        expect(
            document
                .querySelector('meta[name="theme-color"]')
                .getAttribute('content')
        ).toBe('#014486');
        applyTheme('light');
        expect(
            document
                .querySelector('meta[name="theme-color"]')
                .getAttribute('content')
        ).toBe('#0176d3');
    });

    it('toggles between themes', () => {
        expect(nextTheme('light')).toBe('dark');
        expect(nextTheme('dark')).toBe('light');
    });

    it('notifies system changes only without an explicit choice', () => {
        const onChange = jest.fn();
        const unwatch = watchSystemTheme(onChange);
        systemDark = true;
        listeners.forEach((l) => l());
        expect(onChange).toHaveBeenCalledWith('dark');

        onChange.mockClear();
        storeTheme('light');
        listeners.forEach((l) => l());
        expect(onChange).not.toHaveBeenCalled();

        unwatch();
        expect(listeners).toHaveLength(0);
    });
});
