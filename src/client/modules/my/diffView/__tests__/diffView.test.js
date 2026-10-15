import { createElement } from 'lwc';
import DiffView from 'my/diffView';

const tick = () => Promise.resolve();

const numbered = (n, prefix = 'line') =>
    Array.from({ length: n }, (_, i) => `${prefix} ${i + 1}`).join('\n');

const FILES = [
    {
        id: 'a-js',
        bundle: 'alpha',
        label: 'lwc/alpha/alpha.js',
        source: 'x\ny'
    },
    {
        id: 'a-html',
        bundle: 'alpha',
        label: 'lwc/alpha/alpha.html',
        source: '<p>hi</p>'
    },
    { id: 'b-js', bundle: 'beta', label: 'lwc/beta/alpha.js', source: 'x\nz' }
];

describe('my-diff-view', () => {
    let element;

    const create = async (props = {}) => {
        element = createElement('my-diff-view', { is: DiffView });
        Object.assign(element, { files: FILES, initialLeft: 'a-js' }, props);
        document.body.appendChild(element);
        await tick();
        return element;
    };
    const $ = (sel) => element.shadowRoot.querySelector(sel);
    const $$ = (sel) => [...element.shadowRoot.querySelectorAll(sel)];
    const click = async (sel) => {
        $(sel).click();
        await tick();
    };

    beforeEach(() => {
        delete window.matchMedia;
    });
    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
    });

    it('defaults left to the current file and right to the same-named file in another bundle', async () => {
        await create();
        expect($('.left-select').value).toBe('a-js');
        expect($('.right-select').value).toBe('b-js');
    });

    it('lists files grouped by bundle', async () => {
        await create();
        const groups = $$('.left-select optgroup');
        expect(groups.map((g) => g.label)).toEqual(['alpha', 'beta']);
        expect(groups[0].querySelectorAll('option')).toHaveLength(2);
        expect(groups[1].querySelector('option').textContent.trim()).toBe(
            'alpha.js'
        );
    });

    it('shows stats and a marker for removed and added lines', async () => {
        await create();
        expect($('.stat-added').textContent).toBe('+1');
        expect($('.stat-removed').textContent).toBe('−1');
        expect($('.stats').getAttribute('aria-label')).toBe(
            '1 line added, 1 line removed'
        );
        const text = $('.diff-split').textContent;
        expect(text).toContain('removed');
        expect(text).toContain('added');
        expect(
            $$('td [aria-hidden="true"]').some((n) => n.textContent === '+')
        ).toBe(true);
    });

    it('renders side by side with table semantics', async () => {
        await create();
        const table = $('table.diff-split');
        expect(table).not.toBeNull();
        expect(table.getAttribute('aria-label')).toBe('Side-by-side diff');
        expect(table.querySelectorAll('th[scope="col"]')).toHaveLength(6);
        const rows = $$('tbody tr');
        expect(rows).toHaveLength(2);
        expect(rows[1].querySelectorAll('td')).toHaveLength(6);
    });

    it('switches to unified and back', async () => {
        await create();
        await click('[data-mode="unified"]');
        expect($('table.diff-unified')).not.toBeNull();
        expect($('table.diff-split')).toBeNull();
        expect($('[data-mode="unified"]').getAttribute('aria-pressed')).toBe(
            'true'
        );
        const types = $$('tbody tr').map((tr) => tr.className);
        expect(types[1]).toContain('line-del');
        expect(types[2]).toContain('line-add');
        await click('[data-mode="split"]');
        expect($('table.diff-split')).not.toBeNull();
    });

    it('forces unified and hides the toggle on narrow screens', async () => {
        const listeners = [];
        window.matchMedia = jest.fn(() => ({
            matches: true,
            addEventListener: (_, fn) => listeners.push(fn),
            removeEventListener: jest.fn()
        }));
        await create();
        expect($('table.diff-unified')).not.toBeNull();
        expect($('.modes')).toBeNull();
        listeners[0]({ matches: false });
        await tick();
        expect($('table.diff-split')).not.toBeNull();
        expect($('.modes')).not.toBeNull();
    });

    it('swaps left and right', async () => {
        await create();
        await click('.swap-button');
        expect($('.left-select').value).toBe('b-js');
        expect($('.right-select').value).toBe('a-js');
        const first = $$('tbody tr')[1].querySelectorAll('td')[2].textContent;
        expect(first).toContain('z');
    });

    it('changes sides from the dropdowns', async () => {
        await create();
        const select = $('.right-select');
        select.value = 'a-html';
        select.dispatchEvent(new CustomEvent('change'));
        await tick();
        expect($('.stat-added').textContent).toBe('+1');
        expect($('.stat-removed').textContent).toBe('−2');
    });

    it('says when the files are identical', async () => {
        await create({
            files: [
                { id: '1', bundle: 'a', label: 'a.js', source: 'same' },
                { id: '2', bundle: 'b', label: 'a.js', source: 'same' }
            ],
            initialLeft: '1'
        });
        expect($('.identical').textContent).toContain('identical');
        expect($('table')).toBeNull();
        expect($('.next-button').disabled).toBe(true);
    });

    it('prompts when there are no files or no partner', async () => {
        await create({ files: [] });
        expect($('.message').textContent).toContain('No files are loaded');
        await create({
            files: [{ id: '1', bundle: 'a', label: 'a.js', source: 's' }],
            initialLeft: '1'
        });
        expect($('.message').textContent).toContain('Choose a file');
    });

    it('collapses unchanged regions and expands them on demand', async () => {
        const left = numbered(40);
        const right = left.replace('line 20', 'LINE 20');
        await create({
            files: [
                { id: 'l', bundle: 'a', label: 'f.js', source: left },
                { id: 'r', bundle: 'b', label: 'f.js', source: right }
            ],
            initialLeft: 'l'
        });
        const folds = $$('.fold-button');
        expect(folds.map((f) => f.textContent.trim())).toEqual([
            '16 unchanged lines',
            '17 unchanged lines'
        ]);
        expect($$('tbody tr')).toHaveLength(9);
        folds[0].click();
        await tick();
        expect($$('.fold-button')).toHaveLength(1);
        expect($$('tbody tr')).toHaveLength(24);
    });

    it('navigates between changes with buttons and n / p keys', async () => {
        const left = numbered(60);
        const right = left
            .replace('line 5\n', 'five\n')
            .replace('line 50', 'fifty');
        await create({
            files: [
                { id: 'l', bundle: 'a', label: 'f.js', source: left },
                { id: 'r', bundle: 'b', label: 'f.js', source: right }
            ],
            initialLeft: 'l'
        });
        expect($('.nav-status').textContent).toBe('Change - of 2');
        await click('.next-button');
        expect($('.nav-status').textContent).toBe('Change 1 of 2');
        expect($$('.line-current').length).toBeGreaterThan(0);
        const key = (k, init = {}) => {
            $('.diff-root').dispatchEvent(
                new KeyboardEvent('keydown', {
                    key: k,
                    bubbles: true,
                    cancelable: true,
                    ...init
                })
            );
            return tick();
        };
        await key('n');
        expect($('.nav-status').textContent).toBe('Change 2 of 2');
        await key('n');
        expect($('.nav-status').textContent).toBe('Change 1 of 2');
        await key('p');
        expect($('.nav-status').textContent).toBe('Change 2 of 2');
        await click('.prev-button');
        expect($('.nav-status').textContent).toBe('Change 1 of 2');
        await key('n', { ctrlKey: true });
        expect($('.nav-status').textContent).toBe('Change 1 of 2');
    });

    it('scrolls the current change into view', async () => {
        await create();
        const spy = jest.fn();
        Element.prototype.scrollIntoView = spy;
        try {
            await click('.next-button');
            expect(spy).toHaveBeenCalled();
        } finally {
            delete Element.prototype.scrollIntoView;
        }
    });

    it('starts at the last change when going backwards first', async () => {
        await create();
        await click('.prev-button');
        expect($('.nav-status').textContent).toBe('Change 1 of 1');
    });

    it('ignores n / p typed into a dropdown', async () => {
        await create();
        $('.left-select').dispatchEvent(
            new KeyboardEvent('keydown', {
                key: 'n',
                bubbles: true,
                composed: true
            })
        );
        await tick();
        expect($('.nav-status').textContent).toBe('Change - of 1');
    });

    it('highlights changed words inside a changed line', async () => {
        await create({
            files: [
                { id: 'l', bundle: 'a', label: 'f.js', source: 'let a = 1;' },
                { id: 'r', bundle: 'b', label: 'f.js', source: 'let a = 2;' }
            ],
            initialLeft: 'l'
        });
        const changed = $$('.seg-changed').map((s) => s.textContent);
        expect(changed).toEqual(['1', '2']);
    });

    it('escapes source instead of injecting markup', async () => {
        const evil = '<img src=x onerror="window.__pwned=1">';
        await create({
            files: [
                { id: 'l', bundle: 'a', label: 'f.html', source: evil },
                { id: 'r', bundle: 'b', label: 'f.html', source: `${evil}<b>` }
            ],
            initialLeft: 'l'
        });
        expect(element.shadowRoot.querySelector('img')).toBeNull();
        expect(element.shadowRoot.querySelector('b')).toBeNull();
        expect($('.diff').textContent).toContain(evil);
        expect(window.__pwned).toBeUndefined();
    });

    it('warns when the diff had to be coarse', async () => {
        const a = Array.from({ length: 2500 }, (_, i) => `a${i}`).join('\n');
        const b = Array.from({ length: 2500 }, (_, i) => `b${i}`).join('\n');
        await create({
            files: [
                { id: 'l', bundle: 'a', label: 'f.js', source: a },
                { id: 'r', bundle: 'b', label: 'f.js', source: b }
            ],
            initialLeft: 'l'
        });
        expect($('.notice').textContent).toContain('differ too much');
    });

    it('fires exit', async () => {
        await create();
        const handler = jest.fn();
        element.addEventListener('exit', handler);
        await click('.exit-button');
        expect(handler).toHaveBeenCalledTimes(1);
    });

    it('recovers when the files list changes under it', async () => {
        await create();
        element.files = [FILES[0], FILES[1]];
        await tick();
        expect($('.right-select').value).toBe('a-html');
    });

    it('caches the diff between re-renders', async () => {
        await create();
        const first = element.shadowRoot.querySelectorAll('tbody tr').length;
        await click('[data-mode="unified"]');
        await click('[data-mode="split"]');
        expect(element.shadowRoot.querySelectorAll('tbody tr').length).toBe(
            first
        );
    });
});
