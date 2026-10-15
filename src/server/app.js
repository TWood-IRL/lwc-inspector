// Simple Express server setup to serve for local testing/dev API server
const compression = require('compression');
const helmet = require('helmet');
const express = require('express');

// Stateless sessions stored in a signed cookie (works on serverless hosts)
const cookieSession = require('cookie-session');

// JSForce
const jsforce = require('jsforce');

// OPTIONAL: Logging service. Alternately, can use console.error as well
// In production, we should write to a file, not just console
const winston = require('winston');
require('dotenv').config({ quiet: true });

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.json(),
    transports: [
        new winston.transports.Console({
            format: winston.format.simple()
        })
    ]
});

// Import Salesforce Authentication modules
const AuthenticationService = require('./AuthenticationService');
const IntegrationService = require('./IntegrationService');

// Load .env configuration file

//Retrieve Configuration
const {
    SALESFORCE_CLIENT_ID,
    SALESFORCE_CLIENT_SECRET,
    SALESFORCE_CALLBACK_URL,
    LOGIN_URL_SANDBOX,
    LOGIN_URL_PROD,
    NODE_SESSION_SECRET_KEY
} = process.env;

// Initialize OAuth2 config
const oauth2Prod = new jsforce.OAuth2({
    loginUrl: LOGIN_URL_PROD,
    clientId: SALESFORCE_CLIENT_ID,
    clientSecret: SALESFORCE_CLIENT_SECRET,
    redirectUri: SALESFORCE_CALLBACK_URL
});
const oauth2Sandbox = new jsforce.OAuth2({
    loginUrl: LOGIN_URL_SANDBOX,
    clientId: SALESFORCE_CLIENT_ID,
    clientSecret: SALESFORCE_CLIENT_SECRET,
    redirectUri: SALESFORCE_CALLBACK_URL
});
// Initialize Auth Services
const authService = new AuthenticationService(logger, {
    PROD: oauth2Prod,
    SANDBOX: oauth2Sandbox
});
const integrationService = new IntegrationService(logger, authService);
const DIST_DIR = './dist';

const app = express();
// Needed behind a proxy (Heroku, Vercel) so secure cookies are detected
app.set('trust proxy', 1);

app.use(
    //https://www.npmjs.com/package/helmet
    helmet.contentSecurityPolicy({
        directives: {
            ...helmet.contentSecurityPolicy.getDefaultDirectives(),
            // Don't force https for subresources when running on http://localhost
            'upgrade-insecure-requests':
                process.env.NODE_ENV === 'production' ? [] : null,
            'script-src': [
                "'self'",
                "'unsafe-inline'",
                "'unsafe-eval'",
                'https://www.googletagmanager.com',
                '*.herokuapp.com',
                'https://*.google.com'
            ],
            'connect-src': [
                "'self'",
                'https://www.google-analytics.com',
                '*.herokuapp.com'
            ],
            'frame-src': [
                "'self'",
                'googletagmanager.com/*',
                '*.herokuapp.com'
            ],
            'img-src': ['*']
        }
    })
);

app.use(compression());

//Enable cookie-based sessions
app.use(
    cookieSession({
        name: 'session',
        keys: [NODE_SESSION_SECRET_KEY],
        maxAge: 8 * 60 * 60 * 1000,
        httpOnly: true,
        sameSite: 'lax'
    })
);

app.use(express.static(DIST_DIR));

app.get('/api/v1/endpoint', (req, res) => {
    res.json({ success: true });
});

app.get('/api/v1/sessionId', (req, res) => {
    try {
        let sessionInfo = {
            spoofed: true,
            sfdcAccessToken: req.query.sessionId,
            sfdcInstanceUrl: req.query.myDomainURL
        };
        authService.setSession(req, res, sessionInfo);

        res.redirect('/');
    } catch (err) {
        res.status(500).send(err);
    }
});

// Login to Salesforce ///http://localhost:3002/oauth2/login - WORKING
app.get('/oauth2/login', (req, res) => {
    authService.redirectToAuthUrl(req, res);
});

// Callback function to get Auth Token
app.get('/auth/callback', (req, res) => {
    authService.doCallback(req, res);
});

// Get Logged In User Details
app.get('/oauth2/whoami', (req, res) => {
    authService.getLoggedInUserDetails(req, res);
});

// Logout from Salesforce
app.get('/oauth2/logout', (req, res) => {
    authService.doLogout(req, res);
});

//Get LightningComponents
app.get('/api/LightningComponents', (req, res) => {
    integrationService.getLightningComponentBundles(req, res);
});
//Get LightningComponents Contents
app.get('/api/LightningComponent/:id', (req, res) => {
    //res.json({ data: 'In Progress' });
    integrationService.getLightningComponent(req, res);
});

module.exports = app;
