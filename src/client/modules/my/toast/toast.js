import { LightningElement, api } from 'lwc';
/**
 * Toast message displayed by app container
 */
import { LABELS } from 'data/labelService';

const TOAST_DURATION_MS = 5000;
const EXIT_DURATION_MS = 200;
const ERROR_PATTERN = /unable|error|fail/i;
const VARIANTS = {
    info: { theme: 'slds-theme_info', icon: 'info' },
    success: { theme: 'slds-theme_success', icon: 'success' },
    error: { theme: 'slds-theme_error', icon: 'error' }
};

export default class Toast extends LightningElement {
    toastNotification = {};
    TOAST_CLOSE_TEXT = LABELS.TOAST_CLOSE_TEXT;
    hideTimer;
    exitTimer;
    remaining = TOAST_DURATION_MS;
    timerStart = 0;
    isPaused = false;
    isLeaving = false;

    get isMessage() {
        return !!this.toastNotification.message;
    }
    get isDisplayed() {
        return !!this.toastNotification.title;
    }
    get variant() {
        const { variant, title } = this.toastNotification;
        if (VARIANTS[variant]) {
            return variant;
        }
        return ERROR_PATTERN.test(title || '') ? 'error' : 'info';
    }
    get getComputedClass() {
        if (!this.isDisplayed) {
            return 'hidden';
        }
        return `toast-${this.variant}${
            this.isLeaving ? ' toast-leaving' : ' toast-entering'
        }${this.isPaused ? ' toast-paused' : ''}`;
    }
    get toastClass() {
        return `slds-notify slds-notify_toast toast ${
            VARIANTS[this.variant].theme
        }`;
    }
    get iconHref() {
        return `/resources/slds/icons/utility-sprite/svg/symbols.svg#${
            VARIANTS[this.variant].icon
        }`;
    }
    get variantLabel() {
        return this.variant;
    }
    get progressStyle() {
        return `animation-duration: ${TOAST_DURATION_MS}ms`;
    }

    renderedCallback() {
        if (this.isDisplayed && !this.hideTimer && !this.isLeaving) {
            this.startTimer(TOAST_DURATION_MS);
        }
    }
    startTimer(ms) {
        clearTimeout(this.hideTimer);
        this.remaining = ms;
        this.timerStart = Date.now();
        this.hideTimer = setTimeout(() => this.dismiss(), ms);
    }
    dismiss() {
        clearTimeout(this.hideTimer);
        this.hideTimer = undefined;
        this.isLeaving = true;
        clearTimeout(this.exitTimer);
        this.exitTimer = setTimeout(() => {
            this.isLeaving = false;
            this.isPaused = false;
            this.toastNotification = {};
        }, EXIT_DURATION_MS);
    }
    handlePause() {
        if (!this.hideTimer || this.isPaused) {
            return;
        }
        clearTimeout(this.hideTimer);
        this.remaining -= Date.now() - this.timerStart;
        this.isPaused = true;
    }
    handleResume() {
        if (!this.isPaused) {
            return;
        }
        this.isPaused = false;
        this.startTimer(Math.max(this.remaining, 0));
    }
    handleClose() {
        this.dismiss();
    }
    disconnectedCallback() {
        clearTimeout(this.hideTimer);
        clearTimeout(this.exitTimer);
    }

    @api showToast(toastNotification) {
        clearTimeout(this.hideTimer);
        clearTimeout(this.exitTimer);
        this.hideTimer = undefined;
        this.isLeaving = false;
        this.isPaused = false;
        this.toastNotification = toastNotification;
    }
}
