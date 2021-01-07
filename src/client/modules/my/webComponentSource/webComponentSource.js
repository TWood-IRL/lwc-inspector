/**
 * Represents the individual source elements
 */
import { LightningElement, api } from 'lwc';

export default class WebComponentSource extends LightningElement {
    @api file;
    isCollapsed = true;
    toggle() {
        this.isCollapsed = !this.isCollapsed;
    }
}
