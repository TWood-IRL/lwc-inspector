import { LightningElement, track } from 'lwc';
import {
    getLightningComponentBundles,
    searchLightningComponentBundle,
    getLightningComponentBundleById
} from 'data/dataService';

import { fireLoading, showToast } from 'my/utils';
import { LABELS } from 'data/labelService';
import {
    parseHash,
    buildHash,
    loadRecents,
    addRecent,
    clearRecents,
    TYPE_TO_SLUG
} from 'my/navState';
//Do zipping in client
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

const SEARCH_DEBOUNCE_MS = 300;

export default class WebExplorer extends LightningElement {
    // @track: nodes are mutated in place (expanded, items) and the tree must re-render
    @track _lightningComponentBundles = [];
    @track _selectedComponent = null;
    @track _selectedComponentResource = null;
    searchKey = '';
    searchContents = false;
    isSearching = false;
    copied = false;
    linkCopied = false;
    _recents = [];
    loaded = false; // true once the first request has finished, drives the empty state
    compTypes = [
        { label: 'Lightning Web Components', value: 'lwcComps' },
        { label: 'Aura Components', value: 'auraComps' }
    ];
    compTypeValue = 'lwcComps';

    LABELS = LABELS;

    get isComponents() {
        return this._lightningComponentBundles.length > 0;
    }
    get showEmptyState() {
        return this.loaded && !this.isComponents;
    }
    get treeHeader() {
        return `Components (${this._lightningComponentBundles.length})`;
    }
    get components() {
        return this._lightningComponentBundles;
    }
    get isTypeSource() {
        return !!this._selectedComponentResource?.Source;
    }
    get getSource() {
        return this._selectedComponentResource.Source;
    }
    get getSourceLabel() {
        return this._selectedComponentResource.label;
    }
    get getSourceFormat() {
        return this._selectedComponentResource.Format;
    }
    // Keeps the tree highlight in step with the open tab
    get selectedFileName() {
        return this._selectedComponentResource?.name;
    }
    // One tab per file in the open component
    get fileTabs() {
        const items = this._selectedComponent?.items ?? [];
        return items
            .filter((item) => item.Source !== undefined)
            .map((item) => {
                const selected = item.name === this.selectedFileName;
                return {
                    name: item.name,
                    label: item.label.split('/').pop(),
                    title: item.label,
                    selected,
                    className: selected ? 'tab tab-active' : 'tab'
                };
            });
    }

    handleTabClick(event) {
        const { name } = event.currentTarget.dataset;
        const item = this._selectedComponent.items.find(
            (file) => file.name === name
        );
        if (item) {
            this._selectedComponentResource = item;
            this.syncHash(false);
        }
    }

    // --- Deep links and recents ---------------------------------------

    get hasRecents() {
        return this._recents.length > 0;
    }
    get recents() {
        return this._recents;
    }

    // Last path segment of a file label ("lwc/myComp/myComp.js" -> "myComp.js")
    fileSlug(item) {
        return item.label.split('/').pop();
    }

    currentTarget() {
        const bundle = this._selectedComponent;
        if (!bundle) {
            return null;
        }
        const file = this._selectedComponentResource;
        return {
            type: this.compTypeValue,
            bundle: bundle.label,
            file: file ? this.fileSlug(file) : null
        };
    }

    // Mirrors the selection into the URL hash (pushState for a new
    // component, replaceState for tab switches). Never fires hashchange.
    syncHash(push) {
        const hash = buildHash(this.currentTarget() ?? {});
        if (!hash || hash === window.location.hash) {
            return;
        }
        const url = `${window.location.pathname}${window.location.search}${hash}`;
        try {
            window.history[push ? 'pushState' : 'replaceState'](null, '', url);
        } catch {
            // history unavailable: deep links are best effort
        }
    }

    recordNavigation(push) {
        this.syncHash(push);
        const bundle = this._selectedComponent;
        if (bundle) {
            this._recents = addRecent({
                name: bundle.label,
                label: bundle.label,
                type: this.compTypeValue
            });
        }
    }

    handleHashChange = () => {
        const target = parseHash(window.location.hash);
        const current = this.currentTarget();
        if (
            target &&
            !(
                current &&
                current.type === target.type &&
                current.bundle === target.bundle &&
                (current.file ?? null) === target.file
            )
        ) {
            this.openTarget(target);
        }
    };

    async openTarget({ type, bundle: bundleName, file }) {
        if (type !== this.compTypeValue) {
            this.compTypeValue = type;
            await this.getLightningComponents();
        }
        const bundles = this._lightningComponentBundles;
        const bundle = bundles.find((entry) => entry.label === bundleName);
        if (!bundle) {
            this.dispatchEvent(
                showToast(
                    'Component not found',
                    `No ${TYPE_TO_SLUG[type]} component named ${bundleName}`
                )
            );
            return;
        }
        if (this._selectedComponent && this._selectedComponent !== bundle) {
            this._selectedComponent.expanded = false;
        }
        this._selectedComponentResource = null;
        this._selectedComponent = bundle;
        bundle.expanded = true;
        if (bundle.items.length === 0) {
            await this.loadSelectedComponentItems();
        }
        if (file) {
            const item = bundle.items.find(
                (entry) => this.fileSlug(entry) === file
            );
            if (item?.Source !== undefined) {
                this._selectedComponentResource = item;
            } else {
                this.dispatchEvent(
                    showToast('File not found', `${bundleName} has no ${file}`)
                );
            }
        }
        this.refreshBundles();
        this.recordNavigation(false);
    }

    handleRecentSelect(event) {
        const { name, type } = event.detail;
        this.openTarget({ type, bundle: name, file: null });
    }

    handleRecentsClear() {
        this._recents = clearRecents();
    }

    async handleCopyLink() {
        try {
            await navigator.clipboard.writeText(window.location.href);
            this.linkCopied = true;
            clearTimeout(this.linkTimer);
            this.linkTimer = setTimeout(() => {
                this.linkCopied = false;
            }, 1500);
            this.dispatchEvent(showToast('Link copied to clipboard'));
        } catch {
            this.dispatchEvent(showToast('Unable to copy link'));
        }
    }

    get copyLinkLabel() {
        return this.linkCopied ? 'Link copied!' : 'Copy link';
    }
    get copyLinkClass() {
        return this.linkCopied
            ? 'editor-button editor-button-done'
            : 'editor-button';
    }

    async connectedCallback() {
        this._recents = loadRecents();
        const target = parseHash(window.location.hash);
        if (target) {
            this.compTypeValue = target.type;
        }
        window.addEventListener('hashchange', this.handleHashChange);
        await this.getLightningComponents();
        if (target) {
            await this.openTarget(target);
        }
    }

    compSelected(event) {
        const dataset = event.target.dataset;
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

    showError(error) {
        this.dispatchEvent(showToast('Something went wrong', error.message));
    }

    async getLightningComponents() {
        this.dispatchEvent(fireLoading(true));
        try {
            const resp = await getLightningComponentBundles(this.compTypeValue);
            if (resp.data.length === 0) {
                //we did not get any results
                this.dispatchEvent(showToast('No Results Found'));
            }
            this._lightningComponentBundles = resp.data;
        } catch (error) {
            this.showError(error);
        } finally {
            this.loaded = true;
            this.dispatchEvent(fireLoading(false));
        }
    }

    handleSearchKeyup(event) {
        if (event.key === 'Enter') {
            this.executeSearch(event);
        }
    }

    get copyLabel() {
        return this.copied ? 'Copied!' : 'Copy';
    }

    get copyClass() {
        return this.copied
            ? 'editor-button editor-button-done'
            : 'editor-button';
    }

    disconnectedCallback() {
        window.removeEventListener('hashchange', this.handleHashChange);
        clearTimeout(this.linkTimer);
        clearTimeout(this.copyTimer);
    }

    async handleCopy() {
        try {
            await navigator.clipboard.writeText(this.getSource);
            this.copied = true;
            clearTimeout(this.copyTimer);
            this.copyTimer = setTimeout(() => {
                this.copied = false;
            }, 1500);
            this.dispatchEvent(showToast('Copied to clipboard'));
        } catch {
            this.dispatchEvent(showToast('Unable to copy to clipboard'));
        }
    }

    executeSearch(event) {
        // if already searching want to bounce the event and ignore
        event.stopPropagation();
        if (this.isSearching) {
            return;
        }
        this.isSearching = true;
        setTimeout(() => {
            this.isSearching = false;
        }, SEARCH_DEBOUNCE_MS);
        this.searchComponents();
    }

    async searchComponents() {
        const searchTerm = this.template.querySelector('lightning-input').value;
        const compTypeValue = this.template.querySelector(
            'lightning-radio-group'
        ).value;
        this.compTypeValue = compTypeValue;
        this.dispatchEvent(fireLoading(true));
        try {
            const resp = await searchLightningComponentBundle(
                compTypeValue,
                searchTerm
            );
            if (resp.data.length === 0) {
                //we did not get any results, reset and prompt the user
                this.dispatchEvent(showToast('No Results Found'));
                await this.getLightningComponents();
            } else {
                this._lightningComponentBundles = resp.data;
            }
        } catch (error) {
            this.showError(error);
        } finally {
            this.dispatchEvent(fireLoading(false));
        }
    }

    // Assigning a new array makes the tree re-render
    refreshBundles() {
        this._lightningComponentBundles = [...this._lightningComponentBundles];
    }

    /**
     * Selecting a bundle loads (once) and expands its files,
     * selecting a file shows its source.
     * @param {onselect} event
     */
    async handleOnselect(event) {
        const treeValue = event.detail.name;
        this.template.querySelector('c-tree').resetSelected();
        const indxPos = this.findId(this._lightningComponentBundles, treeValue);
        if (this._selectedComponent) {
            this._lightningComponentBundles[
                this._selectedComponent.name
            ].expanded = false;
            this._selectedComponentResource = null;
        }

        if (typeof indxPos === 'number' && indxPos >= 0) {
            // a bundle
            this._selectedComponent = this._lightningComponentBundles[indxPos];
            this._selectedComponent.expanded = true;
            if (this._selectedComponent.items.length === 0) {
                await this.loadSelectedComponentItems();
            } else {
                this.refreshBundles();
            }
            this.recordNavigation(true);
        } else if (Array.isArray(indxPos)) {
            // a file inside a bundle
            const [bundleIdx, fileIdx] = indxPos;
            this._selectedComponent =
                this._lightningComponentBundles[bundleIdx];
            this._selectedComponent.expanded = true;
            this._selectedComponentResource =
                this._selectedComponent.items[fileIdx];
            this.refreshBundles();
            this.recordNavigation(false);
        }
    }

    async loadSelectedComponentItems() {
        const component = this._selectedComponent;
        this.dispatchEvent(fireLoading(true));
        try {
            const resp = await getLightningComponentBundleById(component.id);
            component.items = resp.data;
            component.expanded = true;
            this._lightningComponentBundles[component.name] = component;
            this.refreshBundles();
        } catch (error) {
            this.showError(error);
        } finally {
            this.dispatchEvent(fireLoading(false));
        }
    }

    findId(array, id) {
        for (const [idx, entry] of array.entries()) {
            if (entry.name === id) {
                return idx;
            }
            if (entry.items) {
                //if there are children
                const childIdx = this.findId(entry.items, id);
                if (childIdx >= 0) {
                    return [idx, childIdx];
                }
            }
        }
        return -1;
    }

    async handleDownload() {
        if (this._selectedComponent.items[0]?.Type === 'AURA') {
            this.dispatchEvent(showToast('Download not Implemented for Aura'));
            return;
        }
        const zipFile = new JSZip();
        this._selectedComponent.items.forEach((component) => {
            zipFile.file(component.label, component.Source);
        });
        try {
            const blob = await zipFile.generateAsync({ type: 'blob' });
            saveAs(blob, this._selectedComponent.label);
        } catch (error) {
            console.error('error generating zip', error);
            this.dispatchEvent(showToast('Unable to create zip file'));
        }
    }
}
