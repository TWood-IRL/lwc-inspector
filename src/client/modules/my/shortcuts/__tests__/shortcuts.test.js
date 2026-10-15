import { createElement } from 'lwc';
import Shortcuts from 'my/shortcuts';

const flush = () => Promise.resolve();
const press = (key, init = {}, target = document.body) => {
    const e = new KeyboardEvent('keydown', {
        key,
        bubbles: true,
        composed: true,
        cancelable: true,
        ...init
    });
    target.dispatchEvent(e);
    return e;
};

describe('my-shortcuts', () => {
    let el;
    beforeEach(() => {
        el = createElement('my-shortcuts', { is: Shortcuts });
        document.body.appendChild(el);
    });
    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
    });

    it.each([
        ['/', 'lwci:focus-search'],
        ['[', 'lwci:prev-tab'],
        [']', 'lwci:next-tab'],
        ['c', 'lwci:copy-source']
    ])('%s dispatches %s', (key, name) => {
        const handler = jest.fn();
        document.addEventListener(name, handler);
        press(key);
        document.removeEventListener(name, handler);
        expect(handler).toHaveBeenCalledTimes(1);
        expect(handler.mock.calls[0][0].bubbles).toBe(true);
        expect(handler.mock.calls[0][0].composed).toBe(true);
    });

    it('ignores keys while typing and with modifiers', () => {
        const handler = jest.fn();
        document.addEventListener('lwci:copy-source', handler);
        const input = document.createElement('input');
        document.body.appendChild(input);
        press('c', {}, input);
        const div = document.createElement('div');
        div.setAttribute('contenteditable', 'true');
        document.body.appendChild(div);
        press('c', {}, div);
        press('c', { ctrlKey: true });
        press('c', { metaKey: true });
        document.removeEventListener('lwci:copy-source', handler);
        expect(handler).not.toHaveBeenCalled();
    });

    it('opens an accessible dialog with ? and Escape closes and restores focus', async () => {
        const trigger = el.shadowRoot.querySelector('.trigger');
        trigger.focus();
        press('?');
        await flush();
        const dialog = el.shadowRoot.querySelector('[role="dialog"]');
        expect(dialog.getAttribute('aria-modal')).toBe('true');
        expect(dialog.getAttribute('aria-labelledby')).toBe(
            el.shadowRoot.querySelector('h2').id
        );
        expect(el.shadowRoot.querySelectorAll('li').length).toBeGreaterThan(4);

        press('Escape');
        await flush();
        expect(el.shadowRoot.querySelector('[role="dialog"]')).toBeNull();
        expect(el.shadowRoot.activeElement).toBe(trigger);
    });

    it('suppresses shortcuts while open and traps Tab', async () => {
        press('?');
        await flush();
        const handler = jest.fn();
        document.addEventListener('lwci:copy-source', handler);
        press('c');
        document.removeEventListener('lwci:copy-source', handler);
        expect(handler).not.toHaveBeenCalled();

        el.shadowRoot.querySelector('.close-button').focus();
        expect(press('Tab').defaultPrevented).toBe(true);
        expect(press('Tab', { shiftKey: true }).defaultPrevented).toBe(true);
    });

    it('trigger opens the dialog and close button closes it', async () => {
        el.shadowRoot.querySelector('.trigger').click();
        await flush();
        expect(el.shadowRoot.querySelector('[role="dialog"]')).not.toBeNull();
        el.shadowRoot.querySelector('.close-button').click();
        await flush();
        expect(el.shadowRoot.querySelector('[role="dialog"]')).toBeNull();
    });

    it('opens the help on lwci:show-shortcuts and lists Ctrl/Cmd+K', async () => {
        document.dispatchEvent(new CustomEvent('lwci:show-shortcuts'));
        await flush();
        const dialog = el.shadowRoot.querySelector('[role=dialog]');
        expect(dialog).not.toBeNull();
        expect(dialog.textContent).toContain('Ctrl/Cmd+K');
        document.dispatchEvent(new CustomEvent('lwci:show-shortcuts'));
        await flush();
        expect(el.shadowRoot.querySelector('[role=dialog]')).not.toBeNull();
    });
});
