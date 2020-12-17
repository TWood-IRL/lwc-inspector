import { LightningElement, api } from 'lwc';

export default class Explorer extends LightningElement {
    @api lightningComponentBundles = [];
    get isComponents() {
        return this.lightningComponentBundles.length > 0;
    }
}
