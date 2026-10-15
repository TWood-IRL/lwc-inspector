import { LightningElement, api, track } from 'lwc';
import {
    getLightningComponentBundles,
    searchLightningComponentBundle,
    getLightningComponentBundleById,
    getBundlesUpdatedAt,
    refresh as refreshData,
    isAbortError
} from 'data/dataService';
import { formatAge } from 'data/cache';

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
import { sortFiles } from './fileOrder';
//Do zipping in client
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

import {
    DEFAULT_TREE_WIDTH,
    MIN_TREE_WIDTH,
    clamp,
    maxTreeWidth,
    loadWidth,
    saveWidth,
    clearWidth,
    loadCollapsed,
    saveCollapsed
} from 'my/layoutState';

const SEARCH_DEBOUNCE_MS = 300;
const STACKED_QUERY = '(max-width: 48rem)';

export default class WebExplorer extends LightningElement {
    // @track: a component's files are filled in place once they have loaded
    @track _lightningComponentBundles = [];
    @track _selectedComponent = null;
    @track _selectedComponentResource = null;
    searchKey = '';
    searchContents = false;
    isSearching = false;
    copied = false;
    _comparing = false;
    linkCopied = false;
    _recents = [];
    pendingTabFocus = null;
    loaded = false; // true once the first request has finished, drives the empty state
    compTypes = [
        { label: 'Lightning Web Components', value: 'lwcComps' },
        { label: 'Aura Components', value: 'auraComps' }
    ];
    compTypeValue = 'lwcComps';

    // Workspace layout (see "Workspace layout" at the end of the class)
    treeWidth = DEFAULT_TREE_WIDTH;
    minTreeWidth = MIN_TREE_WIDTH;
    treeCollapsed = false;
    focusMode = false;
    stacked = false;
    resizing = false;

    LABELS = LABELS;

    // Data loading state: errors, freshness and connectivity
    loadError = null; // message when the bundle list failed to load
    itemError = null; // message when a bundle's files failed to load
    loadingItems = false;
    refreshing = false;
    offline = false;
    updatedAt = null;
    _now = Date.now();
    _listRequest = 0; // guards against out-of-order list responses
    _showingSearch = false;

    get showSkeleton() {
        return !this.loaded && !this.isComponents;
    }
    get showLoadError() {
        return !!this.loadError && !this.isComponents;
    }
    get freshnessLabel() {
        return formatAge(this.updatedAt, this._now);
    }
    get refreshDisabled() {
        return this.refreshing;
    }

    get isComponents() {
        return this._lightningComponentBundles.length > 0;
    }
    get showEmptyState() {
        return this.loaded && !this.isComponents;
    }
    get listHeader() {
        return `Components (${this._lightningComponentBundles.length})`;
    }
    get componentList() {
        const selectedId = this._selectedComponent?.id;
        return this._lightningComponentBundles.map((bundle, index) => {
            const selected = bundle.id === selectedId;
            return {
                id: bundle.id,
                index,
                label: bundle.label,
                managed: !bundle.IsExposed,
                selected,
                className: selected ? 'component component-active' : 'component'
            };
        });
    }
    // An empty file is still a file, so check for a string rather than truthiness
    get isTypeSource() {
        return typeof this._selectedComponentResource?.Source === 'string';
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
                    // only the open tab is in the tab order, arrows move between tabs
                    tabIndex: selected ? 0 : -1,
                    className: selected ? 'tab tab-active' : 'tab'
                };
            });
    }

    get insightFiles() {
        return (this._selectedComponent?.items ?? []).filter(
            (item) => item.Source !== undefined
        );
    }

    // --- Compare ---------------------------------------------------------

    // Every file of every bundle whose source has been loaded
    get compareFiles() {
        return this._lightningComponentBundles.flatMap((bundle) =>
            (bundle.items ?? [])
                .filter((item) => item.Source !== undefined)
                .map((item) => ({
                    id: item.name,
                    bundle: bundle.label,
                    label: item.label,
                    source: item.Source
                }))
        );
    }
    get comparing() {
        return this._comparing && this.isTypeSource;
    }
    get viewing() {
        return !this.comparing;
    }
    handleCompare() {
        this._comparing = !this._comparing;
    }
    handleCompareExit() {
        this._comparing = false;
    }

    handleInsightSelect(event) {
        const { fileName, line } = event.detail;
        const item = this.insightFiles.find((file) => file.name === fileName);
        if (!item) return;
        this._selectedComponentResource = item;
        // Wait for the viewer to render the file, then jump if supported
        Promise.resolve().then(() => {
            const viewer = this.template.querySelector('my-code-viewer');
            if (viewer && typeof viewer.goToLine === 'function') {
                viewer.goToLine(line);
            }
        });
    }

    handleTabClick(event) {
        const { name } = event.currentTarget.dataset;
        const item = this._selectedComponent.items.find(
            (file) => file.name === name
        );
        if (item) {
            this._comparing = false;
            this._selectedComponentResource = item;
            this.syncHash(false);
        }
    }

    // Arrow keys, Home and End move between the file tabs
    handleTabKeydown(event) {
        const tabs = this.fileTabs;
        const current = tabs.findIndex((tab) => tab.selected);
        if (tabs.length === 0 || current < 0) {
            return;
        }
        const moves = {
            ArrowRight: (current + 1) % tabs.length,
            ArrowLeft: (current - 1 + tabs.length) % tabs.length,
            Home: 0,
            End: tabs.length - 1
        };
        if (!(event.key in moves)) {
            return;
        }
        event.preventDefault();
        const target = tabs[moves[event.key]];
        this.pendingTabFocus = target.name;
        this.handleTabClick({
            currentTarget: { dataset: { name: target.name } }
        });
    }

    renderedCallback() {
        if (this.pendingTabFocus) {
            const tab = [...this.template.querySelectorAll('.tab')].find(
                (el) => el.dataset.name === this.pendingTabFocus
            );
            this.pendingTabFocus = null;
            tab?.focus();
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

    /**
     * The one way to open a component, used by the list, recents and deep
     * links. Loads its files (once) and opens the requested file, or the
     * first one in reading order when none is named.
     * @param {{type: string, bundle: string, file: string|null}} target
     * @param {{push?: boolean}} options push a history entry for the component
     */
    async openTarget(
        { type, bundle: bundleName, file },
        { push = false, force = false } = {}
    ) {
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
        if (!bundle.IsExposed) {
            this.dispatchEvent(
                showToast('Managed Component', 'Unable to view source')
            );
            return;
        }
        // a new selection starts without the previous one's error or spinner
        this.itemError = null;
        this.loadingItems = false;
        this._selectedComponentResource = null;
        this._selectedComponent = bundle;
        if (bundle.items.length === 0 || force) {
            await this.loadSelectedComponentItems(bundle, force);
        }
        // another component may have been picked while the files were loading
        if (this._selectedComponent?.id !== bundle.id) {
            return;
        }
        if (this.itemError) {
            // the panel shows the error with a Retry, keep the selection in the URL
            this.recordNavigation(push);
            return;
        }
        const readable = bundle.items.filter(
            (entry) => entry.Source !== undefined
        );
        let item = file
            ? readable.find((entry) => this.fileSlug(entry) === file)
            : readable[0];
        if (file && !item) {
            this.dispatchEvent(
                showToast('File not found', `${bundleName} has no ${file}`)
            );
            item = readable[0];
        }
        this._selectedComponentResource = item ?? null;
        this.recordNavigation(push);
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
        this.addShortcutListeners();
        this.initLayout();
        this.addConnectivityListeners();
        await this.getLightningComponents();
        if (target) {
            await this.openTarget(target);
        }
    }

    // Keyboard shortcuts: events are dispatched on document by my-shortcuts
    @api focusSearch() {
        this.template.querySelector('lightning-input')?.focus();
    }
    addShortcutListeners() {
        this._shortcutHandlers = {
            'lwci:focus-search': () => this.focusSearch(),
            'lwci:copy-source': () => this.isTypeSource && this.handleCopy(),
            'lwci:prev-tab': () => this.stepTab(-1),
            'lwci:next-tab': () => this.stepTab(1),
            'lwci:toggle-focus': () => this.toggleFocus(),
            'lwci:copy-link': () => this.handleCopyLink(),
            'lwci:open-target': (event) => this.openTarget(event.detail),
            'lwci:palette-request': (event) =>
                event.detail?.respond?.(this.paletteData())
        };
        Object.entries(this._shortcutHandlers).forEach(([name, fn]) =>
            document.addEventListener(name, fn)
        );
    }
    // Answers the command palette (see my/commandPalette)
    paletteData() {
        const type = this.compTypeValue;
        const bundle = this._selectedComponent?.label;
        return {
            bundles: this._lightningComponentBundles.map((entry) => ({
                label: entry.label,
                type
            })),
            files: this.fileTabs.map((tab) => ({
                type,
                bundle,
                file: tab.label
            })),
            canCopySource: this.isTypeSource
        };
    }
    stepTab(delta) {
        const tabs = this.fileTabs;
        const i = tabs.findIndex((tab) => tab.selected);
        if (tabs.length < 2 || i < 0) return;
        const next = tabs[(i + delta + tabs.length) % tabs.length];
        this.handleTabClick({
            currentTarget: { dataset: { name: next.name } }
        });
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

    // Offline banner and "Updated x ago" ticker
    addConnectivityListeners() {
        this.offline = navigator.onLine === false;
        window.addEventListener('online', this.handleOnline);
        window.addEventListener('offline', this.handleOffline);
        this._tick = setInterval(() => {
            this._now = Date.now();
        }, 30000);
    }
    handleOffline = () => {
        this.offline = true;
    };
    handleOnline = () => {
        this.offline = false;
        if (this.loadError) {
            this.getLightningComponents(true);
        }
    };

    handleRefresh() {
        this.getLightningComponents(true);
    }
    handleRetry() {
        this.getLightningComponents(true);
    }
    handleItemRetry() {
        const target = this.currentTarget();
        if (target) {
            this.openTarget(target, { force: true });
        }
    }

    showError(error) {
        this.dispatchEvent(showToast('Something went wrong', error.message));
    }

    async getLightningComponents(force = false) {
        const request = ++this._listRequest;
        this.loadError = null;
        this.refreshing = true;
        this._showingSearch = false;
        try {
            const resp = force
                ? await refreshData(this.compTypeValue)
                : await getLightningComponentBundles(this.compTypeValue, {
                      onRevalidate: (fresh) =>
                          this.applyRevalidated(request, fresh)
                  });
            if (request !== this._listRequest) {
                return; // a newer request owns the result
            }
            if (resp.data.length === 0) {
                //we did not get any results
                this.dispatchEvent(showToast('No Results Found'));
            }
            if (force) {
                this._selectedComponent = null;
                this._selectedComponentResource = null;
            }
            this._lightningComponentBundles = resp.data;
            this.updatedAt = getBundlesUpdatedAt(this.compTypeValue);
            this._now = Date.now();
        } catch (error) {
            if (request === this._listRequest) {
                this.loadError = error.message || 'Unable to load components';
                if (this.isComponents) {
                    this.showError(error);
                }
            }
        } finally {
            if (request === this._listRequest) {
                this.loaded = true;
                this.refreshing = false;
            }
        }
    }

    // Stale-while-revalidate: swap in fresh data unless the user is mid-task
    applyRevalidated(request, fresh) {
        if (
            request !== this._listRequest ||
            this._showingSearch ||
            this._selectedComponent
        ) {
            return;
        }
        this._lightningComponentBundles = fresh.data;
        this.updatedAt = getBundlesUpdatedAt(this.compTypeValue);
        this._now = Date.now();
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
        this.teardownLayout();
        window.removeEventListener('hashchange', this.handleHashChange);
        clearTimeout(this.linkTimer);
        clearInterval(this._tick);
        window.removeEventListener('online', this.handleOnline);
        window.removeEventListener('offline', this.handleOffline);

        Object.entries(this._shortcutHandlers ?? {}).forEach(([name, fn]) =>
            document.removeEventListener(name, fn)
        );
        clearTimeout(this.copyTimer);
    }

    // Copies the text you have selected in the viewer, or the whole file
    async handleCopy() {
        const viewer = this.template.querySelector('my-code-viewer');
        const selected = viewer?.getSelectedText?.() ?? '';
        try {
            await navigator.clipboard.writeText(selected || this.getSource);
            this.copied = true;
            clearTimeout(this.copyTimer);
            this.copyTimer = setTimeout(() => {
                this.copied = false;
            }, 1500);
            this.dispatchEvent(
                showToast(selected ? 'Copied selection' : 'Copied to clipboard')
            );
        } catch {
            this.dispatchEvent(showToast('Unable to copy to clipboard'));
        }
    }

    // Saves just the open file rather than the whole component
    handleDownloadFile() {
        const blob = new Blob([this.getSource], {
            type: 'text/plain;charset=utf-8'
        });
        saveAs(blob, this.fileSlug(this._selectedComponentResource));
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
                this._listRequest++; // supersedes any in-flight list load
                this._showingSearch = true;
                this.loadError = null;
                this._lightningComponentBundles = resp.data;
            }
        } catch (error) {
            // a superseded search is not an error, a newer one is running
            if (!isAbortError(error)) {
                this.showError(error);
            }
        } finally {
            this.dispatchEvent(fireLoading(false));
        }
    }

    /**
     * @param {Event} event click on a component in the list
     */
    async handleSelectComponent(event) {
        const bundle =
            this._lightningComponentBundles[
                Number(event.currentTarget.dataset.index)
            ];
        if (!bundle || bundle.id === this._selectedComponent?.id) {
            return;
        }
        await this.openTarget(
            { type: this.compTypeValue, bundle: bundle.label, file: null },
            { push: true }
        );
    }

    async loadSelectedComponentItems(bundle, force = false) {
        this.itemError = null;
        this.loadingItems = true;
        try {
            const resp = await getLightningComponentBundleById(bundle.id, {
                force
            });
            bundle.items = sortFiles(resp.data);
        } catch (error) {
            this.itemError = error.message || 'Unable to load files';
        } finally {
            // a newer selection owns the loading flag now
            if (bundle.id === this._selectedComponent?.id) {
                this.loadingItems = false;
            }
        }
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

    // --- Workspace layout: splitter, tree collapse, focus mode --------

    initLayout() {
        this.treeWidth = loadWidth();
        this.treeCollapsed = loadCollapsed();
        if (typeof window.matchMedia === 'function') {
            this._mql = window.matchMedia(STACKED_QUERY);
            this.stacked = !!this._mql.matches;
            this._onMql = (event) => {
                this.stacked = !!event.matches;
            };
            if (this._mql.addEventListener) {
                this._mql.addEventListener('change', this._onMql);
            }
        }
        this._onLayoutKeydown = (event) => {
            if (
                event.key === 'Escape' &&
                this.focusMode &&
                !event.defaultPrevented
            ) {
                this.setFocusMode(false);
            }
        };
        this._onLayoutResize = () => {
            // Re-clamp so a shrunk window never leaves the tree too wide
            this.treeWidth = clamp(
                this.treeWidth,
                MIN_TREE_WIDTH,
                this.maxTreeWidthValue
            );
        };
        document.addEventListener('keydown', this._onLayoutKeydown);
        window.addEventListener('resize', this._onLayoutResize);
    }

    teardownLayout() {
        document.removeEventListener('keydown', this._onLayoutKeydown);
        window.removeEventListener('resize', this._onLayoutResize);
        this._mql?.removeEventListener?.('change', this._onMql);
        document.documentElement.removeAttribute('data-focus');
    }

    get maxTreeWidthValue() {
        const panes = this.template.querySelector('.panes');
        return maxTreeWidth(panes ? panes.getBoundingClientRect().width : 0);
    }
    get treeHidden() {
        return this.treeCollapsed || this.focusMode;
    }
    get showSplitter() {
        return !this.stacked && !this.treeHidden;
    }
    get showTreeToggle() {
        return !this.stacked && !this.focusMode;
    }
    get treeExpanded() {
        return !this.treeCollapsed;
    }
    get treeToggleLabel() {
        return this.treeCollapsed
            ? 'Show component tree'
            : 'Hide component tree';
    }
    get chevronClass() {
        return this.treeCollapsed ? 'chevron chevron-collapsed' : 'chevron';
    }
    get treeStyle() {
        if (this.stacked) return '';
        const width = this.treeHidden ? 0 : this.treeWidth;
        return `flex: 0 0 ${width}px; width: ${width}px;`;
    }
    get treeClass() {
        let cls = 'pane-tree';
        if (!this.stacked && this.treeHidden) cls += ' pane-tree-hidden';
        if (this.resizing) cls += ' pane-tree-resizing';
        return cls;
    }
    get explorerClass() {
        return this.focusMode ? 'explorer explorer-focus' : 'explorer';
    }
    get isFocusMode() {
        return this.focusMode;
    }
    get focusLabel() {
        return this.focusMode ? 'Exit focus' : 'Focus';
    }
    get focusTitle() {
        return this.focusMode ? 'Exit focus mode (Esc)' : 'Focus mode (f)';
    }

    handleSplitterResize(event) {
        const { value, final } = event.detail;
        this.resizing = !final;
        this.treeWidth = clamp(value, MIN_TREE_WIDTH, this.maxTreeWidthValue);
        if (final) saveWidth(this.treeWidth);
    }

    handleSplitterReset() {
        this.resizing = false;
        this.treeWidth = DEFAULT_TREE_WIDTH;
        clearWidth();
    }

    handleTreeToggle() {
        this.treeCollapsed = !this.treeCollapsed;
        saveCollapsed(this.treeCollapsed);
    }

    handleFocusToggle() {
        this.toggleFocus();
    }

    toggleFocus() {
        this.setFocusMode(!this.focusMode);
    }

    setFocusMode(on) {
        this.focusMode = !!on;
        const root = document.documentElement;
        if (this.focusMode) root.setAttribute('data-focus', 'true');
        else root.removeAttribute('data-focus');
    }
}
