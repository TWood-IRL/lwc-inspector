import { LightningElement, track } from 'lwc';
import {
    getLightningComponentBundles,
    searchLightningComponentBundle
} from 'data/dataService';
import { fireLoading, showToast } from 'my/utils';
import { LABELS } from 'data/labelService';

export default class AuraExplorer extends LightningElement {
    @track
    lightningComponentBundles = [];
    searchKey = '';
    isSearching = false;
    LABELS = LABELS;
    get isComponents() {
        return this.lightningComponentBundles.length > 0;
    }
    connectedCallback() {
        this.getLightningComponents();
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

        getLightningComponentBundles()
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
        if (this.isSearching || event.detail.value.length <= 3) {
            return;
        }
        setTimeout(() => {
            this.isSearching = false;
        }, 300);
        this.searchComponents(event);
    }
    searchComponents(event) {
        let searchTerm = event.detail.value;
        this.dispatchEvent(fireLoading(true));

        searchLightningComponentBundle(searchTerm)
            .then((resp) => {
                if (resp.data.length === 0) {
                    //we didnt get any results just reset. Prompt to user
                    this.dispatchEvent(showToast('No Results Found'));
                    this.getLightningComponents();
                } else {
                    this.lightningComponentBundles = resp.data;
                }
            })
            .finally(() => {
                this.dispatchEvent(fireLoading(false));
            });
    }
}
