import { createElement } from 'lwc';
import Shortcuts, { SHORTCUTS } from 'my/shortcuts';

describe('my-shortcuts focus mode key', () => {
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

    it('registers f in the help list', () => {
        expect(SHORTCUTS).toContainEqual(
            expect.objectContaining({
                key: 'f',
                event: 'lwci:toggle-focus'
            })
        );
    });

    it('dispatches lwci:toggle-focus on f', () => {
        const handler = jest.fn();
        document.addEventListener('lwci:toggle-focus', handler);
        document.dispatchEvent(
            new KeyboardEvent('keydown', { key: 'f', bubbles: true })
        );
        document.removeEventListener('lwci:toggle-focus', handler);
        expect(handler).toHaveBeenCalledTimes(1);
    });

    it('does not fire while typing in an input', () => {
        const handler = jest.fn();
        document.addEventListener('lwci:toggle-focus', handler);
        const input = document.createElement('input');
        document.body.appendChild(input);
        input.dispatchEvent(
            new KeyboardEvent('keydown', {
                key: 'f',
                bubbles: true,
                composed: true
            })
        );
        document.removeEventListener('lwci:toggle-focus', handler);
        expect(handler).not.toHaveBeenCalled();
    });

    it('does not fire with modifier keys', () => {
        const handler = jest.fn();
        document.addEventListener('lwci:toggle-focus', handler);
        document.dispatchEvent(
            new KeyboardEvent('keydown', { key: 'f', ctrlKey: true })
        );
        document.removeEventListener('lwci:toggle-focus', handler);
        expect(handler).not.toHaveBeenCalled();
    });
});
