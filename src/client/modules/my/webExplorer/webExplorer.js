import { LightningElement, track } from 'lwc';
import {
    getLightningComponentBundles,
    searchLightningComponentBundle
} from 'data/dataService';

export default class WebExplorer extends LightningElement {
    @track
    lightningComponentBundles = [];
    searchKey = '';
    isSearching = false;
    get isComponents() {
        return this.lightningComponentBundles.length > 0;
    }
    connectedCallback() {
        this.getLightningComponents();
    }
    compSelected(event) {
        let id = event.target.dataset.id;
        this.dispatchEvent(new CustomEvent('selected', { detail: { id: id } }));
    }

    getLightningComponents() {
        this.fireLoading(true);

        getLightningComponentBundles()
            .then((resp) => {
                this.lightningComponentBundles = resp.data;
            })
            .finally(() => {
                this.fireLoading(false);
            });
    }
    executeSearch(event) {
        // if already searching want to bounce the event and ignore
        event.stopPropagation();
        if (this.isSearching) {
            return;
        }

        setTimeout(() => {
            this.isSearching = false;
        }, 1000);
        this.searchComponents(event);
        this.isSearching = true;
    }
    searchComponents(event) {
        let searchTerm = event.detail.value;
        this.fireLoading(true);

        searchLightningComponentBundle(searchTerm)
            .then((resp) => {
                this.lightningComponentBundles = resp.data;
            })
            .finally(() => {
                this.fireLoading(false);
            });
    }
    fireLoading(loading) {
        this.dispatchEvent(
            new CustomEvent('loading', {
                bubbles: true,
                composed: true,
                detail: { loading: loading }
            })
        );
    }
}
