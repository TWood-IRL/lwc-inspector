import { LightningElement, api } from 'lwc';

export default class App extends LightningElement {
    @api lightningComponentBundles = [];

    displayCompId = null;
    get isDisplayList() {
        return this.lightningComponentBundles.length > 0 && !this.displayCompId;
    }
    get isDisplayComp() {
        //when we have an id set..
        return this.displayCompId !== null ? true : false;
    }
    setComponent(event) {
        event.stopPropagation();
        this.displayCompId = event.detail.id;
    }
}
