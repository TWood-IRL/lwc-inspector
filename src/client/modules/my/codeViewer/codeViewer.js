import { LightningElement, api } from 'lwc';
import {
    highlight,
    languageFor,
    LANGUAGE_LABELS,
    findMatches,
    wrapMatches,
    lineStartOffset,
    MAX_MATCHES
} from './highlight';
import {
    SYNTAX_THEMES,
    TAB_WIDTHS,
    LINE_HEIGHTS,
    FONT_SIZE_MIN,
    FONT_SIZE_MAX,
    getPrefs,
    setPrefs,
    resetPrefs,
    stepFontSize,
    resetFontSize,
    subscribe,
    lineHeightMultiplier
} from 'my/viewerPrefs';

const SEARCH_DEBOUNCE_MS = 150;
const FLASH_MS = 1200;
const FALLBACK_PADDING_TOP = 12; // 0.75rem
const SCROLL_MARGIN = 24;

// Computed lengths come back in px in browsers; anything else is unusable
const px = (value, fallback) => {
    return /px$/.test(value || '') ? parseFloat(value) : fallback;
};

/**
 * Read-only, editor-style view of a source file: line numbers, syntax
 * highlighting, find-in-file, go-to-line, word wrap and a status bar.
 */
export default class CodeViewer extends LightningElement {
    @api fileName = '';
    @api format = '';

    _code = '';

    findOpen = false;
    gotoOpen = false;
    query = '';
    matchCount = 0;
    truncated = false;
    activeIndex = -1;
    wrapped = getPrefs().wordWrap;
    prefs = getPrefs();
    prefsOpen = false;
    siteTheme = 'dark';
    currentLine = 0;
    currentTop = 0;
    currentHeight = 0;
    gotoValue = '';
    gotoInvalid = false;
    flashVisible = false;
    flashPhase = false;
    flashTop = 0;
    flashHeight = 0;

    renderedKey;
    highlightedKey;
    highlightedHtml = '';
    groups = [];
    hovered = false;
    focused = false;
    pendingFocus;
    prefsKey;
    debounceTimer;
    flashTimer;

    @api
    get code() {
        return this._code;
    }
    set code(value) {
        const next = value || '';
        if (next !== this._code) {
            this._code = next;
            this.resetSearch();
        }
    }

    get language() {
        return languageFor(this.fileName, this.format);
    }
    get languageLabel() {
        return LANGUAGE_LABELS[this.language];
    }
    get lineCount() {
        return this._code.split('\n').length;
    }
    // One block of text, one number per line, so large files stay cheap to render
    get lineNumbers() {
        return Array.from({ length: this.lineCount }, (_, i) => i + 1).join(
            '\n'
        );
    }
    get stats() {
        const lines = this.lineCount;
        return `${lines} ${lines === 1 ? 'line' : 'lines'} · ${this._code.length} characters`;
    }
    get ariaLabel() {
        return `Source of ${this.fileName}`;
    }
    get scrollerClass() {
        const classes = ['scroller'];
        if (this.wrapped) {
            classes.push('wrapped');
        }
        if (!this.prefs.lineNumbers) {
            classes.push('no-gutter');
        }
        return classes.join(' ');
    }
    get effectiveTheme() {
        const theme = this.prefs.syntaxTheme;
        if (theme === 'auto') {
            return this.siteTheme === 'light' ? 'paper' : 'midnight';
        }
        return theme;
    }
    get fontSizeLabel() {
        return `${this.prefs.fontSize} px`;
    }
    get atMinFont() {
        return this.prefs.fontSize <= FONT_SIZE_MIN;
    }
    get atMaxFont() {
        return this.prefs.fontSize >= FONT_SIZE_MAX;
    }
    get prefsExpanded() {
        return this.prefsOpen ? 'true' : 'false';
    }
    get syntaxOptions() {
        return this.radios(
            'syntaxTheme',
            SYNTAX_THEMES.map((t) => [t.value, t.label])
        );
    }
    get tabOptions() {
        return this.radios(
            'tabWidth',
            TAB_WIDTHS.map((w) => [w, `${w}`])
        );
    }
    get lineHeightOptions() {
        return this.radios(
            'lineHeight',
            Object.keys(LINE_HEIGHTS).map((k) => [
                k,
                k.charAt(0).toUpperCase() + k.slice(1)
            ])
        );
    }
    get lineNumbersChecked() {
        return this.prefs.lineNumbers;
    }
    get wordWrapChecked() {
        return this.prefs.wordWrap;
    }
    get highlightLineChecked() {
        return this.prefs.highlightLine;
    }
    get currentLineClass() {
        return this.currentLine && this.prefs.highlightLine
            ? 'line-current visible'
            : 'line-current';
    }
    get currentLineStyle() {
        return `top: ${this.currentTop}px; height: ${this.currentHeight}px;`;
    }

    radios(pref, entries) {
        const value = this.prefs[pref];
        return entries.map(([v, label]) => ({
            key: `${pref}-${v}`,
            pref,
            value: String(v),
            label,
            checked: v === value
        }));
    }
    get wrapPressed() {
        return this.wrapped ? 'true' : 'false';
    }
    get noMatches() {
        return this.matchCount === 0;
    }
    get countLabel() {
        if (!this.query) {
            return '';
        }
        if (!this.matchCount) {
            return 'No results';
        }
        return `${this.activeIndex + 1} of ${this.matchCount}${this.truncated ? '+' : ''}`;
    }
    get gotoInvalidAttr() {
        return this.gotoInvalid ? 'true' : 'false';
    }
    get gotoHint() {
        return this.gotoInvalid
            ? `Enter a line from 1 to ${this.lineCount}`
            : `1 - ${this.lineCount}`;
    }
    get flashClass() {
        if (!this.flashVisible) {
            return 'line-flash';
        }
        return this.flashPhase ? 'line-flash flash-a' : 'line-flash flash-b';
    }
    get flashStyle() {
        return `top: ${this.flashTop}px; height: ${this.flashHeight}px;`;
    }

    connectedCallback() {
        this.prefs = getPrefs();
        this.wrapped = this.prefs.wordWrap;
        this.unsubscribePrefs = subscribe((next) =>
            this.handlePrefsChange(next)
        );
        this.watchSiteTheme();
        this.clickHandler = (event) => this.handleDocumentClick(event);
        document.addEventListener('click', this.clickHandler);
        this.keyHandler = (event) => this.handleDocumentKeydown(event);
        document.addEventListener('keydown', this.keyHandler);
        this.template.addEventListener('focusin', () => {
            this.focused = true;
        });
        this.template.addEventListener('focusout', (event) => {
            // Moving focus between controls inside the viewer is not leaving
            if (!event.relatedTarget) {
                this.focused = false;
            }
        });
        this.template.host.addEventListener('mouseenter', () => {
            this.hovered = true;
        });
        this.template.host.addEventListener('mouseleave', () => {
            this.hovered = false;
        });
    }

    disconnectedCallback() {
        document.removeEventListener('keydown', this.keyHandler);
        document.removeEventListener('click', this.clickHandler);
        if (this.unsubscribePrefs) {
            this.unsubscribePrefs();
            this.unsubscribePrefs = undefined;
        }
        if (this.themeObserver) {
            this.themeObserver.disconnect();
            this.themeObserver = undefined;
        }
        clearTimeout(this.debounceTimer);
        clearTimeout(this.flashTimer);
    }

    renderedCallback() {
        this.applyHostPrefs();
        const code = this._code;
        const key = `${this.language}:${code}`;
        if (key !== this.renderedKey) {
            this.renderedKey = key;
            this.groups = [];
            // highlight() returns HTML-escaped markup, so this is safe to insert
            // eslint-disable-next-line @lwc/lwc/no-inner-html
            this.refs.code.innerHTML = this.highlighted();
            // Same language, new file name, etc: keep an open search live
            if (this.query) {
                this.runSearch(false);
            }
        }
        this.syncCurrentLine();
        if (this.pendingFocus) {
            const input = this.refs[this.pendingFocus];
            this.pendingFocus = undefined;
            if (input) {
                input.focus();
                if (typeof input.select === 'function') {
                    input.select();
                }
            }
        }
    }

    highlighted() {
        const key = `${this.language}:${this._code}`;
        if (key !== this.highlightedKey) {
            this.highlightedKey = key;
            this.highlightedHtml = highlight(this._code, this.language);
        }
        return this.highlightedHtml;
    }

    // ---- preferences ----

    watchSiteTheme() {
        const root = document.documentElement;
        const read = () => {
            const theme =
                root.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
            if (theme !== this.siteTheme) {
                this.siteTheme = theme;
            }
        };
        read();
        if (typeof MutationObserver === 'function') {
            this.themeObserver = new MutationObserver(read);
            this.themeObserver.observe(root, {
                attributes: true,
                attributeFilter: ['data-theme']
            });
        }
    }

    // Palette, font metrics and tab width are CSS custom properties on the
    // host (and a data-syntax attribute the palettes key off)
    applyHostPrefs() {
        const host = this.template.host;
        const { fontSize, tabWidth, lineHeight } = this.prefs;
        const values = {
            '--cv-font-size': `${fontSize}px`,
            '--cv-line-height': String(lineHeightMultiplier(lineHeight)),
            '--cv-tab-size': String(tabWidth)
        };
        for (const name of Object.keys(values)) {
            if (host.style.getPropertyValue(name) !== values[name]) {
                host.style.setProperty(name, values[name]);
            }
        }
        if (host.getAttribute('data-syntax') !== this.effectiveTheme) {
            host.setAttribute('data-syntax', this.effectiveTheme);
        }
    }

    handlePrefsChange(next) {
        if (next.wordWrap !== this.prefs.wordWrap) {
            this.wrapped = next.wordWrap;
        }
        this.prefs = next;
    }

    handleZoomKey(event) {
        const key = event.key;
        if (key === '+' || key === '=') {
            stepFontSize(1);
        } else if (key === '-' || key === '_') {
            stepFontSize(-1);
        } else if (key === '0') {
            resetFontSize();
        } else {
            return false;
        }
        event.preventDefault();
        return true;
    }

    togglePrefs() {
        if (this.prefsOpen) {
            this.closePrefs(true);
        } else {
            this.prefsOpen = true;
            this.pendingFocus = 'fontDown';
        }
    }

    closePrefs(restoreFocus) {
        if (!this.prefsOpen) {
            return;
        }
        this.prefsOpen = false;
        if (restoreFocus && this.refs.prefsButton) {
            this.refs.prefsButton.focus();
        }
    }

    handlePrefsKeydown(event) {
        if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            this.closePrefs(true);
        }
    }

    // Non-modal: clicking outside the popover and its button closes it
    handleDocumentClick(event) {
        if (!this.prefsOpen) {
            return;
        }
        const path = event.composedPath ? event.composedPath() : [];
        const inside = path.some(
            (n) => n === this.refs.prefsPopover || n === this.refs.prefsButton
        );
        if (!inside) {
            this.closePrefs(false);
        }
    }

    handleFontDown() {
        stepFontSize(-1);
    }
    handleFontUp() {
        stepFontSize(1);
    }
    handleRadio(event) {
        const { pref, value } = event.target.dataset;
        setPrefs({ [pref]: pref === 'tabWidth' ? Number(value) : value });
    }
    handleToggle(event) {
        setPrefs({ [event.target.dataset.pref]: event.target.checked });
    }
    handlePrefsReset() {
        resetPrefs();
    }

    // ---- current line ----

    handleCodeClick(event) {
        if (!this.prefs.highlightLine) {
            return;
        }
        const selection = window.getSelection && window.getSelection();
        if (selection && !selection.isCollapsed) {
            return; // selecting text, not placing the caret
        }
        const line =
            this.lineFromSelection(selection) || this.lineFromPoint(event);
        if (line) {
            this.currentLine = Math.min(line, this.lineCount);
            this.syncCurrentLine(true);
        }
    }

    lineFromSelection(selection) {
        const codeEl = this.refs.code;
        const node = selection && selection.anchorNode;
        if (!node || !codeEl || !codeEl.contains(node)) {
            return 0;
        }
        const walker = document.createTreeWalker(codeEl, 4);
        let offset = 0;
        for (let n = walker.nextNode(); n; n = walker.nextNode()) {
            if (n === node) {
                const before = this._code.slice(
                    0,
                    offset + selection.anchorOffset
                );
                return before.split('\n').length;
            }
            offset += n.nodeValue.length;
        }
        return 0;
    }

    // Without a caret position, work the line out from the pointer (unwrapped
    // text only, where every line is one row tall)
    lineFromPoint(event) {
        if (this.wrapped || !event || !this.refs.code) {
            return 0;
        }
        const area = this.template.querySelector('.code-area');
        const { top: first, height } = this.lineMetrics(1);
        const y = event.clientY - area.getBoundingClientRect().top - first;
        return Math.max(1, Math.floor(y / height) + 1);
    }

    // Reposition the current-line band when anything affecting metrics changed
    syncCurrentLine(force) {
        if (!this.currentLine || !this.refs.code) {
            return;
        }
        const key = [
            this.prefs.fontSize,
            this.prefs.lineHeight,
            this.prefs.tabWidth,
            this.prefs.lineNumbers,
            this.wrapped,
            this.currentLine,
            this._code.length
        ].join('|');
        if (!force && key === this.prefsKey) {
            return;
        }
        this.prefsKey = key;
        const { top, height } = this.lineMetrics(this.currentLine);
        if (top !== this.currentTop || height !== this.currentHeight) {
            this.currentTop = top;
            this.currentHeight = height;
        }
    }

    // ---- state ----

    resetSearch() {
        clearTimeout(this.debounceTimer);
        clearTimeout(this.flashTimer);
        this.debounceTimer = undefined;
        this.findOpen = false;
        this.gotoOpen = false;
        this.query = '';
        this.matchCount = 0;
        this.truncated = false;
        this.activeIndex = -1;
        this.groups = [];
        this.gotoValue = '';
        this.gotoInvalid = false;
        this.flashVisible = false;
        this.currentLine = 0;
        this.prefsOpen = false;
    }

    // ---- keyboard ----

    handleDocumentKeydown(event) {
        if (!this.hovered && !this.focused) {
            return;
        }
        if (event.key === 'Escape') {
            if (this.prefsOpen) {
                event.preventDefault();
                this.closePrefs(true);
                return;
            }
            if (this.findOpen || this.gotoOpen) {
                event.preventDefault();
                this.closeBars();
            }
            return;
        }
        if (!(event.ctrlKey || event.metaKey) || event.altKey) {
            return;
        }
        // Shift is allowed here: "+" is Shift+= on most layouts
        if (this.handleZoomKey(event)) {
            return;
        }
        if (event.shiftKey) {
            return;
        }
        const key = (event.key || '').toLowerCase();
        if (key === 'f') {
            event.preventDefault();
            this.openFind();
        } else if (key === 'g') {
            event.preventDefault();
            this.openGoto();
        }
    }

    openFind() {
        this.gotoOpen = false;
        this.findOpen = true;
        this.pendingFocus = 'findInput';
        // Already open: renderedCallback will not run, so focus directly
        if (this.refs.findInput) {
            this.pendingFocus = undefined;
            this.refs.findInput.focus();
            this.refs.findInput.select();
        }
    }

    openGoto() {
        this.clearSearchMarks();
        this.findOpen = false;
        this.gotoOpen = true;
        this.gotoInvalid = false;
        this.pendingFocus = 'gotoInput';
        if (this.refs.gotoInput) {
            this.pendingFocus = undefined;
            this.refs.gotoInput.focus();
            this.refs.gotoInput.select();
        }
    }

    closeBars() {
        const hadFocusInside = this.findOpen || this.gotoOpen;
        clearTimeout(this.debounceTimer);
        this.debounceTimer = undefined;
        this.clearSearchMarks();
        this.findOpen = false;
        this.gotoOpen = false;
        this.query = '';
        this.gotoValue = '';
        this.gotoInvalid = false;
        if (hadFocusInside && this.refs.scroller) {
            this.refs.scroller.focus();
        }
    }

    handleWrapToggle() {
        this.wrapped = !this.wrapped;
    }

    // ---- find ----

    handleFindInput(event) {
        this.query = event.target.value;
        clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(() => {
            this.debounceTimer = undefined;
            this.runSearch(true);
        }, SEARCH_DEBOUNCE_MS);
    }

    handleFindKeydown(event) {
        if (event.key !== 'Enter') {
            return;
        }
        event.preventDefault();
        if (this.debounceTimer) {
            // Search text changed but not yet applied: apply and show first hit
            clearTimeout(this.debounceTimer);
            this.debounceTimer = undefined;
            this.runSearch(true);
        } else if (event.shiftKey) {
            this.handlePrev();
        } else {
            this.handleNext();
        }
    }

    handleNext() {
        this.step(1);
    }

    handlePrev() {
        this.step(-1);
    }

    step(direction) {
        if (!this.matchCount) {
            return;
        }
        this.setActive(
            (this.activeIndex + direction + this.matchCount) % this.matchCount
        );
    }

    clearSearchMarks() {
        if (this.groups.length && this.refs.code) {
            // Re-render from the cached, escaped highlight output
            // eslint-disable-next-line @lwc/lwc/no-inner-html
            this.refs.code.innerHTML = this.highlighted();
        }
        this.groups = [];
        this.matchCount = 0;
        this.activeIndex = -1;
        this.truncated = false;
    }

    runSearch(scroll) {
        const codeEl = this.refs.code;
        if (!codeEl) {
            return;
        }
        this.clearSearchMarks();
        const { matches, truncated } = findMatches(
            this._code,
            this.query,
            MAX_MATCHES
        );
        this.truncated = truncated;
        this.matchCount = matches.length;
        if (!matches.length) {
            return;
        }
        this.groups = wrapMatches(codeEl, matches);
        this.setActive(0, scroll);
    }

    setActive(index, scroll = true) {
        const previous = this.groups[this.activeIndex];
        if (previous) {
            previous.forEach((m) => m.classList.remove('active'));
        }
        this.activeIndex = index;
        const current = this.groups[index];
        if (!current || !current.length) {
            return;
        }
        current.forEach((m) => m.classList.add('active'));
        if (scroll) {
            this.scrollToRect(current[0].getBoundingClientRect(), true);
        }
    }

    // Keep a rect (viewport coordinates) comfortably visible in the scroller
    scrollToRect(rect, centre) {
        const scroller = this.refs.scroller;
        if (!scroller) {
            return;
        }
        const box = scroller.getBoundingClientRect();
        const gutter = this.wrapped
            ? 0
            : this.template.querySelector('.gutter').offsetWidth || 0;
        if (rect.top < box.top || rect.bottom > box.bottom) {
            const delta = centre
                ? rect.top - box.top - (box.height - rect.height) / 2
                : rect.top - box.top - SCROLL_MARGIN;
            scroller.scrollTop += delta;
        }
        if (!this.wrapped) {
            if (rect.left < box.left + gutter + SCROLL_MARGIN) {
                scroller.scrollLeft -=
                    box.left + gutter + SCROLL_MARGIN - rect.left;
            } else if (rect.right > box.right - SCROLL_MARGIN) {
                scroller.scrollLeft += rect.right - box.right + SCROLL_MARGIN;
            }
        }
    }

    // ---- go to line ----

    handleGotoInput(event) {
        this.gotoValue = event.target.value;
        this.gotoInvalid = false;
    }

    handleGotoKeydown(event) {
        if (event.key !== 'Enter') {
            return;
        }
        event.preventDefault();
        const parsed = parseInt(event.target.value, 10);
        if (!Number.isFinite(parsed) || parsed < 1) {
            this.gotoInvalid = true;
            return;
        }
        const line = Math.min(parsed, this.lineCount);
        this.closeBars();
        this.goToLine(line);
    }

    // Public so the insights panel can jump to a line (see webExplorer)
    @api
    goToLine(line) {
        const scroller = this.refs.scroller;
        const codeEl = this.refs.code;
        const area = this.template.querySelector('.code-area');
        if (!scroller || !codeEl || !area) {
            return;
        }
        const { top, height } = this.lineMetrics(line);
        this.flashTop = top;
        this.flashHeight = height;
        // Alternate between two identical animations so flashing the same
        // line twice restarts it
        this.flashPhase = !this.flashPhase;
        this.flashVisible = true;
        clearTimeout(this.flashTimer);
        this.flashTimer = setTimeout(() => {
            this.flashVisible = false;
        }, FLASH_MS);
        const box = scroller.getBoundingClientRect();
        const target = top - (box.height - height) / 3;
        scroller.scrollTop = Math.max(0, target);
        scroller.scrollLeft = 0;
    }

    // Top and height of a line inside .code-area. Line height is read from the
    // rendered DOM (it depends on the font size and line height preferences),
    // never from constants; the fallback only applies where there is no layout.
    lineMetrics(line) {
        const codeEl = this.refs.code;
        const area = this.template.querySelector('.code-area');
        const style = window.getComputedStyle(codeEl.parentNode);
        const fallback =
            this.prefs.fontSize * lineHeightMultiplier(this.prefs.lineHeight);
        const lineHeight = px(style.lineHeight, fallback);
        const paddingTop = px(style.paddingTop, FALLBACK_PADDING_TOP);
        let top = paddingTop + (line - 1) * lineHeight;
        let height = lineHeight;
        if (this.wrapped) {
            // Wrapped lines have variable height, so measure the real text
            const rect = this.measureLine(line);
            if (rect) {
                top = rect.top - area.getBoundingClientRect().top;
                height = rect.height || lineHeight;
            }
        }
        return { top, height };
    }

    measureLine(line) {
        const codeEl = this.refs.code;
        const offset = lineStartOffset(this._code, line);
        const walker = document.createTreeWalker(codeEl, 4);
        let seen = 0;
        for (let n = walker.nextNode(); n; n = walker.nextNode()) {
            const length = n.nodeValue.length;
            if (offset < seen + length) {
                const range = document.createRange();
                const at = offset - seen;
                range.setStart(n, at);
                range.setEnd(n, Math.min(at + 1, length));
                // Not implemented in every DOM (e.g. jsdom)
                if (typeof range.getBoundingClientRect !== 'function') {
                    return undefined;
                }
                const rect = range.getBoundingClientRect();
                return rect.height ? rect : undefined;
            }
            seen += length;
        }
        return undefined;
    }
}
