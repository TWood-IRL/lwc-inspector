import { LightningElement, api, track } from 'lwc';

export default class App extends LightningElement {
    @api lightningComponentBundles = [];
    @track toastNotification = null;
    displayCompId = null;
    get isDisplayList() {
        return this.lightningComponentBundles.length > 0 && !this.displayCompId;
    }
    get isDisplayComp() {
        //when we have an id set..
        return this.displayCompId !== null;
    }
    get showToast() {
        return this.toastNotification !== null;
    }
    setComponent(event) {
        event.stopPropagation();
        this.displayCompId = event.detail.id;
    }
    resetId() {
        this.displayCompId = null;
    }
    handleToast(event) {
        this.template.querySelector('my-toast').showToast(event.detail);
    }
}
