import { LightningElement, api } from 'lwc';
/**
 * Toast message displayed by app container
 */
import { LABELS } from 'data/labelService';

const TOAST_DURATION_MS = 5000;

export default class Toast extends LightningElement {
    toastNotification = {};
    TOAST_CLOSE_TEXT = LABELS.TOAST_CLOSE_TEXT;
    hideTimer;

    get isMessage() {
        return !!this.toastNotification.message;
    }
    get isDisplayed() {
        return !!this.toastNotification.title;
    }
    get getComputedClass() {
        return this.isDisplayed ? 'fade-in-out' : 'hidden';
    }

    renderedCallback() {
        if (this.isDisplayed) {
            clearTimeout(this.hideTimer);
            this.hideTimer = setTimeout(() => {
                this.toastNotification = {};
            }, TOAST_DURATION_MS);
        }
    }
    disconnectedCallback() {
        clearTimeout(this.hideTimer);
    }

    @api showToast(toastNotification) {
        this.toastNotification = toastNotification;
    }
}
