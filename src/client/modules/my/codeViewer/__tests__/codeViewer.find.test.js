import { createElement } from 'lwc';
import CodeViewer from 'my/codeViewer';
import { findMatches, wrapMatches, lineStartOffset } from '../highlight';

describe('search helpers', () => {
    it('finds literal matches case-insensitively', () => {
        const { matches, truncated } = findMatches('Foo foo FOO.*', 'foo');
        expect(matches).toEqual([
            { start: 0, end: 3 },
            { start: 4, end: 7 },
            { start: 8, end: 11 }
        ]);
        expect(truncated).toBe(false);
    });

    it('treats regex characters literally', () => {
        expect(findMatches('a.b axb', '.*').matches).toHaveLength(0);
        expect(findMatches('a.b axb', 'a.b').matches).toHaveLength(1);
        expect(findMatches('(x)', '(').matches).toHaveLength(1);
    });

    it('returns nothing for an empty query or code', () => {
        expect(findMatches('abc', '').matches).toEqual([]);
        expect(findMatches('', 'a').matches).toEqual([]);
    });

    it('caps matches and flags truncation', () => {
        const result = findMatches('a'.repeat(50), 'a', 10);
        expect(result.matches).toHaveLength(10);
        expect(result.truncated).toBe(true);
        expect(findMatches('a'.repeat(10), 'a', 10).truncated).toBe(false);
    });

    it('finds the start offset of a line', () => {
        expect(lineStartOffset('a\nbb\nc', 1)).toBe(0);
        expect(lineStartOffset('a\nbb\nc', 3)).toBe(5);
        expect(lineStartOffset('a\nbb', 9)).toBe(4);
    });

    it('wraps matches across syntax spans without changing text', () => {
        const root = document.createElement('code');
        const span = document.createElement('span');
        span.className = 'k';
        span.textContent = 'const';
        root.append(span, ' value = 1');
        const text = root.textContent;
        const { matches } = findMatches(text, 'st va');
        const groups = wrapMatches(root, matches);
        expect(root.textContent).toBe(text);
        expect(groups).toHaveLength(1);
        expect(groups[0]).toHaveLength(2);
        expect(root.querySelector('span.k mark').textContent).toBe('st');
        expect(root.querySelector('span.k').textContent).toBe('const');
        expect(groups[0][1].textContent).toBe(' va');
    });

    it('wraps several matches in one text node', () => {
        const root = document.createElement('code');
        root.textContent = 'abab';
        const groups = wrapMatches(root, findMatches('abab', 'b').matches);
        expect(groups.map((g) => g[0].textContent)).toEqual(['b', 'b']);
        expect(root.textContent).toBe('abab');
        expect(root.querySelectorAll('mark')).toHaveLength(2);
    });

    it('returns no groups for no matches', () => {
        const root = document.createElement('code');
        root.textContent = 'abc';
        expect(wrapMatches(root, [])).toEqual([]);
    });
});

describe('my-code-viewer find, wrap and go to line', () => {
    const CODE = 'const a = 1;\nlet A = 2;\n// nothing\nconst b = "a";';

    const tick = async () => {
        await Promise.resolve();
        await Promise.resolve();
    };
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
    const $ = (el, sel) => el.shadowRoot.querySelector(sel);
    const status = (el) => $(el, '[role="status"]').textContent.trim();
    const input = (el, label, value) => {
        const field = $(el, `[aria-label="${label}"]`);
        field.value = value;
        field.dispatchEvent(new CustomEvent('input'));
        return field;
    };
    const typeFind = async (el, value) => {
        input(el, 'Find in file', value);
        jest.advanceTimersByTime(200);
        await tick();
    };
    const hover = (el) => el.dispatchEvent(new CustomEvent('mouseenter'));

    let element;

    beforeEach(async () => {
        jest.useFakeTimers();
        element = createElement('my-code-viewer', { is: CodeViewer });
        element.code = CODE;
        element.fileName = 'x.js';
        document.body.appendChild(element);
        await tick();
    });

    afterEach(() => {
        jest.useRealTimers();
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
    });

    const open = async () => {
        hover(element);
        key(document.body, { key: 'f', ctrlKey: true });
        await tick();
    };

    it('ignores shortcuts when neither hovered nor focused', async () => {
        const event = key(document.body, { key: 'f', ctrlKey: true });
        await tick();
        expect(event.defaultPrevented).toBe(false);
        expect($(element, '[role="search"]')).toBeNull();
    });

    it('ignores plain F and modified combos', async () => {
        hover(element);
        key(document.body, { key: 'f' });
        key(document.body, { key: 'f', ctrlKey: true, shiftKey: true });
        key(document.body, { key: 'f', ctrlKey: true, altKey: true });
        await tick();
        expect($(element, '[role="search"]')).toBeNull();
    });

    it('opens the find bar with ctrl+F when hovered and focuses it', async () => {
        hover(element);
        const event = key(document.body, { key: 'F', ctrlKey: true });
        await tick();
        expect(event.defaultPrevented).toBe(true);
        const field = $(element, '[aria-label="Find in file"]');
        expect(field).not.toBeNull();
        expect(element.shadowRoot.activeElement).toBe(field);
    });

    it('stops reacting after the mouse leaves', async () => {
        hover(element);
        element.dispatchEvent(new CustomEvent('mouseleave'));
        key(document.body, { key: 'f', ctrlKey: true });
        await tick();
        expect($(element, '[role="search"]')).toBeNull();
    });

    it('opens with cmd+F when the viewer has focus', async () => {
        $(element, '.scroller').focus();
        key(document.body, { key: 'f', metaKey: true });
        await tick();
        expect($(element, '[role="search"]')).not.toBeNull();
    });

    it('closes with Escape, clears marks and returns focus', async () => {
        await open();
        await typeFind(element, 'a');
        expect($(element, 'mark')).not.toBeNull();
        key(document.body, { key: 'Escape' });
        await tick();
        expect($(element, '[role="search"]')).toBeNull();
        expect($(element, 'mark')).toBeNull();
        expect($(element, 'code').textContent).toBe(CODE);
        expect(element.shadowRoot.activeElement).toBe($(element, '.scroller'));
    });

    it('Escape does nothing when no bar is open', async () => {
        hover(element);
        const event = key(document.body, { key: 'Escape' });
        expect(event.defaultPrevented).toBe(false);
    });

    it('closes via the close button', async () => {
        await open();
        $(element, '[aria-label="Close find bar"]').click();
        await tick();
        expect($(element, '[role="search"]')).toBeNull();
    });

    it('highlights case-insensitive matches and shows n of m', async () => {
        await open();
        await typeFind(element, 'a');
        const expected = CODE.match(/a/gi).length;
        expect(
            element.shadowRoot.querySelectorAll('mark.find-match')
        ).toHaveLength(expected);
        expect(status(element)).toBe(`1 of ${expected}`);
        expect(element.shadowRoot.querySelectorAll('mark.active')).toHaveLength(
            1
        );
        expect($(element, 'code').textContent).toBe(CODE);
    });

    it('keeps syntax highlighting while marking', async () => {
        await open();
        await typeFind(element, 'onst');
        const keyword = $(element, '.hljs-keyword');
        expect(keyword.textContent).toBe('const');
        expect(keyword.querySelector('mark').textContent).toBe('onst');
    });

    it('shows No results and disables navigation', async () => {
        await open();
        await typeFind(element, 'zzz');
        expect(status(element)).toBe('No results');
        expect($(element, '[aria-label="Next match"]').disabled).toBe(true);
        expect($(element, 'mark')).toBeNull();
    });

    it('clearing the query removes marks', async () => {
        await open();
        await typeFind(element, 'const');
        await typeFind(element, '');
        expect($(element, 'mark')).toBeNull();
        expect(status(element)).toBe('');
    });

    it('navigates with Enter, Shift+Enter and the buttons, wrapping around', async () => {
        await open();
        await typeFind(element, 'const');
        const field = $(element, '[aria-label="Find in file"]');
        expect(status(element)).toBe('1 of 2');
        key(field, { key: 'Enter' });
        await tick();
        expect(status(element)).toBe('2 of 2');
        key(field, { key: 'Enter' });
        await tick();
        expect(status(element)).toBe('1 of 2');
        key(field, { key: 'Enter', shiftKey: true });
        await tick();
        expect(status(element)).toBe('2 of 2');
        $(element, '[aria-label="Next match"]').click();
        await tick();
        expect(status(element)).toBe('1 of 2');
        $(element, '[aria-label="Previous match"]').click();
        await tick();
        expect(status(element)).toBe('2 of 2');
        const active = element.shadowRoot.querySelectorAll('mark.active');
        expect(active).toHaveLength(1);
        expect(active[0].closest('.hljs-keyword')).not.toBeNull();
    });

    it('ignores other keys in the find input', async () => {
        await open();
        await typeFind(element, 'const');
        key($(element, '[aria-label="Find in file"]'), { key: 'x' });
        await tick();
        expect(status(element)).toBe('1 of 2');
    });

    it('scrolls the active match into view', async () => {
        await open();
        const scroller = $(element, '.scroller');
        const spy = jest
            .spyOn(Element.prototype, 'getBoundingClientRect')
            .mockImplementation(function () {
                return this.tagName === 'MARK'
                    ? { top: 500, bottom: 520, left: 50, right: 80, height: 20 }
                    : { top: 0, bottom: 100, left: 0, right: 400, height: 100 };
            });
        await typeFind(element, 'const');
        spy.mockRestore();
        expect(scroller.scrollTop).toBe(500 - 40);
    });

    it('scrolls horizontally when the match is off to the right', async () => {
        await open();
        const scroller = $(element, '.scroller');
        const spy = jest
            .spyOn(Element.prototype, 'getBoundingClientRect')
            .mockImplementation(function () {
                return this.tagName === 'MARK'
                    ? { top: 10, bottom: 30, left: 700, right: 740, height: 20 }
                    : { top: 0, bottom: 100, left: 0, right: 400, height: 100 };
            });
        await typeFind(element, 'const');
        spy.mockRestore();
        expect(scroller.scrollLeft).toBe(740 - 400 + 24);
    });

    it('Enter with a pending debounce applies the search without advancing', async () => {
        await open();
        const field = input(element, 'Find in file', 'const');
        key(field, { key: 'Enter' });
        await tick();
        expect(status(element)).toBe('1 of 2');
    });

    it('debounces input', async () => {
        await open();
        input(element, 'Find in file', 'c');
        jest.advanceTimersByTime(50);
        await tick();
        expect($(element, 'mark')).toBeNull();
        jest.advanceTimersByTime(200);
        await tick();
        expect($(element, 'mark')).not.toBeNull();
    });

    it('caps matches at 2000 and shows a plus', async () => {
        element.code = 'a\n'.repeat(3000);
        await tick();
        await open();
        await typeFind(element, 'a');
        expect(element.shadowRoot.querySelectorAll('mark')).toHaveLength(2000);
        expect(status(element)).toBe('1 of 2000+');
    });

    it('never interprets the query or source as markup', async () => {
        const evil = '<img src=x onerror=alert(1)> <b>';
        element.code = evil;
        await tick();
        await open();
        await typeFind(element, '<img src');
        expect($(element, 'code img')).toBeNull();
        expect($(element, 'code b')).toBeNull();
        expect($(element, 'mark').textContent).toBe('<img src');
        await typeFind(element, '<b>');
        expect($(element, 'code b')).toBeNull();
        expect($(element, 'code').textContent).toBe(evil);
    });

    it('resets search state when the source changes', async () => {
        await open();
        await typeFind(element, 'const');
        element.code = 'other file';
        await tick();
        expect($(element, '[role="search"]')).toBeNull();
        expect($(element, 'mark')).toBeNull();
        expect($(element, 'code').textContent).toBe('other file');
        await open();
        expect($(element, '[aria-label="Find in file"]').value).toBe('');
    });

    it('re-applies an open search when only the file name changes', async () => {
        await open();
        await typeFind(element, 'const');
        element.fileName = 'x.css';
        await tick();
        expect($(element, 'mark')).not.toBeNull();
        expect(status(element)).toBe('1 of 2');
    });

    it('re-focuses an already open find bar on ctrl+F', async () => {
        await open();
        $(element, '.scroller').focus();
        key(document.body, { key: 'f', ctrlKey: true });
        await tick();
        expect(element.shadowRoot.activeElement).toBe(
            $(element, '[aria-label="Find in file"]')
        );
    });

    it('stops listening once removed from the page', () => {
        hover(element);
        document.body.removeChild(element);
        const event = key(document.body, { key: 'f', ctrlKey: true });
        expect(event.defaultPrevented).toBe(false);
    });

    it('exposes labelled controls', async () => {
        await open();
        expect($(element, '[role="search"]').getAttribute('aria-label')).toBe(
            'Find'
        );
        expect(
            $(element, '.scroller').getAttribute('aria-keyshortcuts')
        ).toContain('Control+F');
        expect($(element, '[aria-live="polite"]')).not.toBeNull();
    });

    it('toggles word wrap', async () => {
        const button = $(element, '.wrap-btn');
        const scroller = () => $(element, '.scroller');
        expect(button.getAttribute('aria-pressed')).toBe('false');
        expect(scroller().classList.contains('wrapped')).toBe(false);
        button.click();
        await tick();
        expect(button.getAttribute('aria-pressed')).toBe('true');
        expect(scroller().classList.contains('wrapped')).toBe(true);
        button.click();
        await tick();
        expect(scroller().classList.contains('wrapped')).toBe(false);
    });

    describe('go to line', () => {
        const openGoto = async () => {
            hover(element);
            const event = key(document.body, { key: 'g', ctrlKey: true });
            await tick();
            return event;
        };
        const go = async (value) => {
            const field = input(element, 'Go to line', value);
            key(field, { key: 'Enter' });
            await tick();
        };

        it('opens with ctrl+G, focuses the input, and replaces find', async () => {
            await open();
            const event = await openGoto();
            expect(event.defaultPrevented).toBe(true);
            const field = $(element, '[aria-label="Go to line"]');
            expect(element.shadowRoot.activeElement).toBe(field);
            expect($(element, '[role="search"]')).toBeNull();
            expect(field.getAttribute('aria-invalid')).toBe('false');
        });

        it('opens with cmd+G', async () => {
            hover(element);
            key(document.body, { key: 'g', metaKey: true });
            await tick();
            expect($(element, '[aria-label="Go to line"]')).not.toBeNull();
        });

        it('scrolls to and flashes the line', async () => {
            await openGoto();
            const scroller = $(element, '.scroller');
            const spy = jest
                .spyOn(Element.prototype, 'getBoundingClientRect')
                .mockReturnValue({ top: 0, height: 100 });
            await go('3');
            spy.mockRestore();
            // top = 12 + 2 * 20.15, aligned a third of the way down
            expect(scroller.scrollTop).toBeCloseTo(52.3 - (100 - 20.15) / 3, 1);
            const flash = $(element, '.line-flash');
            expect(flash.className).toMatch(/flash-[ab]/);
            expect(flash.getAttribute('style')).toContain('top: 52.3');
            expect($(element, '[aria-label="Go to line"]')).toBeNull();
            expect(element.shadowRoot.activeElement).toBe(scroller);
            jest.advanceTimersByTime(1500);
            await tick();
            expect($(element, '.line-flash').className).toBe('line-flash');
        });

        it('alternates the flash animation on repeat', async () => {
            await openGoto();
            await go('2');
            const first = $(element, '.line-flash').className;
            await openGoto();
            await go('2');
            expect($(element, '.line-flash').className).not.toBe(first);
        });

        it('clamps lines beyond the end', async () => {
            await openGoto();
            await go('999');
            const top = parseFloat(
                $(element, '.line-flash')
                    .getAttribute('style')
                    .match(/top: ([\d.]+)px/)[1]
            );
            expect(top).toBeCloseTo(12 + 3 * 20.15, 2);
        });

        it('works while word wrap is on', async () => {
            $(element, '.wrap-btn').click();
            await tick();
            await openGoto();
            await go('2');
            expect($(element, '.line-flash').className).toMatch(/flash-/);
        });

        it('rejects invalid input and keeps the bar open', async () => {
            await openGoto();
            await go('0');
            const field = $(element, '[aria-label="Go to line"]');
            expect(field).not.toBeNull();
            expect(field.getAttribute('aria-invalid')).toBe('true');
            await go('abc');
            expect($(element, '[aria-label="Go to line"]')).not.toBeNull();
            expect($(element, '.line-flash').className).toBe('line-flash');
        });

        it('ignores other keys', async () => {
            await openGoto();
            key($(element, '[aria-label="Go to line"]'), { key: 'a' });
            await tick();
            expect($(element, '[aria-label="Go to line"]')).not.toBeNull();
        });

        it('closes with Escape', async () => {
            await openGoto();
            key(document.body, { key: 'Escape' });
            await tick();
            expect($(element, '[aria-label="Go to line"]')).toBeNull();
        });

        it('closes via the close button', async () => {
            await openGoto();
            $(element, '[aria-label="Close go to line"]').click();
            await tick();
            expect($(element, '[aria-label="Go to line"]')).toBeNull();
        });
    });
});
