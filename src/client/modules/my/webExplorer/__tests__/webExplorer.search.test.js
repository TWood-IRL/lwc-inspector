import { createElement } from 'lwc';
import WebExplorer from 'my/webExplorer';
import { clearCache } from 'data/dataService';

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

const bundle = (label, idx) => ({
    id: `0Rb00000000000${idx}`,
    label,
    name: idx,
    items: [],
    IsExposed: true
});
const ALL = [
    bundle('accountCard', 0),
    bundle('contactList', 1),
    bundle('accountForm', 2)
];
const FILES = [
    {
        id: 'f',
        name: 'f',
        label: 'lwc/accountCard/accountCard.js',
        Source: 'let js;',
        Format: 'js'
    }
];

// Search results are filtered by the q parameter, like the real endpoint
const mockApi = ({ searchDelay = 0 } = {}) => {
    global.fetch = jest.fn((url) => {
        const respond = (data) =>
            Promise.resolve({
                ok: true,
                json: () => Promise.resolve({ data })
            });
        if (url.includes('/api/LightningComponent/')) return respond(FILES);
        const q = new URL(url, 'http://localhost').searchParams.get('q');
        if (q !== null) {
            const data = ALL.filter((b) => b.label.includes(q));
            return searchDelay
                ? new Promise((resolve) =>
                      setTimeout(() => resolve(respond(data)), searchDelay)
                  )
                : respond(data);
        }
        return respond(ALL);
    });
};

describe('my-web-explorer clearing the search', () => {
    beforeEach(() => {
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
    const labels = (element) =>
        [...element.shadowRoot.querySelectorAll('button.component')].map((b) =>
            b.textContent.trim()
        );
    const input = (element) =>
        element.shadowRoot.querySelector('lightning-input');
    const pressEnter = (element) => {
        const ev = new CustomEvent('keyup');
        ev.key = 'Enter';
        input(element).dispatchEvent(ev);
    };
    const search = async (element, term) => {
        input(element).value = term;
        pressEnter(element);
        await flushPromises();
        await flushPromises();
    };
    const clearVia = async (element, kind) => {
        input(element).value = '';
        if (kind === 'change') {
            input(element).dispatchEvent(
                new CustomEvent('change', { detail: { value: '' } })
            );
        } else {
            input(element).dispatchEvent(new CustomEvent('keyup'));
        }
        await flushPromises();
        await flushPromises();
    };

    it.each(['change', 'keyup'])(
        'restores the full list when the box is emptied (%s)',
        async (kind) => {
            mockApi();
            const element = await create();
            const toasts = [];
            element.addEventListener('toastfired', (e) =>
                toasts.push(e.detail)
            );
            await search(element, 'contact');
            expect(labels(element)).toEqual(['contactList']);

            await clearVia(element, kind);
            expect(labels(element)).toHaveLength(3);
            expect(toasts.map((t) => t.title)).not.toContain(
                'No Results Found'
            );
        }
    );

    it('keeps the open component open when the list resets', async () => {
        mockApi();
        const element = await create();
        await search(element, 'account');
        element.shadowRoot.querySelector('button.component').click();
        await flushPromises();
        await flushPromises();
        expect(
            element.shadowRoot.querySelector('my-code-viewer')
        ).not.toBeNull();

        await clearVia(element, 'change');
        expect(labels(element)).toHaveLength(3);
        expect(
            element.shadowRoot.querySelector('my-code-viewer')
        ).not.toBeNull();
    });

    it('does not let a slow search overwrite the restored list', async () => {
        mockApi({ searchDelay: 50 });
        const element = await create();
        input(element).value = 'contact';
        pressEnter(element);
        await flushPromises();
        await clearVia(element, 'change');
        await new Promise((resolve) => setTimeout(resolve, 120));
        expect(labels(element)).toHaveLength(3);
    });
});
