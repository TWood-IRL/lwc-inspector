/**
 * Represents the component bundle
 */
import { LightningElement, api } from 'lwc';
import { getLightningComponentBundleById } from 'data/dataService';

//Do zipping in client
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { fireLoading, showToast } from 'my/utils';

export default class WebComponent extends LightningElement {
    //here we'll get the information for the resource. , when clicking

    @api id = null;
    componentId = null;
    // array of the bundle's files: { id, Source, FilePath, attributes, Format, Type, ComponentName }
    componentBundle = [];

    connectedCallback() {
        if (this.id) {
            this.componentId = this.id.split('-')[0];
            this.loadBundle();
        }
    }

    async loadBundle() {
        this.dispatchEvent(fireLoading(true));
        try {
            const resp = await getLightningComponentBundleById(
                this.componentId
            );
            this.componentBundle = resp.data;
        } catch (error) {
            this.dispatchEvent(
                showToast('Unable to load component', error.message)
            );
        } finally {
            this.dispatchEvent(fireLoading(false));
        }
    }

    get displayContent() {
        return this.id !== null;
    }

    handleBack() {
        this.dispatchEvent(new CustomEvent('backselected'));
    }

    async handleDownload() {
        if (this.componentBundle[0]?.Type === 'AURA') {
            this.dispatchEvent(showToast('Download not Implemented for Aura'));
            return;
        }
        const zipFile = new JSZip();
        this.componentBundle.forEach((component) => {
            zipFile.file(component.FilePath, component.Source);
        });
        try {
            const blob = await zipFile.generateAsync({ type: 'blob' });
            saveAs(blob, this.componentBundle[0].ComponentName);
        } catch (error) {
            console.error('error generating zip', error);
            this.dispatchEvent(showToast('Unable to create zip file'));
        }
    }
}
