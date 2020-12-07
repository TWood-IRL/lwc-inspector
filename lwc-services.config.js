// Find the full example of all available configuration options at
// https://github.com/muenzpraeger/create-lwc-app/blob/main/packages/lwc-services/example/lwc-services.config.js
module.exports = {
    resources: [
        { from: 'src/client/resources/', to: 'dist/resources/' },
        {
            from: 'node_modules/bootstrap/dist',
            to: 'src/client/boostrap'
        }
    ],

    sourceDir: './src/client',

    devServer: {
        proxy: { '/': 'http://localhost:3002' }
    },
    server: {
        customConfig: './src/server/index.js'
    }
};
