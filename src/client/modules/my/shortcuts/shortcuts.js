import { LightningElement } from 'lwc';

/**
 * Global keyboard shortcuts and help overlay.
 *
 * Documented CustomEvents (composed, bubbles) dispatched on `document`:
 *   lwci:focus-search  '/'  focus the component search input
 *   lwci:prev-tab      '['  previous file tab in the open component
 *   lwci:next-tab      ']'  next file tab in the open component
 *   lwci:copy-source   'c'  copy the current source
 *   lwci:toggle-focus  'f'  toggle focus mode (hide chrome, widen source)
 * '?' toggles the cheat-sheet dialog owned by this module.
 */
export const SHORTCUTS = [
    {
        key: '/',
        description: 'Focus component search',
        event: 'lwci:focus-search'
    },
    { key: '[', description: 'Previous file tab', event: 'lwci:prev-tab' },
    { key: ']', description: 'Next file tab', event: 'lwci:next-tab' },
    { key: 'c', description: 'Copy current source', event: 'lwci:copy-source' },
    { key: 'f', description: 'Toggle focus mode', event: 'lwci:toggle-focus' },
    { key: 'Ctrl/Cmd+K', description: 'Open command palette' },
    { key: '?', description: 'Show or hide this help' },
    { key: 'Esc', description: 'Close this help' }
];

const FOCUSABLE =
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

function isTyping(event) {
    const path = event.composedPath ? event.composedPath() : [event.target];
    return path.some((node) => {
        if (!node || node.nodeType !== 1) return false;
        const tag = node.tagName;
        return (
            tag === 'INPUT' ||
            tag === 'TEXTAREA' ||
            tag === 'SELECT' ||
            node.isContentEditable === true ||
            node.getAttribute?.('contenteditable') === 'true'
        );
    });
}

export default class Shortcuts extends LightningElement {
    open = false;
    shortcuts = SHORTCUTS;
    _previousFocus = null;
    _focusedDialog = false;

    connectedCallback() {
        this._onKeydown = (event) => this.handleKeydown(event);
        document.addEventListener('keydown', this._onKeydown);
        this._onShow = () => !this.open && this.openHelp();
        document.addEventListener('lwci:show-shortcuts', this._onShow);
    }

    disconnectedCallback() {
        document.removeEventListener('keydown', this._onKeydown);
        document.removeEventListener('lwci:show-shortcuts', this._onShow);
    }

    renderedCallback() {
        if (this.open && !this._focusedDialog) {
            this._focusedDialog = true;
            this.template.querySelector('.close-button')?.focus();
        }
    }

    handleKeydown(event) {
        if (this.open) {
            if (event.key === 'Escape') {
                event.preventDefault();
                this.closeHelp();
            } else if (event.key === 'Tab') {
                this.trapFocus(event);
            } else if (event.key === '?') {
                event.preventDefault();
                this.closeHelp();
            }
            return;
        }
        if (
            event.defaultPrevented ||
            event.ctrlKey ||
            event.metaKey ||
            event.altKey
        ) {
            return;
        }
        if (isTyping(event)) return;
        if (event.key === '?') {
            event.preventDefault();
            this.openHelp();
            return;
        }
        const match = SHORTCUTS.find((s) => s.event && s.key === event.key);
        if (match) {
            event.preventDefault();
            document.dispatchEvent(
                new CustomEvent(match.event, { bubbles: true, composed: true })
            );
        }
    }

    trapFocus(event) {
        const items = [...this.template.querySelectorAll(FOCUSABLE)];
        if (items.length === 0) return;
        const first = items[0];
        const last = items[items.length - 1];
        const active = this.template.activeElement;
        if (event.shiftKey && (active === first || !active)) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && (active === last || !active)) {
            event.preventDefault();
            first.focus();
        }
    }

    openHelp() {
        let active = document.activeElement;
        while (active?.shadowRoot?.activeElement) {
            active = active.shadowRoot.activeElement;
        }
        this._previousFocus = active;
        this._focusedDialog = false;
        this.open = true;
    }

    closeHelp() {
        this.open = false;
        this._focusedDialog = false;
        const target = this._previousFocus;
        this._previousFocus = null;
        if (target && typeof target.focus === 'function') target.focus();
    }

    toggleHelp() {
        if (this.open) this.closeHelp();
        else this.openHelp();
    }

    handleBackdropClick(event) {
        if (event.target === event.currentTarget) this.closeHelp();
    }
}
