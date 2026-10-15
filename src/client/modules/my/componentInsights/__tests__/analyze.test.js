/* eslint-disable inclusive-language/use-inclusive-words -- "master" is the Salesforce metadata tag name */
import {
    analyzeJs,
    analyzeHtml,
    analyzeMeta,
    analyzeBundle,
    fileKind,
    countLines,
    stripJsComments
} from '../analyze';

const JS = `import { LightningElement, api, wire, track } from 'lwc';
import { getRecord } from 'lightning/uiRecordApi';
import { NavigationMixin } from 'lightning/navigation';
import getContacts from '@salesforce/apex/ContactController.getContacts';
import GREETING from '@salesforce/label/c.Greeting';
import NAME_FIELD from '@salesforce/schema/Account.Name';
import helper from 'c/helper';
import 'c/sideEffect';
// @api commented = 1;
/* @wire(getRecord, {}) fake; connectedCallback() { } */
export default class AccountCard extends NavigationMixin(LightningElement) {
    @api recordId;
    @api
    objectApiName = 'Account';
    @api get title() { return this._t; }
    set title(v) { this._t = v; }
    @api static foo;
    @api
    async refresh(force) {
        this.dispatchEvent(new CustomEvent('refreshed', { detail: 1 }));
    }
    @wire(getRecord, { recordId: '$recordId', fields: [NAME_FIELD] })
    account;
    @wire(getContacts, { id: '$recordId' }) wiredContacts({ data }) {}
    constructor() { super(); }
    connectedCallback() {
        const s = "connectedCallback() { }";
        this.dispatchEvent(new CustomEvent("select"));
    }
    renderedCallback() {}
    handleX() { this.dispatchEvent(new CustomEvent(\`multi\`)); }
}
`;

describe('analyzeJs', () => {
    const r = analyzeJs(JS);

    it('finds the base class and class name', () => {
        expect(r.className).toBe('AccountCard');
        expect(r.extends).toBe('NavigationMixin(LightningElement)');
        expect(analyzeJs('class A extends LightningElement {}').extends).toBe(
            'LightningElement'
        );
        expect(analyzeJs('export default class A {}').extends).toBeNull();
    });

    it('classifies @api members', () => {
        expect(r.api.map((a) => [a.name, a.kind])).toEqual([
            ['recordId', 'property'],
            ['objectApiName', 'property'],
            ['title', 'getter'],
            ['foo', 'property'],
            ['refresh', 'method']
        ]);
        expect(r.api[0].line).toBe(12);
        expect(r.api[1].line).toBe(13);
    });

    it('finds @setter via @api set', () => {
        const x = analyzeJs(
            'class A { @api set value(v) {} @api get value() {} }'
        );
        expect(x.api.map((a) => a.kind)).toEqual(['setter', 'getter']);
    });

    it('finds @wire adapters with targets and config', () => {
        expect(r.wires).toHaveLength(2);
        expect(r.wires[0]).toMatchObject({
            adapter: 'getRecord',
            target: 'account'
        });
        expect(r.wires[0].config).toContain('$recordId');
        expect(r.wires[1]).toMatchObject({
            adapter: 'getContacts',
            target: 'wiredContacts'
        });
    });

    it('categorises imports and ignores commented code', () => {
        const by = (cat) =>
            r.imports.filter((i) => i.category === cat).map((i) => i.specifier);
        expect(by('label')).toEqual(['@salesforce/label/c.Greeting']);
        expect(by('schema')).toEqual(['@salesforce/schema/Account.Name']);
        expect(by('apex')).toEqual([
            '@salesforce/apex/ContactController.getContacts'
        ]);
        expect(by('lightning')).toEqual([
            'lightning/uiRecordApi',
            'lightning/navigation'
        ]);
        expect(by('component')).toEqual(['c/helper', 'c/sideEffect']);
        expect(by('module')).toEqual(['lwc']);
        expect(r.api.find((a) => a.name === 'commented')).toBeUndefined();
    });

    it('lists lifecycle hooks once, ignoring strings and comments', () => {
        expect(r.lifecycle.map((h) => h.name)).toEqual([
            'constructor',
            'connectedCallback',
            'renderedCallback'
        ]);
        expect(
            r.lifecycle.find((h) => h.name === 'connectedCallback').line
        ).toBe(26);
    });

    it('finds custom events with all quote styles', () => {
        expect(r.events.map((e) => e.name)).toEqual([
            'refreshed',
            'select',
            'multi'
        ]);
    });

    it('never throws on malformed input', () => {
        const bad = [
            undefined,
            null,
            42,
            {},
            '',
            '@api',
            '@wire(',
            '@wire(getRecord, { a: (',
            'import { from',
            "import x from '",
            'class extends {',
            "new CustomEvent('",
            '/* unterminated',
            '"unterminated string\n@api x;',
            '`template ${'
        ];
        bad.forEach((b) => expect(() => analyzeJs(b)).not.toThrow());
        expect(analyzeJs(undefined).api).toEqual([]);
        expect(analyzeJs('"oops\n@api ok;').api[0].name).toBe('ok');
    });
});

describe('stripJsComments', () => {
    it('keeps line count and string contents', () => {
        const src = "a // x\n/* b\n c */ 'http://not-comment'\n";
        const out = stripJsComments(src);
        expect(out.split('\n')).toHaveLength(src.split('\n').length);
        expect(out).toContain("'http://not-comment'");
        expect(out).not.toContain('b\n');
    });
});

const HTML = `<template>
    <!-- <c-hidden></c-hidden> -->
    <lightning-card title="Hi">
        <template lwc:if={a}>
            <c-child-one></c-child-one>
        </template>
        <template lwc:elseif={b}><c-child-one></c-child-one></template>
        <template lwc:else>
            <template for:each={items} for:item="i" for:index="ix">
                <c-row key={i.id}></c-row>
            </template>
        </template>
        <template if:true={x}></template>
        <template iterator:it={items}></template>
        <div lwc:dom="manual"></div>
        <slot></slot>
        <slot name="footer"></slot>
        <c-ns-thing
            lwc:spread={props}
        ></c-ns-thing>
    </lightning-card>
</template>`;

describe('analyzeHtml', () => {
    const r = analyzeHtml(HTML);

    it('finds child components, counting repeats and skipping comments', () => {
        const byName = Object.fromEntries(r.components.map((c) => [c.name, c]));
        expect(Object.keys(byName).sort()).toEqual([
            'c-child-one',
            'c-ns-thing',
            'c-row',
            'lightning-card'
        ]);
        expect(byName['c-child-one'].count).toBe(2);
        expect(byName['c-child-one'].line).toBe(5);
        expect(byName['lightning-card'].kind).toBe('base');
        expect(byName['c-row'].kind).toBe('custom');
    });

    it('finds slots', () => {
        expect(r.slots.map((s) => s.name)).toEqual(['(default)', 'footer']);
        expect(r.slots[1].line).toBe(17);
    });

    it('finds directives', () => {
        const names = r.directives.map((d) => d.name).sort();
        expect(names).toEqual(
            [
                'for:each',
                'for:index',
                'for:item',
                'if:true',
                'iterator',
                'lwc:dom',
                'lwc:else',
                'lwc:elseif',
                'lwc:if',
                'lwc:spread'
            ].sort()
        );
    });

    it('does not treat text content as directives', () => {
        expect(analyzeHtml('<p>use lwc:if here</p>').directives).toHaveLength(
            0
        );
    });

    it('handles Aura markup', () => {
        const a = analyzeHtml(
            `<aura:component>\n<aura:attribute name="x" type="String"/>\n<c:foo/><lightning:button label="a"/></aura:component>`
        );
        expect(a.attributes).toEqual([{ name: 'x', type: 'String', line: 2 }]);
        expect(a.components.map((c) => c.name)).toEqual([
            'c:foo',
            'lightning:button'
        ]);
    });

    it('never throws on malformed input', () => {
        [
            undefined,
            null,
            7,
            '<',
            '<c-',
            '<!-- open',
            '<slot name=',
            '<<>>'
        ].forEach((b) => expect(() => analyzeHtml(b)).not.toThrow());
    });
});

const META = `<?xml version="1.0" encoding="UTF-8"?>
<LightningComponentBundle xmlns="http://soap.sforce.com/2006/04/metadata">
    <apiVersion>59.0</apiVersion>
    <isExposed>true</isExposed>
    <masterLabel>Account &amp; Card</masterLabel>
    <!-- <target>lightning__Nope</target> -->
    <targets>
        <target>lightning__RecordPage</target>
        <target>lightning__AppPage</target>
    </targets>
    <targetConfigs>
        <targetConfig targets="lightning__RecordPage">
            <objects><object>Account</object></objects>
            <property name="title" type="String" default="Hi" label="Title" required="true"/>
            <property name="size" type="Integer"></property>
            <supportedFormFactors><supportedFormFactor type="Large"/></supportedFormFactors>
        </targetConfig>
    </targetConfigs>
    <masters>
        <master>Account.Page</master>
    </masters>
</LightningComponentBundle>`;

describe('analyzeMeta', () => {
    const r = analyzeMeta(META);
    it('reads scalar values', () => {
        expect(r.apiVersion).toBe('59.0');
        expect(r.isExposed).toBe(true);
        expect(r.masterLabel).toBe('Account & Card');
        expect(r.lines).toEqual({ apiVersion: 3, isExposed: 4 });
    });
    it('reads targets, masters and properties', () => {
        expect(r.targets.map((t) => t.name)).toEqual([
            'lightning__RecordPage',
            'lightning__AppPage'
        ]);
        expect(r.masters.map((t) => t.name)).toEqual(['Account.Page']);
        expect(r.properties).toHaveLength(2);
        expect(r.properties[0]).toMatchObject({
            name: 'title',
            type: 'String',
            default: 'Hi',
            label: 'Title',
            required: true
        });
        expect(r.properties[1].required).toBe(false);
    });
    it('reports false and missing values', () => {
        expect(analyzeMeta('<isExposed>false</isExposed>').isExposed).toBe(
            false
        );
        expect(analyzeMeta('<a/>').apiVersion).toBeNull();
    });
    it('never throws', () => {
        [
            undefined,
            null,
            1,
            '<apiVersion>',
            '<property name=',
            '<target>'
        ].forEach((b) => expect(() => analyzeMeta(b)).not.toThrow());
    });
});

describe('helpers', () => {
    it('classifies files', () => {
        expect(fileKind({ label: 'lwc/a/a.js-meta.xml' })).toBe('meta');
        expect(fileKind({ label: 'lwc/a/a.js' })).toBe('js');
        expect(fileKind({ label: 'lwc/a/a.html' })).toBe('html');
        expect(fileKind({ label: 'lwc/a/a.css' })).toBe('css');
        expect(fileKind({ label: 'aura/a/a.cmp' })).toBe('cmp');
        expect(fileKind({ label: 'CONTROLLER', Format: 'JS' })).toBe('js');
        expect(fileKind({ label: 'COMPONENT', Format: 'XML' })).toBe('cmp');
        expect(fileKind(null)).toBe('other');
    });
    it('counts lines', () => {
        expect(countLines('')).toBe(0);
        expect(countLines('a')).toBe(1);
        expect(countLines('a\nb\n')).toBe(2);
        expect(countLines(undefined)).toBe(0);
    });
});

describe('analyzeBundle', () => {
    const files = [
        {
            name: 'f1',
            label: 'lwc/accountCard/accountCard.js',
            Source: JS,
            Format: 'JS'
        },
        {
            name: 'f2',
            label: 'lwc/accountCard/accountCard.html',
            Source: HTML,
            Format: 'HTML'
        },
        {
            name: 'f3',
            label: 'lwc/accountCard/accountCard.css',
            Source: ':host{}\n',
            Format: 'CSS'
        },
        {
            name: 'f4',
            label: 'lwc/accountCard/accountCard.js-meta.xml',
            Source: META,
            Format: 'XML'
        }
    ];
    const r = analyzeBundle(files);

    it('builds the file table and totals', () => {
        expect(r.files.map((f) => f.shortLabel)).toEqual([
            'accountCard.js',
            'accountCard.html',
            'accountCard.css',
            'accountCard.js-meta.xml'
        ]);
        expect(r.files[2]).toMatchObject({ lines: 1, bytes: 8, kb: '0.0' });
        expect(r.totals.files).toBe(4);
        expect(r.totals.lines).toBe(r.files.reduce((s, f) => s + f.lines, 0));
        expect(r.totals.kb).toBe((r.totals.bytes / 1024).toFixed(1));
    });

    it('counts utf-8 bytes, not characters', () => {
        const x = analyzeBundle([
            { name: 'a', label: 'a.css', Source: 'é€😀' }
        ]);
        expect(x.files[0].bytes).toBe(2 + 3 + 4);
    });

    it('produces ordered sections with file/line items', () => {
        expect(r.sections.map((s) => s.id)).toEqual([
            'base',
            'api',
            'wire',
            'imports',
            'lifecycle',
            'events',
            'children',
            'slots',
            'directives',
            'meta',
            'targets',
            'masters',
            'properties'
        ]);
        const api = r.sections.find((s) => s.id === 'api');
        expect(api.count).toBe(5);
        expect(api.items[0]).toMatchObject({
            file: 'f1',
            text: 'recordId',
            detail: 'property',
            line: 12
        });
        const keys = r.sections.flatMap((s) => s.items.map((i) => i.key));
        expect(new Set(keys).size).toBe(keys.length);
    });

    it('never throws on garbage', () => {
        [undefined, null, 'x', [null, 1, {}, { Source: 5 }]].forEach((b) =>
            expect(() => analyzeBundle(b)).not.toThrow()
        );
        expect(analyzeBundle(undefined).totals.files).toBe(0);
        expect(analyzeBundle([null, 3]).files).toEqual([]);
    });
});
