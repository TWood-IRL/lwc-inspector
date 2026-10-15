import { createElement } from 'lwc';
import WebExplorer from 'my/webExplorer';
import { clearCache } from 'data/dataService';

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

const mockBundles = (data) => {
    global.fetch = jest.fn(() =>
        Promise.resolve({ ok: true, json: () => Promise.resolve({ data }) })
    );
};

const bundle = (name, idx) => ({
    id: `0Rb00000000000${idx}`,
    label: name,
    name: idx,
    items: [],
    expanded: false,
    IsExposed: true
});

describe('my-web-explorer', () => {
    beforeEach(() => clearCache());
    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
        delete global.fetch;
    });

    const create = async () => {
        const element = createElement('my-web-explorer', { is: WebExplorer });
        document.body.appendChild(element);
        await flushPromises();
        return element;
    };

    it('shows an empty state when the org has no components', async () => {
        mockBundles([]);

        const element = await create();

        expect(
            element.shadowRoot.querySelector('.empty-title').textContent
        ).toBe('No components found');
        expect(element.shadowRoot.querySelector('.component-list')).toBeNull();
    });

    it('lists the components with a count when they load', async () => {
        mockBundles([bundle('accountCard', 0), bundle('caseTimeline', 1)]);

        const element = await create();

        expect(
            element.shadowRoot.querySelector('.list-header').textContent
        ).toBe('Components (2)');
        expect(
            [...element.shadowRoot.querySelectorAll('button.component')].map(
                (button) => button.textContent.trim()
            )
        ).toEqual(['accountCard', 'caseTimeline']);
        expect(
            element.shadowRoot.querySelector('.empty-title').textContent
        ).toBe('No component selected');
    });

    it('searches when Enter is pressed in the search box', async () => {
        mockBundles([bundle('accountCard', 0)]);
        const element = await create();
        global.fetch.mockClear();

        const input = element.shadowRoot.querySelector('lightning-input');
        input.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter' }));
        await flushPromises();

        expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    describe('deep links and recents', () => {
        const files = [
            {
                id: 'f1',
                name: 'f1',
                label: 'lwc/accountCard/accountCard.js',
                Source: 'a',
                Format: 'js'
            },
            {
                id: 'f2',
                name: 'f2',
                label: 'lwc/accountCard/accountCard.html',
                Source: 'b',
                Format: 'html'
            }
        ];
        const mockApi = (data) => {
            global.fetch = jest.fn((url) =>
                Promise.resolve({
                    ok: true,
                    json: () =>
                        Promise.resolve({
                            data: url.includes('/api/LightningComponent/')
                                ? files
                                : data
                        })
                })
            );
        };
        const toasts = [];
        const listen = (element) =>
            element.addEventListener('toastfired', (e) =>
                toasts.push(e.detail)
            );

        beforeEach(() => {
            toasts.length = 0;
            localStorage.clear();
            window.history.replaceState(null, '', '/');
        });

        it('restores the selection from the hash on load', async () => {
            mockApi([bundle('accountCard', 0)]);
            window.history.replaceState(
                null,
                '',
                '/#/lwc/accountCard/accountCard.html'
            );

            const element = await create();
            await flushPromises();

            const viewer = element.shadowRoot.querySelector('my-code-viewer');
            expect(viewer.code).toBe('b');
            expect(
                element.shadowRoot.querySelector(
                    'c-recent-chips, my-recent-chips'
                )
            ).not.toBeNull();
        });

        it('toasts and degrades when the component is unknown', async () => {
            mockApi([bundle('accountCard', 0)]);
            window.history.replaceState(null, '', '/#/lwc/missing');
            const element = createElement('my-web-explorer', {
                is: WebExplorer
            });
            listen(element);
            document.body.appendChild(element);
            await flushPromises();
            await flushPromises();

            expect(toasts.some((t) => t.title === 'Component not found')).toBe(
                true
            );
            expect(
                element.shadowRoot.querySelector('.component-list')
            ).not.toBeNull();
        });

        it('updates the hash and recents when a component is picked', async () => {
            mockApi([bundle('accountCard', 0)]);
            const element = await create();

            element.shadowRoot.querySelector('button.component').click();
            await flushPromises();
            await flushPromises();

            // the first file (the template) opens, and the URL says so
            expect(window.location.hash).toBe(
                '#/lwc/accountCard/accountCard.html'
            );
            expect(
                element.shadowRoot.querySelectorAll('button.tab')
            ).toHaveLength(2);
            expect(
                JSON.parse(localStorage.getItem('lwci.recents')).items[0].name
            ).toBe('accountCard');
        });

        it('reacts to hashchange', async () => {
            mockApi([bundle('accountCard', 0)]);
            const element = await create();

            window.history.replaceState(
                null,
                '',
                '/#/lwc/accountCard/accountCard.js'
            );
            window.dispatchEvent(new HashChangeEvent('hashchange'));
            await flushPromises();
            await flushPromises();

            expect(
                element.shadowRoot.querySelector('my-code-viewer').code
            ).toBe('a');
        });

        describe('command palette bridge', () => {
            it('answers lwci:palette-request with bundles and open files', async () => {
                mockApi([bundle('accountCard', 0), bundle('caseTimeline', 1)]);
                window.history.replaceState(
                    null,
                    '',
                    '/#/lwc/accountCard/accountCard.html'
                );
                const element = await create();
                await flushPromises();
                const respond = jest.fn();

                document.dispatchEvent(
                    new CustomEvent('lwci:palette-request', {
                        detail: { respond }
                    })
                );

                expect(respond).toHaveBeenCalledWith({
                    bundles: [
                        { label: 'accountCard', type: 'lwcComps' },
                        { label: 'caseTimeline', type: 'lwcComps' }
                    ],
                    files: [
                        {
                            type: 'lwcComps',
                            bundle: 'accountCard',
                            file: 'accountCard.html'
                        },
                        {
                            type: 'lwcComps',
                            bundle: 'accountCard',
                            file: 'accountCard.js'
                        }
                    ],
                    canCopySource: true
                });
                document.body.removeChild(element);
            });

            it('opens a target on lwci:open-target', async () => {
                mockApi([bundle('accountCard', 0)]);
                const element = await create();

                document.dispatchEvent(
                    new CustomEvent('lwci:open-target', {
                        detail: {
                            type: 'lwcComps',
                            bundle: 'accountCard',
                            file: 'accountCard.html'
                        }
                    })
                );
                await flushPromises();
                await flushPromises();

                expect(
                    element.shadowRoot.querySelector('my-code-viewer').code
                ).toBe('b');
            });
        });
    });
});

describe('my-web-explorer data loading', () => {
    beforeEach(() => {
        clearCache();
        Object.defineProperty(navigator, 'onLine', {
            value: true,
            configurable: true
        });
    });
    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
        delete global.fetch;
    });

    const make = () => {
        const element = createElement('my-web-explorer', { is: WebExplorer });
        document.body.appendChild(element);
        return element;
    };
    const failing = (status) => {
        global.fetch = jest.fn(() =>
            Promise.resolve({
                ok: false,
                status,
                json: () => Promise.resolve({})
            })
        );
    };

    it('shows skeleton loaders until the first load finishes', async () => {
        let resolve;
        global.fetch = jest.fn(
            () =>
                new Promise((r) => {
                    resolve = r;
                })
        );

        const element = make();
        await Promise.resolve();

        expect(element.shadowRoot.querySelectorAll('my-skeleton').length).toBe(
            2
        );
        expect(element.shadowRoot.querySelector('.component-list')).toBeNull();

        resolve({
            ok: true,
            json: () => Promise.resolve({ data: [bundle('a', 0)] })
        });
        await flushPromises();

        expect(element.shadowRoot.querySelector('my-skeleton')).toBeNull();
        expect(
            element.shadowRoot.querySelector('.component-list')
        ).not.toBeNull();
    });

    it('shows an error state with Retry that reloads, instead of only a toast', async () => {
        failing(404);
        const element = make();
        await flushPromises();

        const error = element.shadowRoot.querySelector('my-error-state');
        expect(error).not.toBeNull();
        expect(error.message).toBe('Request failed (404)');
        expect(element.shadowRoot.querySelector('my-skeleton')).toBeNull();

        mockBundles([bundle('a', 0)]);
        error.dispatchEvent(new CustomEvent('retry'));
        await flushPromises();

        expect(element.shadowRoot.querySelector('my-error-state')).toBeNull();
        expect(
            element.shadowRoot.querySelector('.component-list')
        ).not.toBeNull();
    });

    it('shows the freshness label and refresh bypasses the cache', async () => {
        mockBundles([bundle('a', 0)]);
        const element = make();
        await flushPromises();

        expect(element.shadowRoot.querySelector('.freshness').textContent).toBe(
            'Updated just now'
        );

        mockBundles([bundle('a', 0), bundle('b', 1)]);
        element.shadowRoot.querySelector('.refresh-button').click();
        await flushPromises();

        expect(global.fetch).toHaveBeenCalledTimes(1); // the new mock
        expect(
            element.shadowRoot.querySelector('.list-header').textContent
        ).toBe('Components (2)');
    });

    it('serves a second mount from cache without a request', async () => {
        mockBundles([bundle('a', 0)]);
        make();
        await flushPromises();
        const second = make();
        await flushPromises();

        expect(global.fetch).toHaveBeenCalledTimes(1);
        expect(
            second.shadowRoot.querySelector('.component-list')
        ).not.toBeNull();
    });

    it('shows an offline banner and hides it when back online', async () => {
        mockBundles([bundle('a', 0)]);
        const element = make();
        await flushPromises();
        expect(element.shadowRoot.querySelector('.offline-banner')).toBeNull();

        window.dispatchEvent(new CustomEvent('offline'));
        await Promise.resolve();
        expect(
            element.shadowRoot.querySelector('.offline-banner')
        ).not.toBeNull();
        // cached data stays browsable
        expect(
            element.shadowRoot.querySelector('.component-list')
        ).not.toBeNull();

        window.dispatchEvent(new CustomEvent('online'));
        await Promise.resolve();
        expect(element.shadowRoot.querySelector('.offline-banner')).toBeNull();
    });

    it('starts with the banner when the page loads offline', async () => {
        Object.defineProperty(navigator, 'onLine', { value: false });
        mockBundles([bundle('a', 0)]);
        const element = make();
        await flushPromises();

        expect(
            element.shadowRoot.querySelector('.offline-banner')
        ).not.toBeNull();
    });

    it('retries automatically when connectivity returns after a failed load', async () => {
        failing(404);
        const element = make();
        await flushPromises();
        expect(
            element.shadowRoot.querySelector('my-error-state')
        ).not.toBeNull();

        mockBundles([bundle('a', 0)]);
        window.dispatchEvent(new CustomEvent('online'));
        await flushPromises();

        expect(
            element.shadowRoot.querySelector('.component-list')
        ).not.toBeNull();
    });
});
