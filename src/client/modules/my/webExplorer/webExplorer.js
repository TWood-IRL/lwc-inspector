import { LightningElement, track } from 'lwc';
import {
    getLightningComponentBundles,
    searchLightningComponentBundle
} from 'data/dataService';
import { fireLoading, showToast } from 'my/utils';
import { LABELS } from 'data/labelService';

export default class WebExplorer extends LightningElement {
    @track
    lightningComponentBundles = [];
    searchKey = '';
    searchContents = false ; 
    compTypes = [
        {'label': 'Lightning Web Components', 'value': 'lwcComps'},
        {'label': 'Aura Components', 'value': 'auraComps'},
    ];
    compTypeValue = "lwcComps";

    LABELS = LABELS;
    get isComponents() {
        return this.lightningComponentBundles.length > 0;
    }
    connectedCallback() {
        this.getLightningComponents(this.compTypeValue);
    }
    compSelected(event) {
        let dataset = event.target.dataset;
        if (dataset.exposed) {
            this.dispatchEvent(
                new CustomEvent('selected', { detail: { id: dataset.id } })
            );
        } else {
            this.dispatchEvent(
                showToast('Managed Component', 'Unable to view source')
            );
        }
    }

    getLightningComponents() {
        this.dispatchEvent(fireLoading(true));

        getLightningComponentBundles(this.compTypeValue)
            .then((resp) => {
                if (resp.data.length === 0) {
                    //we didnt get any results
                    this.dispatchEvent(showToast('No Results Found'));
                }
                this.lightningComponentBundles = resp.data;
            })
            .finally(() => {
                this.dispatchEvent(fireLoading(false));
            });
    }
    executeSearch(event) {
        // if already searching want to bounce the event and ignore
        event.stopPropagation();
        //bounce the request if first search
        if (this.isSearching || (!event.detail.value || event.detail.value.length <= 3) ){
            return;
        }
        setTimeout(() => {
            this.isSearching = false;
        }, 300);
        this.searchComponents(event);
    }
    searchComponents() {
        let searchTerm = this.template.querySelector('lightning-input').value;
        let compTypeValue = this.template.querySelector('lightning-radio-group').value;
        this.dispatchEvent(fireLoading(true));

        searchLightningComponentBundle(compTypeValue, searchTerm  )
            .then((resp) => {
                if (resp.data.length === 0) {
                    //we didnt get any results just reset. Prompt to user
                    this.dispatchEvent(showToast('No Results Found'));
                    this.getLightningComponents(this.compTypeValue);
                } else {
                    this.lightningComponentBundles = resp.data;
                }
            })
            .finally(() => {
                this.dispatchEvent(fireLoading(false));
            });
    }
    
}
