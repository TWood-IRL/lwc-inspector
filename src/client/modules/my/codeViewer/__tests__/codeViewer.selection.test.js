import { createElement } from 'lwc';
import CodeViewer from 'my/codeViewer';

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

const create = async (props) => {
    const element = createElement('my-code-viewer', { is: CodeViewer });
    Object.assign(element, props);
    document.body.appendChild(element);
    await flushPromises();
    return element;
};

describe('my-code-viewer getSelectedText', () => {
    afterEach(() => {
        window.getSelection().removeAllRanges();
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
    });

    it('returns nothing when nothing is selected', async () => {
        const element = await create({ code: 'let a = 1;', fileName: 'x.js' });

        expect(element.getSelectedText()).toBe('');
    });

    it('returns the text selected inside the code', async () => {
        const element = await create({
            code: 'let a = 1;\nlet b = 2;',
            fileName: 'x.js'
        });
        const code = element.shadowRoot.querySelector('code');

        window.getSelection().selectAllChildren(code);

        expect(element.getSelectedText()).toBe('let a = 1;\nlet b = 2;');
    });

    it('ignores a selection made elsewhere on the page', async () => {
        const element = await create({ code: 'let a = 1;', fileName: 'x.js' });
        const outside = document.createElement('p');
        outside.textContent = 'not in the viewer';
        document.body.appendChild(outside);

        window.getSelection().selectAllChildren(outside);

        expect(element.getSelectedText()).toBe('');
    });
});
