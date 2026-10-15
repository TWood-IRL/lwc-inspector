import { createElement } from 'lwc';
import WebExplorer from 'my/webExplorer';

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

const mockBundles = (count = 2) => {
    const data = Array.from({ length: count }, (_, idx) => ({
        id: `0Rb00000000000${idx}`,
        label: `comp${idx}`,
        name: idx,
        items: [],
        expanded: false,
        IsExposed: true
    }));
    global.fetch = jest.fn(() =>
        Promise.resolve({ ok: true, json: () => Promise.resolve({ data }) })
    );
};

const mockMatchMedia = (matches) => {
    const listeners = [];
    window.matchMedia = jest.fn(() => ({
        matches,
        addEventListener: (_, fn) => listeners.push(fn),
        removeEventListener: (_, fn) => {
            const i = listeners.indexOf(fn);
            if (i >= 0) listeners.splice(i, 1);
        }
    }));
    return listeners;
};

describe('my-web-explorer workspace layout', () => {
    let element;

    const create = async () => {
        element = createElement('my-web-explorer', { is: WebExplorer });
        document.body.appendChild(element);
        await flushPromises();
        return element;
    };
    const $ = (sel) => element.shadowRoot.querySelector(sel);
    const listPane = () => $('.pane-list');
    const toggleButton = () => $('button[aria-expanded]');
    const focusButton = () => $('button[aria-pressed]');

    beforeEach(() => {
        window.localStorage.clear();
        window.history.replaceState(null, '', '/');
        mockBundles();
    });

    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
        delete global.fetch;
        delete window.matchMedia;
        jest.restoreAllMocks();
    });

    describe('splitter', () => {
        it('renders with the default width', async () => {
            await create();
            const splitter = $('my-splitter');
            expect(splitter).not.toBeNull();
            expect(splitter.value).toBe(288);
            expect(listPane().getAttribute('style')).toContain('288px');
        });

        it('restores a persisted width', async () => {
            window.localStorage.setItem('lwci-tree-width', '400');
            await create();
            expect($('my-splitter').value).toBe(400);
        });

        it('resizes and persists only on the final event', async () => {
            await create();
            const splitter = $('my-splitter');
            splitter.dispatchEvent(
                new CustomEvent('resize', {
                    detail: { value: 350, final: false }
                })
            );
            await flushPromises();
            expect(listPane().getAttribute('style')).toContain('350px');
            expect(listPane().className).toContain('pane-list-resizing');
            expect(window.localStorage.getItem('lwci-tree-width')).toBeNull();

            splitter.dispatchEvent(
                new CustomEvent('resize', {
                    detail: { value: 360, final: true }
                })
            );
            await flushPromises();
            expect(listPane().className).not.toContain('pane-list-resizing');
            expect(window.localStorage.getItem('lwci-tree-width')).toBe('360');
        });

        it('clamps to the minimum width', async () => {
            await create();
            $('my-splitter').dispatchEvent(
                new CustomEvent('resize', {
                    detail: { value: 10, final: true }
                })
            );
            await flushPromises();
            expect(listPane().getAttribute('style')).toContain('200px');
        });

        it('resets to the default on double click', async () => {
            window.localStorage.setItem('lwci-tree-width', '400');
            await create();
            $('my-splitter').dispatchEvent(new CustomEvent('reset'));
            await flushPromises();
            expect($('my-splitter').value).toBe(288);
            expect(window.localStorage.getItem('lwci-tree-width')).toBeNull();
        });

        it('is removed in the stacked (mobile) layout', async () => {
            mockMatchMedia(true);
            await create();
            expect($('my-splitter')).toBeNull();
            expect(toggleButton()).toBeNull();
            expect(listPane().getAttribute('style') || '').toBe('');
        });

        it('reacts when the layout becomes stacked', async () => {
            const listeners = mockMatchMedia(false);
            await create();
            expect($('my-splitter')).not.toBeNull();
            listeners.forEach((fn) => fn({ matches: true }));
            await flushPromises();
            expect($('my-splitter')).toBeNull();
        });
    });

    describe('list collapse', () => {
        it('starts expanded', async () => {
            await create();
            expect(toggleButton().getAttribute('aria-expanded')).toBe('true');
            expect(listPane().className).not.toContain('pane-list-hidden');
        });

        it('collapses, hides the splitter and persists', async () => {
            await create();
            toggleButton().click();
            await flushPromises();
            expect(toggleButton().getAttribute('aria-expanded')).toBe('false');
            expect(toggleButton().getAttribute('aria-label')).toBe(
                'Show component list'
            );
            expect(listPane().className).toContain('pane-list-hidden');
            expect(listPane().getAttribute('style')).toContain('0px');
            expect($('my-splitter')).toBeNull();
            expect(window.localStorage.getItem('lwci-tree-collapsed')).toBe(
                'true'
            );
        });

        it('expands again', async () => {
            await create();
            toggleButton().click();
            await flushPromises();
            toggleButton().click();
            await flushPromises();
            expect(listPane().className).not.toContain('pane-list-hidden');
            expect(listPane().getAttribute('style')).toContain('288px');
            expect(window.localStorage.getItem('lwci-tree-collapsed')).toBe(
                'false'
            );
        });

        it('restores a persisted collapsed state', async () => {
            window.localStorage.setItem('lwci-tree-collapsed', 'true');
            await create();
            expect(listPane().className).toContain('pane-list-hidden');
        });

        it('works when storage throws', async () => {
            jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
                throw new Error('blocked');
            });
            jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
                throw new Error('blocked');
            });
            await create();
            toggleButton().click();
            await flushPromises();
            expect(listPane().className).toContain('pane-list-hidden');
        });
    });

    describe('focus mode', () => {
        const root = document.documentElement;

        afterEach(() => root.removeAttribute('data-focus'));

        it('toggles via the button', async () => {
            await create();
            focusButton().click();
            await flushPromises();
            expect(root.getAttribute('data-focus')).toBe('true');
            expect($('section').className).toContain('explorer-focus');
            expect(focusButton().textContent.trim()).toBe('Exit focus');
            expect(focusButton().getAttribute('aria-pressed')).toBe('true');
            expect(listPane().className).toContain('pane-list-hidden');
            expect($('my-splitter')).toBeNull();
            expect(toggleButton()).toBeNull();

            focusButton().click();
            await flushPromises();
            expect(root.hasAttribute('data-focus')).toBe(false);
            expect(listPane().className).not.toContain('pane-list-hidden');
        });

        it('toggles via the lwci:toggle-focus event', async () => {
            await create();
            document.dispatchEvent(new CustomEvent('lwci:toggle-focus'));
            await flushPromises();
            expect(root.getAttribute('data-focus')).toBe('true');
            document.dispatchEvent(new CustomEvent('lwci:toggle-focus'));
            await flushPromises();
            expect(root.hasAttribute('data-focus')).toBe(false);
        });

        it('exits on Escape', async () => {
            await create();
            focusButton().click();
            await flushPromises();
            document.dispatchEvent(
                new KeyboardEvent('keydown', { key: 'Escape' })
            );
            await flushPromises();
            expect(root.hasAttribute('data-focus')).toBe(false);
        });

        it('ignores Escape that was already handled', async () => {
            await create();
            focusButton().click();
            await flushPromises();
            const early = (e) => e.preventDefault();
            window.addEventListener('keydown', early, {
                capture: true,
                once: true
            });
            document.dispatchEvent(
                new KeyboardEvent('keydown', {
                    key: 'Escape',
                    cancelable: true
                })
            );
            await flushPromises();
            expect(root.getAttribute('data-focus')).toBe('true');
        });

        it('does not touch the persisted collapse state', async () => {
            await create();
            focusButton().click();
            await flushPromises();
            expect(
                window.localStorage.getItem('lwci-tree-collapsed')
            ).toBeNull();
        });

        it('clears the attribute when disconnected', async () => {
            await create();
            focusButton().click();
            await flushPromises();
            document.body.removeChild(element);
            expect(root.hasAttribute('data-focus')).toBe(false);
        });

        it('stops listening after disconnect', async () => {
            await create();
            document.body.removeChild(element);
            document.dispatchEvent(new CustomEvent('lwci:toggle-focus'));
            expect(root.hasAttribute('data-focus')).toBe(false);
        });
    });
});
