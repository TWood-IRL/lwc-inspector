import fs from 'node:fs';
import path from 'node:path';
import lwc from '@lwc/rollup-plugin';
import replace from '@rollup/plugin-replace';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import terser from '@rollup/plugin-terser';

const isProd = process.env.NODE_ENV === 'production';
const OUT_DIR = 'dist';

// Copies static assets (html shell, images, SLDS) next to the bundle
function copyStatic() {
    const copies = [
        ['src/client/index.html', `${OUT_DIR}/index.html`],
        ['src/client/resources', `${OUT_DIR}/resources`],
        [
            'node_modules/@salesforce-ux/design-system/assets',
            `${OUT_DIR}/resources/slds`
        ]
    ];
    return {
        name: 'copy-static',
        buildStart() {
            for (const [from] of copies) {
                this.addWatchFile(path.resolve(from));
            }
        },
        writeBundle() {
            for (const [from, to] of copies) {
                fs.cpSync(from, to, { recursive: true });
            }
        }
    };
}

export default {
    input: 'src/client/index.js',
    output: {
        file: `${OUT_DIR}/resources/app.js`,
        format: 'esm',
        inlineDynamicImports: true,
        sourcemap: !isProd
    },
    plugins: [
        replace({
            preventAssignment: true,
            values: {
                'process.env.NODE_ENV': JSON.stringify(
                    isProd ? 'production' : 'development'
                )
            }
        }),
        lwc({
            rootDir: process.cwd(),
            modules: [
                { dir: 'src/client/modules' },
                { npm: 'lightning-base-components' }
            ]
        }),
        resolve({ browser: true }),
        commonjs(),
        isProd && terser(),
        copyStatic()
    ].filter(Boolean)
};
