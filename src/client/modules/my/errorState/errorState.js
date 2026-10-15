import { LightningElement, api } from 'lwc';

export default class ErrorState extends LightningElement {
    @api title = 'Something went wrong';
    @api message = '';
    @api retryLabel = 'Retry';

    handleRetry() {
        this.dispatchEvent(new CustomEvent('retry'));
    }
}
