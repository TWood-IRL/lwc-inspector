const lwcConfig = require('@salesforce/eslint-config-lwc');
const inclusiveLanguage = require('eslint-plugin-inclusive-language');
const globals = require('globals');

module.exports = [
    { ignores: ['dist/', 'coverage/', 'lib/', 'src/client/resources/'] },
    ...lwcConfig.configs.recommended,
    {
        plugins: { 'inclusive-language': inclusiveLanguage },
        rules: {
            '@lwc/lwc/no-async-operation': 'off',
            '@lwc/lwc/no-inner-html': 'warn',
            '@lwc/lwc/no-document-query': 'warn',
            'inclusive-language/use-inclusive-words': 'error'
        }
    },
    {
        files: [
            'src/server/**',
            'scripts/**',
            'api/**',
            'jest.config.js',
            'rollup.config.mjs',
            'eslint.config.js'
        ],
        languageOptions: {
            sourceType: 'script',
            parserOptions: { sourceType: 'script' },
            globals: globals.node
        }
    }
];
