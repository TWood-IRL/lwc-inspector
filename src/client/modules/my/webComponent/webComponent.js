import { LightningElement, api, track } from 'lwc';
import { getLightningComponentBundleById } from 'data/dataService';

export default class WebComponent extends LightningElement {
    //here we'll get the information for the resource. , when clicking

    @api id = null;
    componentId = null;
    @track componentBundle = []; // array of differnt components .. attributes
    /*  
    id: component.Id,
                            Source: component.Source,
                            FilePath: component.FilePath,
                            attributes: component.attributes,
                            Format: component.Format 
                            */

    connectedCallback() {
        this.fireLoading(true) ; 
        if (this.id.split('-').length > 1) {
            this.componentId = this.id.split('-')[0];
        } else if (this.id) {
            this.componentId = this.id;
        }
        getLightningComponentBundleById(this.componentId).then((resp) => {
            this.fireLoading(false) ; 

            this.componentBundle = resp.data;
        });
    }
    get displayContent() {
        return this.id === null ? false : true;
    }
    
    handleBack(){
        this.dispatchEvent(new CustomEvent('backselected'));
    }
    fireLoading(loading){
        this.dispatchEvent(new CustomEvent('loading', {bubbles: true , composed:true, detail: { loading: loading } }));

    }
}
