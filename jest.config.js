module.exports = {
    preset: '@lwc/jest-preset',
    moduleNameMapper: {
        // Keep in sync with the module list in rollup.config.mjs
        '^(my|data|c)/(.+)$': '<rootDir>/src/client/modules/$1/$2/$2',
        // lightning-base-components ships untranspiled ESM, so stub it in unit tests
        '^lightning/(.+)$': '<rootDir>/jest-mocks/lightningStub.js'
    },
    testPathIgnorePatterns: [
        '<rootDir>/node_modules/',
        '<rootDir>/dist/',
        '<rootDir>/.claude/'
    ],
    modulePathIgnorePatterns: ['<rootDir>/.claude/']
};
