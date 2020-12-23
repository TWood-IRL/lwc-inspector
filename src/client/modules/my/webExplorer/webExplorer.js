import { LightningElement, track } from 'lwc';
import { getLightningComponentBundles, searchLightningComponentBundle } from  'data/dataService';

export default class WebExplorer extends LightningElement {
    @track
    lightningComponentBundles = [];
    searchKey = '' ; 
    isSearching = false; 
    get isComponents() {
        return this.lightningComponentBundles.length > 0;
    }
    connectedCallback(){
        this.getLightningComponents() ; 
    }
    compSelected(event) {
        let id = event.target.dataset.id;
        this.dispatchEvent(new CustomEvent('selected', { detail: { id: id } }));
    }

    getLightningComponents(){ //TODO : Need to move to webExplorer
        //   this.dispatchEvent(new CustomEvent('loading'));
           getLightningComponentBundles().then((resp)=> {
            //   this.dispatchEvent(new CustomEvent('doneloading'));
               this.lightningComponentBundles = resp.data ; 
           })
       }
    executeSearch(event) { // if already searching want to bounce the event and ignore
        event.stopPropagation() ; 
        if(this.isSearching){
            return ; 
        }
        //this.dispatchEvent(new CustomEvent('search', { bubbles: true, composed: true ,  detail: { id: event.detail.value } })); //going to bubble up to main

        setTimeout(()=> {
            this.isSearching = false ; 
        }, 1000 ) ; 

        this.isSearching = true; 
    }
    searchComponents(event){
        let searchTerm = event.detail.value ; 
        searchLightningComponentBundle(searchTerm).then((resp)=> {
            //   this.dispatchEvent(new CustomEvent('doneloading'));
               this.lightningComponentBundles = resp.data ; 
           })
    }
}
