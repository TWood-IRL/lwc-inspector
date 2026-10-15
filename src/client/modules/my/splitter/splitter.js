import { LightningElement, api } from 'lwc';
import { clamp, widthForKey } from 'my/layoutState';

/**
 * Presentational vertical splitter (role=separator).
 * Fires `resize` with detail { value, final } as the user drags or presses
 * keys, and `reset` on double click. The parent owns the value.
 */
export default class Splitter extends LightningElement {
    @api value = 0;
    @api min = 0;
    @api max = 100;
    @api disabled = false;
    @api label = 'Resize panes';

    dragging = false;
    _startX = 0;
    _startValue = 0;
    _pointerId = null;

    get tabIndexValue() {
        return this.disabled ? '-1' : '0';
    }
    get ariaDisabled() {
        return this.disabled ? 'true' : 'false';
    }
    get className() {
        let cls = 'splitter';
        if (this.dragging) cls += ' dragging';
        if (this.disabled) cls += ' disabled';
        return cls;
    }

    emit(value, final) {
        this.dispatchEvent(
            new CustomEvent('resize', {
                detail: { value: clamp(value, this.min, this.max), final }
            })
        );
    }

    handlePointerDown(event) {
        if (this.disabled || (event.button !== undefined && event.button > 0)) {
            return;
        }
        event.preventDefault();
        this.dragging = true;
        this._startX = event.clientX;
        this._startValue = Number(this.value);
        this._pointerId = event.pointerId;
        const el = event.currentTarget;
        try {
            el.setPointerCapture?.(event.pointerId);
        } catch {
            // capture is best effort
        }
        el.focus?.();
    }

    handlePointerMove(event) {
        if (!this.dragging) return;
        this.emit(this._startValue + (event.clientX - this._startX), false);
    }

    handlePointerUp(event) {
        if (!this.dragging) return;
        this.dragging = false;
        try {
            event.currentTarget.releasePointerCapture?.(this._pointerId);
        } catch {
            // ignore
        }
        this.emit(this._startValue + (event.clientX - this._startX), true);
    }

    handlePointerCancel() {
        if (!this.dragging) return;
        this.dragging = false;
        this.emit(this._startValue, true);
    }

    handleKeydown(event) {
        if (this.disabled) return;
        const next = widthForKey(
            event.key,
            Number(this.value),
            this.min,
            this.max
        );
        if (next === null) return;
        event.preventDefault();
        this.emit(next, true);
    }

    handleDoubleClick() {
        if (this.disabled) return;
        this.dispatchEvent(new CustomEvent('reset'));
    }
}
