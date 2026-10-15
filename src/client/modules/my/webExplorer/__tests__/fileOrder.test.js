import { sortFiles } from '../fileOrder';

const labels = (files) => files.map((file) => file.label);

describe('sortFiles', () => {
    it('orders LWC files template, controller, styles, metadata', () => {
        const sorted = sortFiles([
            { label: 'lwc/x/x.js-meta.xml' },
            { label: 'lwc/x/x.css' },
            { label: 'lwc/x/x.js' },
            { label: 'lwc/x/x.html' }
        ]);

        expect(labels(sorted)).toEqual([
            'lwc/x/x.html',
            'lwc/x/x.js',
            'lwc/x/x.css',
            'lwc/x/x.js-meta.xml'
        ]);
    });

    it('orders Aura definitions by type', () => {
        const sorted = sortFiles([
            { label: 'STYLE' },
            { label: 'HELPER' },
            { label: 'CONTROLLER' },
            { label: 'COMPONENT' }
        ]);

        expect(labels(sorted)).toEqual([
            'COMPONENT',
            'CONTROLLER',
            'HELPER',
            'STYLE'
        ]);
    });

    it('puts unknown files last, alphabetically, without mutating the input', () => {
        const input = [
            { label: 'lwc/x/zebra.txt' },
            { label: 'lwc/x/apple.txt' },
            { label: 'lwc/x/x.html' }
        ];

        const sorted = sortFiles(input);

        expect(labels(sorted)).toEqual([
            'lwc/x/x.html',
            'lwc/x/apple.txt',
            'lwc/x/zebra.txt'
        ]);
        expect(labels(input)[0]).toBe('lwc/x/zebra.txt');
    });
});
