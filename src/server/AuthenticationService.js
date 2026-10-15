const jsforce = require('jsforce');

module.exports = class AuthenticationService {
    /**
     * Builds the authentication service
     * @param {winston.Logger} logger
     * @param {{PROD: jsforce.OAuth2, SANDBOX: jsforce.OAuth2}} oauth2Clients
     */
    constructor(logger, oauth2Clients) {
        this.logger = logger;
        this.oauth2Clients = oauth2Clients;
    }

    /**
     * Attempts to retrieve the server session.
     * @param {Object} req - server request
     * @returns {Object} session data or null if there was no session
     */
    getSession(req) {
        const { session } = req;
        if (!session || session.sfdcAccessToken === undefined) {
            return null;
        }
        return session;
    }

    setSession(req, res, session) {
        req.session.sfdcAccessToken = session.sfdcAccessToken;
        req.session.spoofed = session.spoofed;
        req.session.sfdcInstanceUrl = session.sfdcInstanceUrl;
    }

    /**
     * Picks the OAuth2 client for the login type stored on the session
     * @param {Object} req - server request
     */
    _getOauth2(req) {
        return req.session.loginType === 'SANDBOX'
            ? this.oauth2Clients.SANDBOX
            : this.oauth2Clients.PROD;
    }

    /**
     * Redirects user to Salesforce login page for authorization
     * @param {Object} req - server request
     * @param {Object} res - server response
     */
    redirectToAuthUrl(req, res) {
        req.session.loginType =
            req.query.login_type === 'SANDBOX' ? 'SANDBOX' : 'PROD';
        // Make sure the session is persisted before leaving for Salesforce
        req.session.save((err) => {
            if (err) {
                this.logger.error('Failed to save server session', err);
                res.status(500).send('Failed to save server session');
                return;
            }
            res.redirect(
                this._getOauth2(req).getAuthorizationUrl({ scope: 'api' })
            );
        });
    }

    /**
     * Retrieves and stores OAuth2 token from authentication callback
     * @param {Object} req - server request
     * @param {Object} res - server response
     */
    async doCallback(req, res) {
        if (!req.query.code) {
            this.logger.error(
                'Failed to get authorization code from server callback.'
            );
            res.status(500).send(
                'Failed to get authorization code from server callback.'
            );
            return;
        }
        const conn = new jsforce.Connection({ oauth2: this._getOauth2(req) });
        try {
            await conn.authorize(req.query.code);
        } catch (error) {
            this.logger.error(
                'Failed to authorize request with provided authentication code'
            );
            res.status(500).send(error.message);
            return;
        }
        req.session.sfdcAccessToken = conn.accessToken;
        req.session.sfdcInstanceUrl = conn.instanceUrl;
        res.redirect('/');
    }

    /**
     * Gets logged in user details
     * @param {Object} req - server request
     * @param {Object} res - server response
     * @returns {Object} user info or an empty object if user is not logged in
     */
    async getLoggedInUserDetails(req, res) {
        const session = this.getSession(req);
        if (session === null) {
            res.status(200).send({});
            return;
        } else if (session.spoofed) {
            res.json({
                user_id: session.sfdcAccessToken,
                display_name: session.sfdcAccessToken
            });
            return;
        }
        // Connect to Salesforce and fetch user info
        const conn = new jsforce.Connection({
            accessToken: session.sfdcAccessToken,
            instanceUrl: session.sfdcInstanceUrl
        });
        try {
            res.json(await conn.identity());
        } catch (error) {
            this.logger.error(
                'Failed to retrieve logged in user details',
                error
            );
            res.status(500).send(error.message);
        }
    }

    /**
     * Destroys session and revokes Salesforce OAuth2 token
     * @param {Object} req - server request
     * @param {Object} res - server response
     */
    async doLogout(req, res) {
        const session = this.getSession(req);
        if (session === null) {
            res.redirect('/');
            return;
        }
        if (!session.spoofed) {
            const conn = new jsforce.Connection({
                accessToken: session.sfdcAccessToken,
                instanceUrl: session.sfdcInstanceUrl
            });
            try {
                await conn.logout();
            } catch (error) {
                this.logger.error(
                    'Failed to revoke authentication token',
                    error
                );
                res.status(500).json({ message: error.message });
                return;
            }
        }
        req.session.destroy((err) => {
            if (err) {
                this.logger.error('Failed to destroy server session', err);
                res.status(500).send('Failed to destroy server session');
            } else {
                res.redirect('/');
            }
        });
    }
};
