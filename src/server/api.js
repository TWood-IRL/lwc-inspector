// Simple Express server setup to serve for local testing/dev API server
const compression = require('compression');
const helmet = require('helmet');
const express = require('express');

// To enable server-side sessions
const session = require('express-session');

// JSForce
const jsforce = require('jsforce');

// OPTIONAL: Logging service. Alternately, can use console.error as well
// In production, we should write to a file, not just console
const winston = require('winston');
require('dotenv').config();

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

const app = express();
//        "default-src 'self'; font-src 'self' ; img-src 'self' ; script-src 'self' https://www.googletagmanager.com/ 'sha256-R2sgUB2K/fMRAYLzVS86WdscTu/ZXKlhhFO++Z3NqFQ='; style-src 'self'  ; frame-src 'self' https://www.googletagmanager.com/ ;"

app.use(
    //https://www.npmjs.com/package/helmet
    helmet.contentSecurityPolicy({
        directives: {
            ...helmet.contentSecurityPolicy.getDefaultDirectives(),
            'script-src': [
                "'self'",
                'googletagmanager.com/*',
                '*.herokuapp.com'
            ],
            'frame-src': ["'self'", 'googletagmanager.com/*', '*.herokuapp.com']
        }
    })
);
app.use(compression());

//Retrieve Configuration
const HOST = process.env.HOST || 'localhost';
const PORT = process.env.PORT || 3002;
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
let authService = new AuthenticationService(logger, oauth2Prod);
let integrationService = new IntegrationService(logger, authService);
const DIST_DIR = './dist';

//Enable server-side sessions
app.use(
    session({
        secret: NODE_SESSION_SECRET_KEY,
        cookie: { secure: 'auto' },
        resave: false,
        saveUninitialized: false
    })
);

app.use(express.static(DIST_DIR));

// app.get('/', (req, res) => {
//     if(HOST==="localhost"){
//         res.redirect("http://localhost:3001") ;
//     }
//     //res.json({ success: true });
// });

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
    let login_type = req.query.login_type;
    if (login_type === 'SANDBOX') {
        //reinitialize with test url .. .
        authService = new AuthenticationService(logger, oauth2Sandbox);
    } else {
        authService = new AuthenticationService(logger, oauth2Prod);
    }
    integrationService = new IntegrationService(logger, authService);
    authService.redirectToAuthUrl(res);
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

app.listen(PORT, () =>
    console.log(
        `✅  API Server started: http://${HOST}:${PORT}/api/v1/endpoint`
    )
);
