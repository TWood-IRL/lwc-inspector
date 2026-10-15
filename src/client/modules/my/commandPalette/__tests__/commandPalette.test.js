import { createElement } from 'lwc';
import CommandPalette from 'my/commandPalette';
import { addRecent } from 'my/navState';

const flush = () => Promise.resolve();

const DATA = {
    bundles: [
        { label: 'accountCard', type: 'lwcComps' },
        { label: 'caseTimeline', type: 'lwcComps' }
    ],
    files: [
        { type: 'lwcComps', bundle: 'accountCard', file: 'accountCard.js' },
        { type: 'lwcComps', bundle: 'accountCard', file: 'accountCard.html' }
    ],
    canCopySource: true
};

const key = (k, init = {}, target = document.body) => {
    const e = new KeyboardEvent('keydown', {
        key: k,
        bubbles: true,
        composed: true,
        cancelable: true,
        ...init
    });
    target.dispatchEvent(e);
    return e;
};

describe('my-command-palette', () => {
    let el;
    let respondWith;
    let requestHandler;

    const options = () => [...el.shadowRoot.querySelectorAll('[role=option]')];
    const input = () => el.shadowRoot.querySelector('input');
    const labels = () =>
        options().map((o) => o.querySelector('.label').textContent.trim());
    const type = async (value) => {
        input().value = value;
        input().dispatchEvent(new CustomEvent('input'));
        await flush();
    };
    const openPalette = async () => {
        key('k', { ctrlKey: true });
        await flush();
    };
    const capture = (name) => {
        const handler = jest.fn();
        document.addEventListener(name, handler);
        return handler;
    };
    const listeners = [];
    const spy = (name) => {
        const handler = capture(name);
        listeners.push([name, handler]);
        return handler;
    };

    beforeEach(() => {
        localStorage.clear();
        respondWith = DATA;
        requestHandler = jest.fn((event) => event.detail.respond(respondWith));
        document.addEventListener('lwci:palette-request', requestHandler);
        el = createElement('my-command-palette', { is: CommandPalette });
        document.body.appendChild(el);
    });
    afterEach(() => {
        document.removeEventListener('lwci:palette-request', requestHandler);
        listeners
            .splice(0)
            .forEach(([n, h]) => document.removeEventListener(n, h));
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
        document.documentElement.removeAttribute('data-theme');
    });

    it('is closed by default and opens with Ctrl+K and Cmd+K', async () => {
        expect(el.shadowRoot.querySelector('[role=dialog]')).toBeNull();
        const e = key('k', { ctrlKey: true });
        await flush();
        expect(e.defaultPrevented).toBe(true);
        expect(el.shadowRoot.querySelector('[role=dialog]')).not.toBeNull();
        key('Escape', {}, input());
        await flush();
        key('K', { metaKey: true });
        await flush();
        expect(el.shadowRoot.querySelector('[role=dialog]')).not.toBeNull();
    });

    it('toggles closed with Ctrl+K again and ignores plain or shifted k', async () => {
        key('k');
        key('k', { ctrlKey: true, shiftKey: true });
        await flush();
        expect(el.shadowRoot.querySelector('[role=dialog]')).toBeNull();
        await openPalette();
        key('k', { ctrlKey: true });
        await flush();
        expect(el.shadowRoot.querySelector('[role=dialog]')).toBeNull();
    });

    it('requests items via lwci:palette-request with a respond callback', async () => {
        await openPalette();
        expect(requestHandler).toHaveBeenCalledTimes(1);
        expect(typeof requestHandler.mock.calls[0][0].detail.respond).toBe(
            'function'
        );
        expect(labels()).toContain('accountCard.js');
    });

    it('accepts a late response', async () => {
        respondWith = null;
        requestHandler.mockImplementation((e) => {
            setTimeout(() => e.detail.respond(DATA), 0);
        });
        await openPalette();
        expect(labels()).not.toContain('accountCard');
        await new Promise((r) => setTimeout(r, 5));
        await flush();
        expect(labels()).toContain('accountCard.js');
    });

    it('renders sections with groups, recents and actions', async () => {
        addRecent({
            name: 'caseTimeline',
            label: 'caseTimeline',
            type: 'lwcComps'
        });
        await openPalette();
        const groups = [...el.shadowRoot.querySelectorAll('[role=group]')].map(
            (g) => g.getAttribute('aria-label')
        );
        expect(groups).toEqual([
            'Recent',
            'Files in this component',
            'Actions',
            'Components'
        ]);
    });

    it('has combobox / listbox semantics and focuses the input', async () => {
        await openPalette();
        expect(input().getAttribute('role')).toBe('combobox');
        expect(input().getAttribute('aria-controls')).toBe(
            el.shadowRoot.querySelector('[role=listbox]').getAttribute('id')
        );
        expect(el.shadowRoot.activeElement).toBe(input());
        expect(
            el.shadowRoot
                .querySelector('[role=dialog]')
                .getAttribute('aria-modal')
        ).toBe('true');
    });

    it('tracks the active option with aria-activedescendant and arrow keys', async () => {
        await openPalette();
        const all = options();
        expect(all[0].getAttribute('aria-selected')).toBe('true');
        expect(input().getAttribute('aria-activedescendant')).toBe(
            all[0].getAttribute('id')
        );
        key('ArrowDown', {}, input());
        await flush();
        expect(options()[1].getAttribute('aria-selected')).toBe('true');
        expect(options()[0].getAttribute('aria-selected')).toBe('false');
        key('ArrowUp', {}, input());
        key('ArrowUp', {}, input());
        await flush();
        const last = options().length - 1;
        expect(options()[last].getAttribute('aria-selected')).toBe('true');
        key('ArrowDown', {}, input());
        await flush();
        expect(options()[0].getAttribute('aria-selected')).toBe('true');
    });

    it('supports Home and End when the query is empty', async () => {
        await openPalette();
        key('End', {}, input());
        await flush();
        expect(
            options()[options().length - 1].getAttribute('aria-selected')
        ).toBe('true');
        key('Home', {}, input());
        await flush();
        expect(options()[0].getAttribute('aria-selected')).toBe('true');
    });

    it('scrolls the active item into view', async () => {
        const original = Element.prototype.scrollIntoView;
        const scroll = jest.fn();
        Element.prototype.scrollIntoView = scroll;
        try {
            await openPalette();
            scroll.mockClear();
            key('ArrowDown', {}, input());
            await flush();
            expect(scroll).toHaveBeenCalledWith({ block: 'nearest' });
        } finally {
            Element.prototype.scrollIntoView = original;
        }
    });

    it('filters with fuzzy search and highlights matches safely', async () => {
        await openPalette();
        await type('aCa');
        expect(labels()).toContain('accountCard');
        expect(labels()).not.toContain('caseTimeline');
        const marks = options()[0].querySelectorAll('.mark');
        expect(marks.length).toBeGreaterThan(0);
        expect([...marks].every((m) => /^[a-z]+$/i.test(m.textContent))).toBe(
            true
        );
    });

    it('renders hostile labels as text, not HTML', async () => {
        respondWith = {
            bundles: [
                { label: '<img src=x onerror=alert(1)>', type: 'lwcComps' }
            ]
        };
        await openPalette();
        await type('img');
        expect(el.shadowRoot.querySelector('img')).toBeNull();
        expect(labels()[0]).toBe('<img src=x onerror=alert(1)>');
    });

    it('shows an empty state and Enter does nothing', async () => {
        const open = spy('lwci:open-target');
        await openPalette();
        await type('zzzzqq');
        expect(options()).toHaveLength(0);
        expect(el.shadowRoot.querySelector('.empty').textContent).toContain(
            'zzzzqq'
        );
        expect(input().hasAttribute('aria-activedescendant')).toBe(false);
        key('Enter', {}, input());
        await flush();
        expect(open).not.toHaveBeenCalled();
        expect(el.shadowRoot.querySelector('[role=dialog]')).not.toBeNull();
    });

    it('caps to 50 results', async () => {
        respondWith = {
            bundles: Array.from({ length: 300 }, (_, i) => ({
                label: `comp${i}`,
                type: 'lwcComps'
            }))
        };
        await openPalette();
        await type('comp');
        expect(options()).toHaveLength(50);
    });

    it('Enter opens the active component via lwci:open-target and closes', async () => {
        const open = spy('lwci:open-target');
        await openPalette();
        await type('caseT');
        key('Enter', {}, input());
        await flush();
        expect(open).toHaveBeenCalledTimes(1);
        expect(open.mock.calls[0][0].detail).toEqual({
            type: 'lwcComps',
            bundle: 'caseTimeline',
            file: null
        });
        expect(el.shadowRoot.querySelector('[role=dialog]')).toBeNull();
    });

    it('opens a file of the current component', async () => {
        const open = spy('lwci:open-target');
        await openPalette();
        await type('accountCard.html');
        expect(options()[0].querySelector('.detail').textContent).toBe(
            'accountCard'
        );
        key('Enter', {}, input());
        expect(open.mock.calls[0][0].detail).toEqual({
            type: 'lwcComps',
            bundle: 'accountCard',
            file: 'accountCard.html'
        });
    });

    it('opens a recent entry', async () => {
        addRecent({ name: 'oldComp', label: 'oldComp', type: 'auraComps' });
        const open = spy('lwci:open-target');
        await openPalette();
        expect(labels()[0]).toBe('oldComp');
        key('Enter', {}, input());
        expect(open.mock.calls[0][0].detail).toEqual({
            type: 'auraComps',
            bundle: 'oldComp',
            file: null
        });
    });

    it('selects with the mouse: hover activates, click runs', async () => {
        const open = spy('lwci:open-target');
        await openPalette();
        await type('case');
        const opt = options()[0];
        opt.dispatchEvent(new MouseEvent('mousemove', { bubbles: true }));
        await flush();
        expect(opt.getAttribute('aria-selected')).toBe('true');
        opt.click();
        await flush();
        expect(open).toHaveBeenCalledTimes(1);
        expect(el.shadowRoot.querySelector('[role=dialog]')).toBeNull();
    });

    it('hover changes the active option', async () => {
        await openPalette();
        const second = options()[2];
        second.dispatchEvent(new MouseEvent('mousemove', { bubbles: true }));
        await flush();
        expect(options()[2].getAttribute('aria-selected')).toBe('true');
        expect(options()[0].getAttribute('aria-selected')).toBe('false');
    });

    it('closes on Escape and restores focus', async () => {
        const button = document.createElement('button');
        document.body.appendChild(button);
        button.focus();
        await openPalette();
        expect(document.activeElement).not.toBe(button);
        key('Escape', {}, input());
        await flush();
        expect(el.shadowRoot.querySelector('[role=dialog]')).toBeNull();
        expect(document.activeElement).toBe(button);
    });

    it('closes when the backdrop is pressed but not the dialog', async () => {
        await openPalette();
        const dialog = el.shadowRoot.querySelector('.dialog');
        dialog.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        await flush();
        expect(el.shadowRoot.querySelector('[role=dialog]')).not.toBeNull();
        el.shadowRoot
            .querySelector('.backdrop')
            .dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        await flush();
        expect(el.shadowRoot.querySelector('[role=dialog]')).toBeNull();
    });

    it('traps focus: Tab keeps focus in the input', async () => {
        await openPalette();
        const e = key('Tab', {}, input());
        const s = key('Tab', { shiftKey: true }, input());
        expect(e.defaultPrevented).toBe(true);
        expect(s.defaultPrevented).toBe(true);
        expect(el.shadowRoot.activeElement).toBe(input());
    });

    it('resets the query when reopened', async () => {
        await openPalette();
        await type('case');
        key('Escape', {}, input());
        await flush();
        await openPalette();
        expect(input().value).toBe('');
    });

    describe('actions', () => {
        const run = async (query) => {
            await openPalette();
            await type(query);
            key('Enter', {}, input());
            await flush();
        };

        it('copy link', async () => {
            const h = spy('lwci:copy-link');
            await run('copy link');
            expect(h).toHaveBeenCalledTimes(1);
        });

        it('copy source', async () => {
            const h = spy('lwci:copy-source');
            await run('copy source');
            expect(h).toHaveBeenCalledTimes(1);
        });

        it('copy source is hidden when no source is open', async () => {
            respondWith = { ...DATA, canCopySource: false };
            await openPalette();
            await type('copy source');
            expect(labels()).not.toContain('Copy source');
        });

        it('show shortcuts', async () => {
            const h = spy('lwci:show-shortcuts');
            await run('shortcuts');
            expect(h).toHaveBeenCalledTimes(1);
        });

        it('toggle theme applies, stores and announces', async () => {
            document.documentElement.setAttribute('data-theme', 'light');
            const h = spy('lwci:theme-changed');
            await run('toggle theme');
            expect(document.documentElement.getAttribute('data-theme')).toBe(
                'dark'
            );
            expect(localStorage.getItem('lwci-theme')).toBe('dark');
            expect(h.mock.calls[0][0].detail).toEqual({ theme: 'dark' });
            await run('toggle theme');
            expect(document.documentElement.getAttribute('data-theme')).toBe(
                'light'
            );
        });
    });

    it('removes its document listeners when disconnected', async () => {
        document.body.removeChild(el);
        key('k', { ctrlKey: true });
        await flush();
        expect(requestHandler).not.toHaveBeenCalled();
    });
});
