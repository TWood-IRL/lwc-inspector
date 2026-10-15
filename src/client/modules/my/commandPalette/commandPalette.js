import { LightningElement } from 'lwc';
import { loadRecents } from 'my/navState';
import { applyTheme, nextTheme, storeTheme } from 'my/theme';
import { buildSections } from './items';
import { highlightSegments } from './fuzzy';

/**
 * Command palette (Ctrl/Cmd+K).
 *
 * Document CustomEvents (bubbles, composed):
 *   lwci:palette-request  dispatched on open, detail { respond(data) }.
 *       The owner (my-web-explorer) answers with
 *       { bundles:[{label,type}], files:[{type,bundle,file}], canCopySource }
 *   lwci:open-target      detail { type, bundle, file } open a component/file
 *   lwci:copy-source      copy the open file
 *   lwci:copy-link        copy a deep link
 *   lwci:show-shortcuts   open the keyboard shortcuts help
 *   lwci:theme-changed    detail { theme } after the palette switches theme
 */
const fire = (name, detail) =>
    document.dispatchEvent(
        new CustomEvent(name, { detail, bubbles: true, composed: true })
    );

function deepActiveElement() {
    let active = document.activeElement;
    while (active?.shadowRoot?.activeElement) {
        active = active.shadowRoot.activeElement;
    }
    return active;
}

export default class CommandPalette extends LightningElement {
    open = false;
    query = '';
    activeIndex = 0;
    _data = null;
    _flat = [];
    _groups = [];
    _previousFocus = null;
    _focusPending = false;
    _scrollPending = false;

    connectedCallback() {
        this._onKeydown = (event) => {
            if (
                (event.ctrlKey || event.metaKey) &&
                !event.altKey &&
                !event.shiftKey &&
                String(event.key).toLowerCase() === 'k'
            ) {
                event.preventDefault();
                this.toggle();
            }
        };
        document.addEventListener('keydown', this._onKeydown);
    }

    disconnectedCallback() {
        document.removeEventListener('keydown', this._onKeydown);
    }

    renderedCallback() {
        if (!this.open) return;
        if (this._focusPending) {
            this._focusPending = false;
            this.template.querySelector('input')?.focus();
        }
        if (this._scrollPending) {
            this._scrollPending = false;
            const el = this.template.querySelector('[aria-selected="true"]');
            if (el && typeof el.scrollIntoView === 'function') {
                el.scrollIntoView({ block: 'nearest' });
            }
        }
    }

    // --- public-ish API ------------------------------------------------

    toggle() {
        if (this.open) this.close();
        else this.show();
    }

    show() {
        if (this.open) return;
        this._previousFocus = deepActiveElement();
        this._data = { bundles: [], files: [], canCopySource: false };
        // Owner answers synchronously or later; either way we refresh
        fire('lwci:palette-request', {
            respond: (data) => {
                this._data = { ...this._data, ...data };
                if (this.open) this.refresh(false);
            }
        });
        this.query = '';
        this.open = true;
        this.refresh(true);
        this._focusPending = true;
    }

    close(restoreFocus = true) {
        this.open = false;
        this.query = '';
        this._flat = [];
        this._groups = [];
        const target = this._previousFocus;
        this._previousFocus = null;
        if (restoreFocus && target && typeof target.focus === 'function') {
            target.focus();
        }
    }

    // --- results -------------------------------------------------------

    refresh(resetActive) {
        const sections = buildSections(this._data, loadRecents(), this.query);
        let n = 0;
        this._flat = [];
        this._groups = sections.map((section) => ({
            id: section.id,
            label: section.label,
            items: section.items.map((item) => {
                const entry = { ...item, domId: `palette-opt-${n}`, index: n };
                n += 1;
                this._flat.push(entry);
                return entry;
            })
        }));
        if (resetActive || this.activeIndex >= this._flat.length) {
            this.activeIndex = 0;
        }
        this._scrollPending = true;
    }

    get groups() {
        return this._groups.map((group) => ({
            id: group.id,
            label: group.label,
            items: group.items.map((item) => {
                const active = item.index === this.activeIndex;
                return {
                    ...item,
                    segments: highlightSegments(item.label, item.indices).map(
                        (s) => ({
                            ...s,
                            className: s.match ? 'mark' : ''
                        })
                    ),
                    selected: active ? 'true' : 'false',
                    className: active ? 'option option-active' : 'option'
                };
            })
        }));
    }

    get noResults() {
        return this._flat.length === 0;
    }

    get hasResults() {
        return this._flat.length > 0;
    }

    get activeDescendant() {
        return this._flat[this.activeIndex]?.domId ?? null;
    }

    get statusText() {
        const count = this._flat.length;
        if (!count) return 'No results';
        return `${count} result${count === 1 ? '' : 's'}`;
    }

    get emptyText() {
        return `No matches for “${this.query.trim()}”`;
    }

    // --- events --------------------------------------------------------

    handleInput(event) {
        this.query = event.target.value;
        this.refresh(true);
    }

    handleKeydown(event) {
        const count = this._flat.length;
        switch (event.key) {
            case 'Escape':
                event.preventDefault();
                event.stopPropagation();
                this.close();
                break;
            case 'ArrowDown':
                event.preventDefault();
                this.move(1, count);
                break;
            case 'ArrowUp':
                event.preventDefault();
                this.move(-1, count);
                break;
            case 'Home':
                if (count && !this.query) {
                    event.preventDefault();
                    this.setActive(0);
                }
                break;
            case 'End':
                if (count && !this.query) {
                    event.preventDefault();
                    this.setActive(count - 1);
                }
                break;
            case 'Enter':
                event.preventDefault();
                if (!event.isComposing) this.run(this._flat[this.activeIndex]);
                break;
            case 'Tab':
                // Focus trap: the input is the only tab stop in the dialog
                event.preventDefault();
                this.template.querySelector('input')?.focus();
                break;
            default:
        }
    }

    move(delta, count) {
        if (!count) return;
        this.setActive((this.activeIndex + delta + count) % count);
    }

    setActive(index) {
        if (index === this.activeIndex) return;
        this.activeIndex = index;
        this._scrollPending = true;
    }

    handleOptionMove(event) {
        const index = Number(event.currentTarget.dataset.index);
        if (index !== this.activeIndex) this.activeIndex = index;
    }

    handleOptionClick(event) {
        event.preventDefault();
        this.run(this._flat[Number(event.currentTarget.dataset.index)]);
    }

    handleBackdropMousedown(event) {
        if (event.target === event.currentTarget) {
            event.preventDefault();
            this.close();
        }
    }

    // --- running -------------------------------------------------------

    run(item) {
        if (!item) return;
        // Close first so focus is restored before the action moves it
        this.close();
        const { payload } = item;
        switch (item.kind) {
            case 'component':
            case 'recent':
            case 'file':
                fire('lwci:open-target', {
                    type: payload.type,
                    bundle: payload.bundle,
                    file: payload.file ?? null
                });
                break;
            default:
                this.runAction(payload.action);
        }
    }

    runAction(action) {
        switch (action) {
            case 'toggle-theme': {
                const current =
                    document.documentElement.getAttribute('data-theme') ===
                    'dark'
                        ? 'dark'
                        : 'light';
                const theme = nextTheme(current);
                storeTheme(theme);
                applyTheme(theme);
                fire('lwci:theme-changed', { theme });
                break;
            }
            case 'copy-link':
                fire('lwci:copy-link');
                break;
            case 'copy-source':
                fire('lwci:copy-source');
                break;
            case 'show-shortcuts':
                fire('lwci:show-shortcuts');
                break;
            default:
        }
    }
}
