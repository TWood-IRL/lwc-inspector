// Local/Heroku entry point. On Vercel the app is exported from /api/index.js instead.
const app = require('./app');

const HOST = process.env.HOST || 'localhost';
const PORT = process.env.PORT || 3002;

app.listen(PORT, () =>
    console.log(
        `✅  API Server started: http://${HOST}:${PORT}/api/v1/endpoint`
    )
);
