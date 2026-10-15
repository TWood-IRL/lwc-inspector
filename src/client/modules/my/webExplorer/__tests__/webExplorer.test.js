import { createElement } from 'lwc';
import WebExplorer from 'my/webExplorer';

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
    });
});
