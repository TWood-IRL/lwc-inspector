import { createElement } from 'lwc';
import CodeViewer from 'my/codeViewer';
import { languageFor, highlight } from '../highlight';

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

const create = async (props) => {
    const element = createElement('my-code-viewer', { is: CodeViewer });
    Object.assign(element, props);
    document.body.appendChild(element);
    await flushPromises();
    return element;
};

describe('highlight helpers', () => {
    it('detects the language from the file extension', () => {
        expect(languageFor('lwc/a/a.js')).toBe('javascript');
        expect(languageFor('lwc/a/a.html')).toBe('xml');
        expect(languageFor('lwc/a/a.css')).toBe('css');
        expect(languageFor('lwc/a/a.js-meta.xml')).toBe('xml');
        expect(languageFor('lwc/a/data.json')).toBe('json');
        expect(languageFor('lwc/a/readme.md')).toBe('plaintext');
    });

    it('falls back to the Format for Aura definitions', () => {
        expect(languageFor('CONTROLLER', 'JS')).toBe('javascript');
        expect(languageFor('STYLE', 'CSS')).toBe('css');
        expect(languageFor('COMPONENT', 'XML')).toBe('xml');
    });

    it('escapes html in plain text and highlighted output', () => {
        expect(highlight('<b>"x"</b>', 'plaintext')).toBe(
            '&lt;b&gt;&quot;x&quot;&lt;/b&gt;'
        );
        expect(highlight('const a = "<img>";', 'javascript')).not.toContain(
            '<img>'
        );
    });
});

describe('my-code-viewer', () => {
    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
    });

    it('renders highlighted code, line numbers and a status bar', async () => {
        const element = await create({
            code: 'const a = 1;\nconst b = 2;',
            fileName: 'lwc/x/x.js'
        });

        const code = element.shadowRoot.querySelector('code');
        expect(code.querySelector('.hljs-keyword').textContent).toBe('const');
        expect(code.textContent).toBe('const a = 1;\nconst b = 2;');
        expect(element.shadowRoot.querySelector('.gutter').textContent).toBe(
            '1\n2'
        );
        const status =
            element.shadowRoot.querySelector('.status-bar').textContent;
        expect(status).toContain('JavaScript');
        expect(status).toContain('2 lines');
    });

    it('re-renders when the code changes', async () => {
        const element = await create({ code: 'a', fileName: 'x.js' });

        element.code = 'let z;\nlet y;\nlet x;';
        await flushPromises();

        expect(element.shadowRoot.querySelector('code').textContent).toBe(
            'let z;\nlet y;\nlet x;'
        );
        expect(element.shadowRoot.querySelector('.gutter').textContent).toBe(
            '1\n2\n3'
        );
    });

    it('never turns source markup into real elements', async () => {
        const element = await create({
            code: '<script>alert(1)</script>',
            fileName: 'x.html'
        });

        const code = element.shadowRoot.querySelector('code');
        expect(code.querySelector('script')).toBeNull();
        expect(code.textContent).toBe('<script>alert(1)</script>');
    });
});
