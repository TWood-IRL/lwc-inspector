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

const SEARCH_DEBOUNCE_MS = 150;
const FLASH_MS = 1200;
const FALLBACK_LINE_HEIGHT = 20.15; // 0.8125rem * 1.55 line-height
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
    wrapped = false;
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
        return this.wrapped ? 'scroller wrapped' : 'scroller';
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
        clearTimeout(this.debounceTimer);
        clearTimeout(this.flashTimer);
    }

    renderedCallback() {
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
        if (this.pendingFocus) {
            const input = this.refs[this.pendingFocus];
            this.pendingFocus = undefined;
            if (input) {
                input.focus();
                input.select();
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
    }

    // ---- keyboard ----

    handleDocumentKeydown(event) {
        if (!this.hovered && !this.focused) {
            return;
        }
        if (event.key === 'Escape') {
            if (this.findOpen || this.gotoOpen) {
                event.preventDefault();
                this.closeBars();
            }
            return;
        }
        if (
            !(event.ctrlKey || event.metaKey) ||
            event.altKey ||
            event.shiftKey
        ) {
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
        const pre = codeEl.parentNode;
        const style = window.getComputedStyle(pre);
        const lineHeight = px(style.lineHeight, FALLBACK_LINE_HEIGHT);
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
