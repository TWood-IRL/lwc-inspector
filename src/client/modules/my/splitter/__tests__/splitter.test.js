import { createElement } from 'lwc';
import Splitter from 'my/splitter';

describe('my-splitter', () => {
    let el;
    let sep;
    let events;

    const create = (props = {}) => {
        el = createElement('my-splitter', { is: Splitter });
        Object.assign(el, { value: 300, min: 200, max: 600 }, props);
        document.body.appendChild(el);
        sep = el.shadowRoot.querySelector('[role="separator"]');
        events = [];
        el.addEventListener('resize', (e) => events.push(e.detail));
    };

    const pointer = (type, clientX) => {
        const e = new CustomEvent(type, { bubbles: true });
        Object.assign(e, { clientX, pointerId: 1, button: 0 });
        sep.dispatchEvent(e);
    };
    const key = (k) =>
        sep.dispatchEvent(new KeyboardEvent('keydown', { key: k }));

    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
    });

    it('renders an accessible separator', () => {
        create();
        expect(sep.getAttribute('aria-orientation')).toBe('vertical');
        expect(sep.getAttribute('aria-valuenow')).toBe('300');
        expect(sep.getAttribute('aria-valuemin')).toBe('200');
        expect(sep.getAttribute('aria-valuemax')).toBe('600');
        expect(sep.getAttribute('tabindex')).toBe('0');
    });

    it('resizes with the arrow keys by 16px', () => {
        create();
        key('ArrowRight');
        key('ArrowLeft');
        expect(events).toEqual([
            { value: 316, final: true },
            { value: 284, final: true }
        ]);
    });

    it('jumps to min/max with Home/End and clamps', () => {
        create({ value: 598 });
        key('ArrowRight');
        key('Home');
        key('End');
        expect(events.map((e) => e.value)).toEqual([600, 200, 600]);
    });

    it('ignores unrelated keys without preventing default', () => {
        create();
        const e = new KeyboardEvent('keydown', { key: 'a', cancelable: true });
        sep.dispatchEvent(e);
        expect(events).toHaveLength(0);
        expect(e.defaultPrevented).toBe(false);
    });

    it('drags with pointer events and finalises on release', () => {
        create();
        pointer('pointerdown', 100);
        pointer('pointermove', 150);
        pointer('pointermove', 900);
        pointer('pointerup', 120);
        expect(events).toEqual([
            { value: 350, final: false },
            { value: 600, final: false },
            { value: 320, final: true }
        ]);
    });

    it('ignores pointer moves when not dragging', () => {
        create();
        pointer('pointermove', 150);
        pointer('pointerup', 150);
        expect(events).toHaveLength(0);
    });

    it('restores the start value on pointer cancel', () => {
        create();
        pointer('pointerdown', 100);
        pointer('pointermove', 200);
        pointer('pointercancel', 200);
        expect(events[events.length - 1]).toEqual({ value: 300, final: true });
    });

    it('fires reset on double click', () => {
        create();
        const reset = jest.fn();
        el.addEventListener('reset', reset);
        sep.dispatchEvent(new CustomEvent('dblclick', { bubbles: true }));
        expect(reset).toHaveBeenCalledTimes(1);
    });

    it('does nothing when disabled', () => {
        create({ disabled: true });
        const reset = jest.fn();
        el.addEventListener('reset', reset);
        expect(sep.getAttribute('tabindex')).toBe('-1');
        expect(sep.getAttribute('aria-disabled')).toBe('true');
        key('ArrowRight');
        pointer('pointerdown', 100);
        pointer('pointermove', 200);
        sep.dispatchEvent(new CustomEvent('dblclick', { bubbles: true }));
        expect(events).toHaveLength(0);
        expect(reset).not.toHaveBeenCalled();
    });
});
