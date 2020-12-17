//Contain all our methods for the application ie. get bundles.. get resources etc .
//const jsforce = require('jsforce');

const axios = require('axios');
// eslint-disable-next-line inclusive-language/use-inclusive-words
//good example -https://github.com/adityanaag3/lwc-oss-oauth/blob/master/src/server/integrationService.js
module.exports = class IntegrationService {
    constructor(logger, authService) {
        this.logger = logger;
        this.authService = authService;
    }

    /**
     * Runs an SOQL query on Salesforce
     * @param {jsforce.Connection} conn - jsforce Connection
     * @param {string} soqlQuery - SOQL query
     * @returns {Promise<Array>} Promise holding an Array of records returned by SOQL query
     */
    _runSoql(conn, soqlQuery) {
        return new Promise((resolve, reject) => {
            conn.tooling.query(soqlQuery, (error, result) => {
                if (error) {
                    this.logger.error(
                        `Failed to run SOQL query: ${soqlQuery}`,
                        error
                    );
                    reject(error);
                }
                resolve(result.records);
            });
        });
    }
    _performGet(urlOptions) {
        //using https://github.com/axios/axios#features
        return new Promise((resolve, reject) => {
            axios
                .request(urlOptions)
                .then((response) => {
                    resolve(response);
                })
                .catch((error) => {
                    reject(error);
                });
        });
    }

    getLightningComponentBundles(req, res) {
        //https://tomwoodhousegs0-dev-ed.my.salesforce.com/
        ///services/data/v49.0/tooling/query?q=SELECT+ID,+DeveloperName+from+LightningComponentBundle+order+by+lastmodifieddate+desc

        const session = this.authService.getSession(req, res);
        if (session === null) {
            return;
        }

        let options = {
            url: '/services/data/v49.0/tooling/query',
            baseURL: session.sfdcInstanceUrl,
            method: 'get',
            params: {
                q:
                    'SELECT ID, DeveloperName,ManageableState,IsExposed,ApiVersion from LightningComponentBundle order by lastmodifieddate desc'
            },
            headers: {
                'Content-Type': 'application/json',
                Authorization: 'Bearer ' + session.sfdcAccessToken
            }
        };
        this._performGet(options)
            .then((response) => {
                const formattedData = response.data.records.map(
                    (componentBundle) => {
                        return {
                            id: componentBundle.Id,
                            DeveloperName: componentBundle.DeveloperName,
                            ManageableState: componentBundle.ManageableState,
                            IsExposed: componentBundle.IsExposed,
                            ApiVersion: componentBundle.ApiVersion
                        };
                    }
                );
                res.json({ data: formattedData });
            })
            .catch((error) => {
                res.status(500).send(error);
            });
    }
    getLightningComponent(req, res) {
        //query the contents of the bundle
        //https://tomwoodhousegs0-dev-ed.my.salesforce.com/
        ///services/data/v49.0/tooling/query?q=SELECT+ID,+DeveloperName+from+LightningComponentBundle+order+by+lastmodifieddate+desc

        const session = this.authService.getSession(req, res);
        if (session === null) {
            return;
        }

        let options = {
            url: '/services/data/v49.0/tooling/query',
            baseURL: session.sfdcInstanceUrl,
            method: 'get',
            params: {
                q:
                    'SELECT ID, DeveloperName,ManageableState,IsExposed,ApiVersion from LightningComponentBundle order by lastmodifieddate desc'
            },
            headers: {
                'Content-Type': 'application/json',
                Authorization: 'Bearer ' + session.sfdcAccessToken
            }
        };
        this._performGet(options)
            .then((response) => {
                const formattedData = response.data.records.map(
                    (componentBundle) => {
                        return {
                            id: componentBundle.Id,
                            DeveloperName: componentBundle.DeveloperName,
                            ManageableState: componentBundle.ManageableState,
                            IsExposed: componentBundle.IsExposed,
                            ApiVersion: componentBundle.ApiVersion
                        };
                    }
                );
                res.json({ data: formattedData });
            })
            .catch((error) => {
                res.status(500).send(error);
            });
    }
};
