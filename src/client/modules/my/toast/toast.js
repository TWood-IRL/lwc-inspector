import { LightningElement, track, api } from 'lwc';
/**
 * Toast message displayed by app container
 */
import { LABELS } from 'data/labelService';

export default class Toast extends LightningElement {
    @track toastNotification = {};
    TOAST_CLOSE_TEXT = LABELS.TOAST_CLOSE_TEXT;
    get isMessage() {
        return this.message !== '';
    }

    renderedCallback() {
        if (!this.toastNotification.title === false) {
            setTimeout(() => {
                this.toastNotification = {};
            }, 5000); //reset
        }
    }
    get getComputedClass() {
        return !this.toastNotification.title !== false
            ? 'hidden'
            : 'fade-in-out';
    }
    @api showToast(toastNotification) {
        this.toastNotification = toastNotification;
    }
    get isDisplayed() {
        return !this.toastNotification.title === false;
    }
}
