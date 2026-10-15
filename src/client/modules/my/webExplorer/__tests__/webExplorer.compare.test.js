import { createElement } from 'lwc';
import WebExplorer from 'my/webExplorer';
import { clearCache } from 'data/dataService';

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

const bundle = (name, idx) => ({
    id: `0Rb00000000000${idx}`,
    label: name,
    name: idx,
    items: [],
    expanded: false,
    IsExposed: true
});

const filesFor = (id) => {
    const n = id.endsWith('0') ? 'one' : 'two';
    return [
        {
            id: `${id}-js`,
            name: `${id}-js`,
            label: `lwc/${n}/${n}.js`,
            Source: n === 'one' ? 'a\nb' : 'a\nc',
            Format: 'js'
        },
        {
            id: `${id}-html`,
            name: `${id}-html`,
            label: `lwc/${n}/${n}.html`,
            Source: '<p></p>',
            Format: 'html'
        }
    ];
};

describe('my-web-explorer compare', () => {
    beforeEach(() => {
        clearCache();
        window.history.replaceState(null, '', '/');
        global.fetch = jest.fn((url) =>
            Promise.resolve({
                ok: true,
                json: () =>
                    Promise.resolve({
                        data: url.includes('/api/LightningComponent/')
                            ? filesFor(url.split('/').pop())
                            : [bundle('one', 0), bundle('two', 1)]
                    })
            })
        );
    });
    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
        delete global.fetch;
    });

    // Selecting a component opens its first file (the template)
    const selectComponent = async (element, index) => {
        element.shadowRoot.querySelectorAll('button.component')[index].click();
        await flushPromises();
        await flushPromises();
    };
    const openJsTab = async (element) => {
        const tab = [...element.shadowRoot.querySelectorAll('button.tab')].find(
            (el) => el.textContent.trim().endsWith('.js')
        );
        tab.click();
        await flushPromises();
    };

    it('opens the diff in place of the viewer and exits back', async () => {
        const element = createElement('my-web-explorer', { is: WebExplorer });
        document.body.appendChild(element);
        await flushPromises();
        await selectComponent(element, 0);
        await openJsTab(element);

        const root = element.shadowRoot;
        expect(root.querySelector('my-code-viewer')).not.toBeNull();
        expect(root.querySelector('my-diff-view')).toBeNull();

        root.querySelector('.compare-button').click();
        await flushPromises();
        expect(root.querySelector('my-code-viewer')).toBeNull();
        const diff = root.querySelector('my-diff-view');
        expect(diff).not.toBeNull();
        expect(diff.files.map((f) => f.bundle)).toContain('one');
        expect(diff.initialLeft).toBe('0Rb000000000000-js');

        diff.dispatchEvent(new CustomEvent('exit'));
        await flushPromises();
        expect(root.querySelector('my-diff-view')).toBeNull();
        expect(root.querySelector('my-code-viewer')).not.toBeNull();
    });

    it('leaves compare when another tab is chosen', async () => {
        const element = createElement('my-web-explorer', { is: WebExplorer });
        document.body.appendChild(element);
        await flushPromises();
        await selectComponent(element, 0);
        await openJsTab(element);
        const root = element.shadowRoot;
        root.querySelector('.compare-button').click();
        await flushPromises();
        root.querySelectorAll('button.tab')[1].click();
        await flushPromises();
        expect(root.querySelector('my-diff-view')).toBeNull();
        expect(root.querySelector('my-code-viewer')).not.toBeNull();
    });
});
