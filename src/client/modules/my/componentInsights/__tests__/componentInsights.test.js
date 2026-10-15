import { createElement } from 'lwc';
import ComponentInsights from 'my/componentInsights';

const flush = () => Promise.resolve();

const files = [
    {
        name: 'a',
        label: 'lwc/x/x.js',
        Format: 'JS',
        Source: "export default class X extends LightningElement {\n  @api foo;\n  @api bar() {}\n  connectedCallback() {}\n  go() { this.dispatchEvent(new CustomEvent('<img src=x onerror=alert(1)>')); }\n}\n"
    },
    {
        name: 'b',
        label: 'lwc/x/x.html',
        Format: 'HTML',
        Source: '<template><c-kid></c-kid></template>'
    }
];

const create = (props = { files }) => {
    const el = createElement('my-component-insights', {
        is: ComponentInsights
    });
    Object.assign(el, props);
    document.body.appendChild(el);
    return el;
};

afterEach(() => {
    while (document.body.firstChild)
        document.body.removeChild(document.body.firstChild);
});

describe('my-component-insights', () => {
    it('is collapsed by default with a summary', () => {
        const el = create();
        expect(el.shadowRoot.querySelector('.insights-body')).toBeNull();
        expect(
            el.shadowRoot.querySelector('.insights-summary').textContent
        ).toMatch(/2 files/);
    });

    it('expands to show sections with counts; first is open', async () => {
        const el = create();
        el.shadowRoot.querySelector('.insights-toggle').click();
        await flush();
        const headers = [...el.shadowRoot.querySelectorAll('.section-header')];
        expect(headers[0].textContent).toContain('Files');
        expect(headers[1].textContent).toContain('Base class');
        // base class (first analysis section) open, @api closed
        expect(el.shadowRoot.querySelectorAll('.chip')).toHaveLength(1);
    });

    it('toggles accordion sections and renders chips', async () => {
        const el = create();
        el.shadowRoot.querySelector('.insights-toggle').click();
        await flush();
        const api = el.shadowRoot.querySelector('[data-id="api"]');
        expect(api.getAttribute('aria-expanded')).toBe('false');
        api.click();
        await flush();
        const chips = [...el.shadowRoot.querySelectorAll('.chip-text')].map(
            (c) => c.textContent.trim()
        );
        expect(chips).toEqual(expect.arrayContaining(['foo', 'bar']));
    });

    it('shows the file table with totals', async () => {
        const el = create();
        el.shadowRoot.querySelector('.insights-toggle').click();
        await flush();
        el.shadowRoot.querySelector('[data-id="__files"]').click();
        await flush();
        expect(el.shadowRoot.querySelectorAll('tbody tr')).toHaveLength(2);
        expect(el.shadowRoot.querySelector('tfoot').textContent).toContain(
            'Total'
        );
    });

    it('dispatches insightselect with file and line', async () => {
        const el = create();
        const handler = jest.fn();
        el.addEventListener('insightselect', handler);
        el.shadowRoot.querySelector('.insights-toggle').click();
        await flush();
        el.shadowRoot.querySelector('[data-id="api"]').click();
        await flush();
        const chip = [...el.shadowRoot.querySelectorAll('.chip')].find((c) =>
            c.textContent.includes('bar')
        );
        chip.click();
        expect(handler).toHaveBeenCalledTimes(1);
        expect(handler.mock.calls[0][0].detail).toEqual({
            fileName: 'a',
            line: 3
        });
    });

    it('renders untrusted source as text, never markup', async () => {
        const el = create();
        el.shadowRoot.querySelector('.insights-toggle').click();
        await flush();
        el.shadowRoot.querySelector('[data-id="events"]').click();
        await flush();
        expect(el.shadowRoot.querySelector('img')).toBeNull();
        const texts = [...el.shadowRoot.querySelectorAll('.chip-text')].map(
            (c) => c.textContent
        );
        expect(texts.join('')).toContain('<img');
    });

    it('handles empty and invalid files', async () => {
        const el = create({ files: null });
        el.shadowRoot.querySelector('.insights-toggle').click();
        await flush();
        expect(el.shadowRoot.querySelector('.empty').textContent).toMatch(
            /No files/
        );
    });

    it('reanalyzes when files change', async () => {
        const el = create();
        el.files = [files[1]];
        await flush();
        expect(
            el.shadowRoot.querySelector('.insights-summary').textContent
        ).toMatch(/1 file ·/);
    });
});
