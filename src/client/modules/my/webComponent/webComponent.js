import { LightningElement, api, track } from 'lwc';
import { getLightningComponentBundle } from 'data/dataService';

export default class WebComponent extends LightningElement {
    //here we'll get the information for the resource. , when clicking

    @api id = null;
    @track componentBundle;
    connectedCallback() {
        getLightningComponentBundle(this.id).then((resp) => {
            this.componentBundle = resp;
        });
    }
}
