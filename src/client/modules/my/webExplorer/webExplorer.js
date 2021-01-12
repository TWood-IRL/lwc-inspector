import { LightningElement, track } from 'lwc';
import {
    getLightningComponentBundles,
    searchLightningComponentBundle,
    getLightningComponentBundleById
} from 'data/dataService';

import { fireLoading, showToast } from 'my/utils';
import { LABELS } from 'data/labelService';

export default class WebExplorer extends LightningElement {
    @track
    _lightningComponentBundles = [];
    @track 
    _selectedComponent = null;
    @track 
    _selectedComponentResource = null;
    searchKey = '';
    searchContents = false;
    compTypes = [
        { label: 'Lightning Web Components', value: 'lwcComps' },
        { label: 'Aura Components', value: 'auraComps' }
    ];
    compTypeValue = 'lwcComps';

    LABELS = LABELS;
    get isComponents() {
        return this._lightningComponentBundles.length > 0;
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
                this._lightningComponentBundles = resp.data;
            })
            .finally(() => {
                this.dispatchEvent(fireLoading(false));
            });
    }
    executeSearch(event) {
        // if already searching want to bounce the event and ignore
        event.stopPropagation();
        //bounce the request if first search
        if (this.isSearching) {
            return;
        }
        setTimeout(() => {
            this.isSearching = false;
        }, 300);
        this.searchComponents(event);
    }
    async searchComponents() {
        let searchTerm = this.template.querySelector('lightning-input').value;
        let compTypeValue = this.template.querySelector('lightning-radio-group')
            .value;
        this.dispatchEvent(fireLoading(true));

        searchLightningComponentBundle(compTypeValue, searchTerm)
            .then((resp) => {
                if (resp.data.length === 0) {
                    //we didnt get any results just reset. Prompt to user
                    this.dispatchEvent(showToast('No Results Found'));
                    this.getLightningComponents(this.compTypeValue);
                } else {
                    this._lightningComponentBundles = resp.data;
                }
            })
            .finally(() => {
                this.dispatchEvent(fireLoading(false));
            });
    }
    /**
     * If the component is of type source we only want to set the selectCompValue
     * else we want to retrieve and append to existing list if needed
     * @param {onselect} event
     *
     */
    handleOnselect(event) {
        let treeValue = event.detail.name;
        
        if (treeValue.length === 18) { //set selected comp value to current tree item expanded source. 
            // its a resource
            this._selectedComponent.items.some( (item) => 
            {
                if(item.id === treeValue){
                    this._selectedComponentResource = item ; 
                    return true; 
                }
                return false; 
            } )
        } else {
            //reset previous
        if (this._selectedComponent) {
            this._lightningComponentBundles[
                this._selectedComponent.name
            ].expanded = false;
            this._selectedComponentResource = null ; 

        }
            this._selectedComponent = this._lightningComponentBundles[
                treeValue
            ];
            if (!this._selectedComponent.Source) {
                // its not a lwcresource
                if (this._selectedComponent.items.length === 0) {
                    //we havent received the source already
                    this.dispatchEvent(fireLoading(true));

                    getLightningComponentBundleById(
                        this._selectedComponent.id
                    ).then((resp) => {
                        this._lightningComponentBundles[
                            this._selectedComponent.name
                        ].items = resp.data;
                        this._lightningComponentBundles[
                            this._selectedComponent.name
                        ].expanded = true;
                        this._lightningComponentBundles = [
                            ...this._lightningComponentBundles
                        ]; //trigger change
                        this.dispatchEvent(fireLoading(false));
                    });
                } else {
                    this._lightningComponentBundles[
                        this._selectedComponent.name
                    ].expanded = true;
                    this._lightningComponentBundles = [
                        ...this._lightningComponentBundles
                    ]; //trigger change
                }
            }
        }
    }
    get components() {
        return this._lightningComponentBundles;
    }
    get isTypeSource() {
        return (!!this._selectedComponentResource && !!this._selectedComponentResource.Source);
    }
    get getSource() {
        return this._selectedComponentResource.Source;
    }
}
