import { createElement } from 'lwc';
import WebExplorer from 'my/webExplorer';
import { clearCache } from 'data/dataService';

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

const bundle = (label, idx, IsExposed = true) => ({
    id: `0Rb00000000000${idx}`,
    label,
    name: idx,
    items: [],
    IsExposed
});

const file = (label, Source, Format) => ({
    id: label,
    name: label,
    label,
    Source,
    Format
});

// Unsorted on purpose: the explorer decides the reading order
const FILES = [
    file('lwc/accountCard/accountCard.js-meta.xml', '<meta/>', 'xml'),
    file('lwc/accountCard/accountCard.js', 'let js;', 'js'),
    file('lwc/accountCard/accountCard.css', ':host{}', 'css'),
    file('lwc/accountCard/accountCard.html', '<template/>', 'html')
];

const mockApi = (bundles, files = FILES) => {
    global.fetch = jest.fn((url) =>
        Promise.resolve({
            ok: true,
            json: () =>
                Promise.resolve({
                    data: url.includes('/api/LightningComponent/')
                        ? files
                        : bundles
                })
        })
    );
};

describe('my-web-explorer flat component list', () => {
    beforeEach(() => {
        // the data layer caches lists and files between tests otherwise
        clearCache();
        localStorage.clear();
        window.history.replaceState(null, '', '/');
    });
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
    const listButtons = (element) =>
        element.shadowRoot.querySelectorAll('button.component');
    const select = async (element, index = 0) => {
        listButtons(element)[index].click();
        await flushPromises();
        await flushPromises();
    };
    const tabLabels = (element) =>
        [...element.shadowRoot.querySelectorAll('.tab')].map((tab) =>
            tab.textContent.trim()
        );
    const viewer = (element) =>
        element.shadowRoot.querySelector('my-code-viewer');

    it('opens the first file in reading order when a component is selected', async () => {
        mockApi([bundle('accountCard', 0)]);
        const element = await create();

        await select(element);

        expect(viewer(element).code).toBe('<template/>');
        expect(tabLabels(element)).toEqual([
            'accountCard.html',
            'accountCard.js',
            'accountCard.css',
            'accountCard.js-meta.xml'
        ]);
        expect(listButtons(element)[0].className).toContain('component-active');
    });

    it('switches file when a tab is clicked', async () => {
        mockApi([bundle('accountCard', 0)]);
        const element = await create();
        await select(element);

        element.shadowRoot.querySelectorAll('.tab')[1].click();
        await flushPromises();

        expect(viewer(element).code).toBe('let js;');
        expect(window.location.hash).toBe('#/lwc/accountCard/accountCard.js');
    });

    it('loads a component once and reuses it', async () => {
        mockApi([bundle('a', 0), bundle('b', 1)]);
        const element = await create();
        global.fetch.mockClear();

        await select(element, 0);
        await select(element, 1);
        await select(element, 0);

        expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('does not open managed components', async () => {
        mockApi([bundle('managedThing', 0, false)]);
        const element = await create();
        const toasts = [];
        element.addEventListener('toastfired', (e) => toasts.push(e.detail));
        global.fetch.mockClear();

        await select(element);

        expect(global.fetch).not.toHaveBeenCalled();
        expect(toasts[0].title).toBe('Managed Component');
        expect(viewer(element)).toBeNull();
        expect(
            element.shadowRoot.querySelector('.component-badge').textContent
        ).toBe('Managed');
    });

    it('shows the empty-file case as a file, not as nothing selected', async () => {
        mockApi(
            [bundle('accountCard', 0)],
            [file('lwc/accountCard/accountCard.css', '', 'css')]
        );
        const element = await create();

        await select(element);

        expect(viewer(element)).not.toBeNull();
        expect(viewer(element).code).toBe('');
    });

    it('does not let a slow response open the wrong component', async () => {
        const slow = [];
        global.fetch = jest.fn((url) => {
            if (!url.includes('/api/LightningComponent/')) {
                return Promise.resolve({
                    ok: true,
                    json: () =>
                        Promise.resolve({
                            data: [bundle('a', 0), bundle('b', 1)]
                        })
                });
            }
            return new Promise((resolve) => {
                slow.push(() =>
                    resolve({
                        ok: true,
                        json: () =>
                            Promise.resolve({
                                data: [
                                    file(
                                        `lwc/${url.slice(-1)}/x.js`,
                                        url.slice(-1),
                                        'js'
                                    )
                                ]
                            })
                    })
                );
            });
        });
        const element = await create();

        listButtons(element)[0].click();
        await flushPromises();
        listButtons(element)[1].click();
        await flushPromises();
        slow.forEach((resolve) => resolve());
        await flushPromises();
        await flushPromises();

        expect(listButtons(element)[1].className).toContain('component-active');
        expect(listButtons(element)[0].className).not.toContain(
            'component-active'
        );
    });

    describe('tab keyboard navigation', () => {
        const press = async (element, key) => {
            element.shadowRoot
                .querySelector('.tab-active')
                .dispatchEvent(
                    new KeyboardEvent('keydown', { key, bubbles: true })
                );
            await flushPromises();
        };
        const active = (element) =>
            element.shadowRoot.querySelector('.tab-active').textContent.trim();

        it('moves with the arrow keys, Home and End, wrapping around', async () => {
            mockApi([bundle('accountCard', 0)]);
            const element = await create();
            await select(element);
            expect(active(element)).toBe('accountCard.html');

            await press(element, 'ArrowRight');
            expect(active(element)).toBe('accountCard.js');
            await press(element, 'End');
            expect(active(element)).toBe('accountCard.js-meta.xml');
            await press(element, 'ArrowRight');
            expect(active(element)).toBe('accountCard.html');
            await press(element, 'ArrowLeft');
            expect(active(element)).toBe('accountCard.js-meta.xml');
            await press(element, 'Home');
            expect(active(element)).toBe('accountCard.html');
        });

        it('exposes real tab semantics with only the open tab in the tab order', async () => {
            mockApi([bundle('accountCard', 0)]);
            const element = await create();
            await select(element);

            const tabs = [...element.shadowRoot.querySelectorAll('.tab')];
            expect(
                element.shadowRoot.querySelector('.tabs').getAttribute('role')
            ).toBe('tablist');
            expect(tabs.map((tab) => tab.getAttribute('role'))).toEqual(
                tabs.map(() => 'tab')
            );
            expect(tabs.map((tab) => tab.tabIndex)).toEqual([0, -1, -1, -1]);
            expect(tabs[0].getAttribute('aria-selected')).toBe('true');
        });
    });

    describe('copy and download', () => {
        const buttonByText = (element, text) =>
            [...element.shadowRoot.querySelectorAll('.editor-button')].find(
                (button) => button.textContent.trim().startsWith(text)
            );

        it('copies the whole file when nothing is selected', async () => {
            mockApi([bundle('accountCard', 0)]);
            Object.assign(navigator, {
                clipboard: { writeText: jest.fn(() => Promise.resolve()) }
            });
            const element = await create();
            await select(element);
            viewer(element).getSelectedText = () => '';

            buttonByText(element, 'Copy').click();
            await flushPromises();

            expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
                '<template/>'
            );
        });

        it('copies just the selected text when there is a selection', async () => {
            mockApi([bundle('accountCard', 0)]);
            const writeText = jest.fn(() => Promise.resolve());
            Object.assign(navigator, { clipboard: { writeText } });
            const element = await create();
            await select(element);
            viewer(element).getSelectedText = () => 'template';
            const toasts = [];
            element.addEventListener('toastfired', (e) =>
                toasts.push(e.detail)
            );

            buttonByText(element, 'Copy').click();
            await flushPromises();

            expect(writeText).toHaveBeenCalledWith('template');
            expect(toasts[0].title).toBe('Copied selection');
        });

        it('offers a download for just the open file', async () => {
            mockApi([bundle('accountCard', 0)]);
            const element = await create();
            await select(element);

            expect(buttonByText(element, 'Download file')).toBeTruthy();
            expect(buttonByText(element, 'Download .zip')).toBeTruthy();
        });
    });
});
