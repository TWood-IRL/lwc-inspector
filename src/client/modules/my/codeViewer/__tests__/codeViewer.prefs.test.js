import { createElement } from 'lwc';
import CodeViewer from 'my/codeViewer';
import {
    getPrefs,
    setPrefs,
    STORAGE_KEY,
    __resetForTests
} from 'my/viewerPrefs';

const CODE = 'const a = 1;\nlet b = 2;\n// third\nconst c = 3;';

const tick = async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
};
const $ = (el, sel) => el.shadowRoot.querySelector(sel);
const $$ = (el, sel) => Array.from(el.shadowRoot.querySelectorAll(sel));
const key = (target, init) => {
    const event = new KeyboardEvent('keydown', {
        bubbles: true,
        composed: true,
        cancelable: true,
        ...init
    });
    target.dispatchEvent(event);
    return event;
};
const hover = (el) => el.dispatchEvent(new CustomEvent('mouseenter'));
const cssVar = (el, name) => el.style.getPropertyValue(name);

const make = async (props = {}) => {
    const el = createElement('my-code-viewer', { is: CodeViewer });
    el.code = CODE;
    el.fileName = 'x.js';
    Object.assign(el, props);
    document.body.appendChild(el);
    await tick();
    return el;
};

const openPrefs = async (el) => {
    $(el, '[aria-label="Viewer preferences"][aria-haspopup]').click();
    await tick();
};

const radio = (el, pref, value) =>
    $$(el, `input[type="radio"][data-pref="${pref}"]`).find(
        (r) => r.dataset.value === value
    );

const chooseRadio = async (el, pref, value) => {
    const input = radio(el, pref, value);
    input.checked = true;
    input.dispatchEvent(new CustomEvent('change'));
    await tick();
};

const toggle = async (el, pref) => {
    const input = $(el, `input[type="checkbox"][data-pref="${pref}"]`);
    input.checked = !input.checked;
    input.dispatchEvent(new CustomEvent('change'));
    await tick();
};

beforeEach(() => {
    window.localStorage.clear();
    __resetForTests();
    document.documentElement.removeAttribute('data-theme');
});

afterEach(() => {
    jest.restoreAllMocks();
    while (document.body.firstChild) {
        document.body.removeChild(document.body.firstChild);
    }
});

describe('my-code-viewer preferences: appearance', () => {
    it('applies defaults as CSS custom properties on the host', async () => {
        const el = await make();
        expect(cssVar(el, '--cv-font-size')).toBe('13px');
        expect(cssVar(el, '--cv-line-height')).toBe('1.55');
        expect(cssVar(el, '--cv-tab-size')).toBe('4');
        expect(el.getAttribute('data-syntax')).toBe('midnight');
        expect($(el, '.scroller').className).not.toContain('no-gutter');
    });

    it('uses stored preferences on first render', async () => {
        window.localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({
                v: 1,
                prefs: {
                    fontSize: 18,
                    tabWidth: 8,
                    lineHeight: 'relaxed',
                    syntaxTheme: 'solarized',
                    lineNumbers: false,
                    wordWrap: true
                }
            })
        );
        const el = await make();
        expect(cssVar(el, '--cv-font-size')).toBe('18px');
        expect(cssVar(el, '--cv-tab-size')).toBe('8');
        expect(cssVar(el, '--cv-line-height')).toBe('1.8');
        expect(el.getAttribute('data-syntax')).toBe('solarized');
        expect($(el, '.scroller').className).toContain('no-gutter');
        expect($(el, '.scroller').className).toContain('wrapped');
    });

    it('hides line numbers when the preference is off', async () => {
        const el = await make();
        setPrefs({ lineNumbers: false });
        await tick();
        expect($(el, '.scroller').className).toContain('no-gutter');
        setPrefs({ lineNumbers: true });
        await tick();
        expect($(el, '.scroller').className).not.toContain('no-gutter');
    });

    it('follows the word wrap default and still toggles locally', async () => {
        const el = await make();
        expect($(el, '.scroller').className).not.toContain('wrapped');
        setPrefs({ wordWrap: true });
        await tick();
        expect($(el, '.scroller').className).toContain('wrapped');
        $(el, '[aria-label="Word wrap"]').click();
        await tick();
        expect($(el, '.scroller').className).not.toContain('wrapped');
        // The local toggle does not change the saved default
        expect(getPrefs().wordWrap).toBe(true);
    });

    it('switches palettes and resolves auto from the site theme', async () => {
        const el = await make();
        setPrefs({ syntaxTheme: 'contrast' });
        await tick();
        expect(el.getAttribute('data-syntax')).toBe('contrast');

        setPrefs({ syntaxTheme: 'auto' });
        await tick();
        expect(el.getAttribute('data-syntax')).toBe('midnight');
        document.documentElement.setAttribute('data-theme', 'light');
        await tick();
        expect(el.getAttribute('data-syntax')).toBe('paper');
        document.documentElement.setAttribute('data-theme', 'dark');
        await tick();
        expect(el.getAttribute('data-syntax')).toBe('midnight');
    });

    it('stops observing the site theme when disconnected', async () => {
        const el = await make();
        setPrefs({ syntaxTheme: 'auto' });
        await tick();
        document.body.removeChild(el);
        document.documentElement.setAttribute('data-theme', 'light');
        await tick();
        expect(el.getAttribute('data-syntax')).toBe('midnight');
    });

    it('shares preferences between viewer instances', async () => {
        const a = await make();
        const b = await make();
        setPrefs({ fontSize: 17, syntaxTheme: 'paper' });
        await tick();
        for (const el of [a, b]) {
            expect(cssVar(el, '--cv-font-size')).toBe('17px');
            expect(el.getAttribute('data-syntax')).toBe('paper');
        }
    });

    it('unsubscribes when removed', async () => {
        const a = await make();
        document.body.removeChild(a);
        setPrefs({ fontSize: 19 });
        await tick();
        expect(cssVar(a, '--cv-font-size')).toBe('13px');
    });
});

describe('my-code-viewer preferences: zoom shortcuts', () => {
    it('ignores zoom keys unless hovered or focused', async () => {
        await make();
        const event = key(document.body, { key: '=', ctrlKey: true });
        expect(event.defaultPrevented).toBe(false);
        expect(getPrefs().fontSize).toBe(13);
    });

    it('zooms in, out and resets while hovered', async () => {
        const el = await make();
        hover(el);
        const plus = key(document.body, { key: '=', ctrlKey: true });
        expect(plus.defaultPrevented).toBe(true);
        expect(getPrefs().fontSize).toBe(14);
        key(document.body, { key: '+', ctrlKey: true, shiftKey: true });
        expect(getPrefs().fontSize).toBe(15);
        key(document.body, { key: '-', metaKey: true });
        expect(getPrefs().fontSize).toBe(14);
        key(document.body, { key: '0', ctrlKey: true });
        expect(getPrefs().fontSize).toBe(13);
        await tick();
        expect(cssVar(el, '--cv-font-size')).toBe('13px');
    });

    it('stops at the limits', async () => {
        const el = await make();
        hover(el);
        for (let i = 0; i < 20; i++) {
            key(document.body, { key: '=', ctrlKey: true });
        }
        expect(getPrefs().fontSize).toBe(20);
        for (let i = 0; i < 20; i++) {
            key(document.body, { key: '-', ctrlKey: true });
        }
        expect(getPrefs().fontSize).toBe(11);
    });

    it('works while the viewer is focused', async () => {
        const el = await make();
        $(el, '.scroller').dispatchEvent(
            new CustomEvent('focusin', { bubbles: true, composed: true })
        );
        key(document.body, { key: '=', ctrlKey: true });
        expect(getPrefs().fontSize).toBe(14);
    });

    it('leaves plain keys and alt combos alone', async () => {
        const el = await make();
        hover(el);
        key(document.body, { key: '=' });
        key(document.body, { key: '=', ctrlKey: true, altKey: true });
        expect(getPrefs().fontSize).toBe(13);
    });
});

describe('my-code-viewer preferences: popover', () => {
    it('is closed by default and the gear exposes its state', async () => {
        const el = await make();
        const gear = $(el, '[aria-haspopup="dialog"]');
        expect(gear.getAttribute('aria-expanded')).toBe('false');
        expect($(el, '[role="dialog"]')).toBeNull();
    });

    it('opens as a labelled, non-modal dialog and focuses the first control', async () => {
        const el = await make();
        await openPrefs(el);
        const dialog = $(el, '[role="dialog"]');
        expect(dialog).not.toBeNull();
        expect(dialog.getAttribute('aria-label')).toBe('Viewer preferences');
        expect(dialog.getAttribute('aria-modal')).toBeNull();
        expect(
            $(el, '[aria-haspopup="dialog"]').getAttribute('aria-expanded')
        ).toBe('true');
        expect(el.shadowRoot.activeElement).toBe(
            $(el, '[aria-label="Decrease font size"]')
        );
    });

    it('labels its groups and controls', async () => {
        const el = await make();
        await openPrefs(el);
        expect(
            $$(el, 'fieldset legend').map((l) => l.textContent.trim())
        ).toEqual(['Tab width', 'Line height', 'Syntax theme', 'Display']);
        expect($(el, '[role="group"][aria-labelledby]')).not.toBeNull();
        expect($(el, '[aria-label="Increase font size"]')).not.toBeNull();
        expect($$(el, 'input[type="radio"]')).toHaveLength(3 + 3 + 5);
        for (const input of $$(el, '.prefs input')) {
            expect(input.closest('label')).not.toBeNull();
        }
        expect($(el, 'output').getAttribute('aria-live')).toBe('polite');
    });

    it('closes on Escape from inside and returns focus to the gear', async () => {
        const el = await make();
        await openPrefs(el);
        const event = key($(el, '[role="dialog"]'), { key: 'Escape' });
        await tick();
        expect(event.defaultPrevented).toBe(true);
        expect($(el, '[role="dialog"]')).toBeNull();
        expect(el.shadowRoot.activeElement).toBe(
            $(el, '[aria-haspopup="dialog"]')
        );
    });

    it('closes on Escape from elsewhere while hovered', async () => {
        const el = await make();
        await openPrefs(el);
        hover(el);
        key(document.body, { key: 'Escape' });
        await tick();
        expect($(el, '[role="dialog"]')).toBeNull();
    });

    it('closes when the gear or the close button is pressed', async () => {
        const el = await make();
        await openPrefs(el);
        await openPrefs(el);
        expect($(el, '[role="dialog"]')).toBeNull();
        await openPrefs(el);
        $(el, '[aria-label="Close preferences"]').click();
        await tick();
        expect($(el, '[role="dialog"]')).toBeNull();
    });

    it('closes on an outside click but not an inside one', async () => {
        const el = await make();
        await openPrefs(el);
        $(el, '.prefs-title').click();
        await tick();
        expect($(el, '[role="dialog"]')).not.toBeNull();
        document.body.click();
        await tick();
        expect($(el, '[role="dialog"]')).toBeNull();
    });

    it('does not steal Escape from the find bar when closed', async () => {
        const el = await make();
        hover(el);
        key(document.body, { key: 'f', ctrlKey: true });
        await tick();
        expect($(el, '[role="search"]')).not.toBeNull();
        key(document.body, { key: 'Escape' });
        await tick();
        expect($(el, '[role="search"]')).toBeNull();
    });

    it('steps the font size with A- and A+ and disables at the limits', async () => {
        const el = await make();
        await openPrefs(el);
        $(el, '[aria-label="Increase font size"]').click();
        await tick();
        expect($(el, 'output').textContent.trim()).toBe('14 px');
        expect(cssVar(el, '--cv-font-size')).toBe('14px');
        $(el, '[aria-label="Decrease font size"]').click();
        $(el, '[aria-label="Decrease font size"]').click();
        await tick();
        expect(getPrefs().fontSize).toBe(12);
        setPrefs({ fontSize: 11 });
        await tick();
        expect($(el, '[aria-label="Decrease font size"]').disabled).toBe(true);
        setPrefs({ fontSize: 20 });
        await tick();
        expect($(el, '[aria-label="Increase font size"]').disabled).toBe(true);
    });

    it('updates tab width, line height and syntax theme live', async () => {
        const el = await make();
        await openPrefs(el);
        await chooseRadio(el, 'tabWidth', '2');
        expect(cssVar(el, '--cv-tab-size')).toBe('2');
        expect(getPrefs().tabWidth).toBe(2);
        await chooseRadio(el, 'lineHeight', 'compact');
        expect(cssVar(el, '--cv-line-height')).toBe('1.35');
        await chooseRadio(el, 'syntaxTheme', 'paper');
        expect(el.getAttribute('data-syntax')).toBe('paper');
        expect(radio(el, 'syntaxTheme', 'paper').checked).toBe(true);
        expect(radio(el, 'tabWidth', '2').checked).toBe(true);
    });

    it('toggles line numbers, wrap default and current line highlighting', async () => {
        const el = await make();
        await openPrefs(el);
        await toggle(el, 'lineNumbers');
        expect(getPrefs().lineNumbers).toBe(false);
        expect($(el, '.scroller').className).toContain('no-gutter');
        await toggle(el, 'wordWrap');
        expect(getPrefs().wordWrap).toBe(true);
        expect($(el, '.scroller').className).toContain('wrapped');
        await toggle(el, 'highlightLine');
        expect(getPrefs().highlightLine).toBe(false);
    });

    it('persists changes and resets to defaults', async () => {
        const el = await make();
        await openPrefs(el);
        await chooseRadio(el, 'tabWidth', '8');
        expect(
            JSON.parse(window.localStorage.getItem(STORAGE_KEY)).prefs.tabWidth
        ).toBe(8);
        $(el, '.prefs-reset').click();
        await tick();
        expect(getPrefs().tabWidth).toBe(4);
        expect(cssVar(el, '--cv-tab-size')).toBe('4');
    });

    it('shows a live preview using the same palette variables', async () => {
        const el = await make();
        await openPrefs(el);
        expect($(el, '.preview .hljs-keyword')).not.toBeNull();
        expect($(el, '.preview').getAttribute('aria-hidden')).toBe('true');
    });
});

describe('my-code-viewer preferences: metrics and current line', () => {
    const mockMetrics = (state) =>
        jest.spyOn(window, 'getComputedStyle').mockImplementation(() => ({
            lineHeight: `${state.lineHeight}px`,
            paddingTop: '10px'
        }));

    const caretInLine = (el, line) => {
        const codeEl = $(el, 'code');
        const offset = CODE.split('\n')
            .slice(0, line - 1)
            .reduce((n, l) => n + l.length + 1, 0);
        const walker = document.createTreeWalker(codeEl, 4);
        let seen = 0;
        for (let n = walker.nextNode(); n; n = walker.nextNode()) {
            if (offset < seen + n.nodeValue.length) {
                const selection = window.getSelection();
                selection.removeAllRanges();
                selection.collapse(n, offset - seen);
                return;
            }
            seen += n.nodeValue.length;
        }
    };

    it('goToLine measures the line height from the DOM, not a constant', async () => {
        const state = { lineHeight: 26 };
        mockMetrics(state);
        const el = await make();
        el.goToLine(3);
        await tick();
        expect($(el, '.line-flash').getAttribute('style')).toContain(
            'top: 62px; height: 26px'
        );
        state.lineHeight = 40;
        el.goToLine(3);
        await tick();
        expect($(el, '.line-flash').getAttribute('style')).toContain(
            'top: 90px; height: 40px'
        );
    });

    it('falls back to font size times line height where there is no layout', async () => {
        const el = await make();
        setPrefs({ fontSize: 20, lineHeight: 'relaxed' });
        await tick();
        el.goToLine(2);
        await tick();
        // padding 12 (fallback) + 1 * 20 * 1.8
        expect($(el, '.line-flash').getAttribute('style')).toContain(
            'top: 48px; height: 36px'
        );
    });

    it('highlights the clicked line using the measured height', async () => {
        const state = { lineHeight: 30 };
        mockMetrics(state);
        const el = await make();
        caretInLine(el, 3);
        $(el, '.code-area').click();
        await tick();
        const band = $(el, '.line-current');
        expect(band.className).toContain('visible');
        expect(band.getAttribute('style')).toContain('top: 70px; height: 30px');
    });

    it('re-measures the highlighted line when font metrics change', async () => {
        const state = { lineHeight: 30 };
        mockMetrics(state);
        const el = await make();
        caretInLine(el, 3);
        $(el, '.code-area').click();
        await tick();
        state.lineHeight = 24;
        setPrefs({ fontSize: 11 });
        await tick();
        await tick();
        expect($(el, '.line-current').getAttribute('style')).toContain(
            'top: 58px; height: 24px'
        );
    });

    it('works out the line from the pointer when there is no caret', async () => {
        mockMetrics({ lineHeight: 30 });
        const el = await make();
        window.getSelection().removeAllRanges();
        $(el, '.code-area').dispatchEvent(
            new MouseEvent('click', { bubbles: true, clientY: 75 })
        );
        await tick();
        expect($(el, '.line-current').getAttribute('style')).toContain(
            'top: 70px'
        );
    });

    it('does nothing when the preference is off or text is selected', async () => {
        mockMetrics({ lineHeight: 30 });
        const el = await make();
        setPrefs({ highlightLine: false });
        await tick();
        caretInLine(el, 2);
        $(el, '.code-area').click();
        await tick();
        expect($(el, '.line-current').className).not.toContain('visible');

        setPrefs({ highlightLine: true });
        await tick();
        const codeEl = $(el, 'code');
        const range = document.createRange();
        range.selectNodeContents(codeEl);
        window.getSelection().removeAllRanges();
        window.getSelection().addRange(range);
        $(el, '.code-area').click();
        await tick();
        expect($(el, '.line-current').className).not.toContain('visible');
    });

    it('clears the highlight when the code changes', async () => {
        mockMetrics({ lineHeight: 30 });
        const el = await make();
        caretInLine(el, 2);
        $(el, '.code-area').click();
        await tick();
        expect($(el, '.line-current').className).toContain('visible');
        el.code = 'other';
        await tick();
        expect($(el, '.line-current').className).not.toContain('visible');
    });

    it('keeps find and go to line working after a font change', async () => {
        const state = { lineHeight: 28 };
        mockMetrics(state);
        const el = await make();
        setPrefs({ fontSize: 18, lineHeight: 'relaxed' });
        await tick();
        hover(el);
        key(document.body, { key: 'g', ctrlKey: true });
        await tick();
        const goto = $(el, '[aria-label="Go to line"]');
        goto.value = '4';
        goto.dispatchEvent(new CustomEvent('input'));
        key(goto, { key: 'Enter' });
        await tick();
        expect($(el, '.line-flash').getAttribute('style')).toContain(
            'top: 94px; height: 28px'
        );
        key(document.body, { key: 'f', ctrlKey: true });
        await tick();
        const find = $(el, '[aria-label="Find in file"]');
        expect(find).not.toBeNull();
    });
});
