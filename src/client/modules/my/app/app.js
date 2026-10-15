import { LightningElement } from 'lwc';

export default class App extends LightningElement {
    displayCompId = null;

    get isDisplayComp() {
        //when we have an id set..
        return this.displayCompId !== null;
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
