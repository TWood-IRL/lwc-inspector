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
        expect(element.shadowRoot.querySelector('c-tree')).toBeNull();
    });

    it('shows the tree with a component count when components load', async () => {
        mockBundles([bundle('accountCard', 0), bundle('caseTimeline', 1)]);

        const element = await create();

        const tree = element.shadowRoot.querySelector('c-tree');
        expect(tree).not.toBeNull();
        expect(tree.header).toBe('Components (2)');
        expect(
            element.shadowRoot.querySelector('.empty-title').textContent
        ).toBe('No file selected');
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
});
