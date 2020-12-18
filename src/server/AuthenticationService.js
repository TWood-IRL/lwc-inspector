const jsforce = require('jsforce');

module.exports = class AuthenticationService {
    /**
     * Builds the authentication service
     * @param {winston.Logger} logger
     * @param {jsforce.OAuth2} oauth2
     */
    constructor(logger, oauth2) {
        this.logger = logger;
        this.oauth2 = oauth2;
    }

    /**
     * Attempts to retrieve the server session.
     * If there is no session, redirects with HTTP 401 and an error message.
     * @param {Object} req - server request
     * @param {Object} res - server response
     * @returns {Object} session data or null if there was no session
     */
    getSession(req, res) {
        const { session } = req;
        if (session.sfdcAccessToken === undefined) {
           //res.status(401).send('Unauthorized');
            return null;
        }
        return session;
    }
    

    /**
     * Redirects user to Salesforce login page for authorization
     * @param {Object} res - server response
     */
    redirectToAuthUrl(res) {
        res.redirect(this.oauth2.getAuthorizationUrl({ scope: 'api' }));
    }

    /**
     * Retrieves and stores OAuth2 token from authentication callback
     * @param {Object} req - server request
     * @param {Object} res - server response
     */
    doCallback(req, res) {
        if (!req.query.code) {
            this.logger.error(
                'Failed to get authorization code from server callback.'
            );
            res.status(500).send(
                'Failed to get authorization code from server callback.'
            );
            return;
        }
        const conn = new jsforce.Connection({ oauth2: this.oauth2 });
        const { code } = req.query;
        conn.authorize(code, (error) => {
            if (error) {
                this.logger.error(
                    'Failed to authorize request with provided authentication code'
                );
                res.status(500).send(error);
                return;
            }
            req.session.sfdcAccessToken = conn.accessToken;
            req.session.sfdcInstanceUrl = conn.instanceUrl;
            res.redirect('/');
        });
    }

    /**
     * Gets logged in user details
     * @param {Object} req - server request
     * @param {Object} res - server response
     * @returns {Object} user info or an empty object if user is not logged in
     */
    getLoggedInUserDetails(req, res) {
        // Check for existing session
        const { session } = req;
        if (session.sfdcAccessToken === undefined) {
            res.status(200).send({});
            return;
        }
        // Connect to Salesforce and fetch user info
        const conn = new jsforce.Connection({
            accessToken: session.sfdcAccessToken,
            instanceUrl: session.sfdcInstanceUrl
        });
        conn.identity((error, data) => {
            if (error) {
                this.logger.error(
                    'Failed to retrieve logged in user details',
                    error
                );
                res.status(500).send(error);
                return;
            }
            res.json(data);
            /*active: true
addr_city: "San Francisco"
addr_country: "US"
addr_state: "CA"
addr_street: "1 Market St"
addr_zip: "94105"
asserted_user: true
display_name: "Thomas Woodhouse"
email: "twoodhouse+gs0@salesforce.com"
email_verified: true
first_name: "Thomas"
id: "https://login.salesforce.com/id/00DB0000000cI0pMAE/005B0000006FVL4IAO"
is_app_installed: true
is_lightning_login_user: false
language: "en_US"
last_modified_date: "2020-12-17T01:38:19Z"
last_name: "Woodhouse"
locale: "en_IE"
mobile_phone: "+353 0870659255"
mobile_phone_verified: true
nick_name: "User15677749680611746479"
organization_id: "00DB0000000cI0pMAE"
photos: {picture: "https://tomwoodhousegs0-dev-ed--c.documentforce.com/profilephoto/005/F", thumbnail: "https://tomwoodhousegs0-dev-ed--c.documentforce.com/profilephoto/005/T"}
status: {created_date: null, body: null}
timezone: "America/New_York"
urls: {enterprise: "https://tomwoodhousegs0-dev-ed.my.salesforce.com/services/Soap/c/{version}/00DB0000000cI0p", metadata: "https://tomwoodhousegs0-dev-ed.my.salesforce.com/services/Soap/m/{version}/00DB0000000cI0p", partner: "https://tomwoodhousegs0-dev-ed.my.salesforce.com/services/Soap/u/{version}/00DB0000000cI0p", rest: "https://tomwoodhousegs0-dev-ed.my.salesforce.com/services/data/v{version}/", sobjects: "https://tomwoodhousegs0-dev-ed.my.salesforce.com/services/data/v{version}/sobjects/", …}
user_id: "005B0000006FVL4IAO"
user_type: "STANDARD"
username: "twoodhouse+gs0@salesforce.com" */
        });
    }

    /**
     * Destroys session and revokes Salesforce OAuth2 token
     * @param {Object} req - server request
     * @param {Object} res - server response
     */
    doLogout(req, res) {
        const session = this.getSession(req, res);
        if (session === null) {
            return;
        }

        const conn = new jsforce.Connection({
            accessToken: session.sfdcAccessToken,
            instanceUrl: session.sfdcInstanceUrl
        });

        conn.logout((error) => {
            if (error) {
                this.logger.error(
                    'Failed to revoke authentication token',
                    error
                );
                res.status(500).json(error);
            } else {
                session.destroy((err) => {
                    if (err) {
                        this.logger.error(
                            'Failed to destroy server session',
                            err
                        );
                        res.status(500).send(
                            'Failed to destroy server session'
                        );
                    } else {
                        res.redirect('/');
                    }
                });
            }
        });
    }
};
