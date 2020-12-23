/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: MIT
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
 */

import { LightningElement, api, track } from 'lwc';
import {
    normalizeBoolean,
    synchronizeAttrs,
    getRealDOMId,
    normalizeString as normalize,
    classListMutation
} from 'c/utilsPrivate';
import {
    isEmptyString,
    InteractingState,
    FieldConstraintApi,
    generateUniqueId,
    normalizeVariant,
    VARIANT
} from 'c/inputUtils';
import { classSet } from 'c/utils';

export default class cInput extends LightningElement {
    @api type;

    @api label;

    @api input;

    @api placeholder;

    @api required = false;

    @api options;

    @api value;

    @api disabled = false ;

    @api messageWhenValueMissing;

    @api name = generateUniqueId();

    get isRequired() {
        return this.required;
    }

    getId() {
        return this.input;
    }
    @api
    getElement() {
        return {
            id: this.getId(), 
            element: this.template.querySelector(`[data-element="input"]`), 
            value: this.template.querySelector(`[data-element="input"]`).value
        };
    }
    @api
    getValue() {
        return {
            value: this.template.querySelector(`[data-element="input"]`).value
        };
    }
    handleChange(event) {
        event.stopPropagation();


        if ( this.value === event.target.value) {
            return;
        }

        this._dispatchChangeEvent();
    }

    _dispatchChangeEvent() {
        const detail = {}  ; 
        detail.value = this.template.querySelector("input").value ; 

        this.dispatchEvent(
            new CustomEvent('change', {
                composed: true,
                bubbles: true,
                detail,
            })
        );
    }

  
}
