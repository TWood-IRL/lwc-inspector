import { LightningElement, api } from 'lwc';

/**
 * Presentational row of recently viewed bundles.
 * Fires `select` ({ name, type }) and `clear`.
 */
export default class RecentChips extends LightningElement {
    @api items = [];

    get hasItems() {
        return Array.isArray(this.items) && this.items.length > 0;
    }

    get chips() {
        return (this.items ?? []).map((item) => ({
            key: `${item.type}:${item.name}`,
            name: item.name,
            type: item.type,
            label: item.label || item.name,
            badge: item.type === 'auraComps' ? 'Aura' : 'LWC',
            title: `Reopen ${item.label || item.name}`
        }));
    }

    handleChipClick(event) {
        const { name, type } = event.currentTarget.dataset;
        this.dispatchEvent(
            new CustomEvent('select', { detail: { name, type } })
        );
    }

    handleClear() {
        this.dispatchEvent(new CustomEvent('clear'));
    }
}
