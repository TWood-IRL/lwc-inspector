//Contain all our methods for the application ie. get bundles.. get resources etc .
//const jsforce = require('jsforce');

const axios = require('axios');
const LIGHTNING_COMPONENT_QUERY = `SELECT ID, DeveloperName,ManageableState,IsExposed,ApiVersion from LightningComponentBundle order by developername asc`;

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
        let queryTerm = req.query.q;

        let query = !queryTerm
            ? LIGHTNING_COMPONENT_QUERY
            : `SELECT ID, DeveloperName,ManageableState,IsExposed,ApiVersion from LightningComponentBundle where DeveloperName like '%${queryTerm}%' order by developername asc`;
        let session = this.authService.getSession(req, res);
        if (session === null) {
            res.status(401).send('Unauthorized');
            return;
        }

        let options = {
            url: '/services/data/v49.0/tooling/query',
            baseURL: session.sfdcInstanceUrl,
            method: 'get',
            params: {
                q: query
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
        let bundleId = req.params.id;
        //query the contents of the bundle
        //https://tomwoodhousegs0-dev-ed.my.salesforce.com/
        ///services/data/v49.0/tooling/query?q=SELECT+ID,+DeveloperName+from+LightningComponentBundle+order+by+lastmodifieddate+desc
        let session = this.authService.getSession(req, res);

        if (session === null) {
            res.status(401).send('Unauthorized');
            return;
        }

        let options = {
            url: '/services/data/v49.0/tooling/query',
            baseURL: session.sfdcInstanceUrl,
            method: 'get',
            params: {
                q: `select id, Source,  FilePath,Format  from LightningComponentResource where LightningComponentBundleId = '${bundleId}' `
            },
            headers: {
                'Content-Type': 'application/json',
                Authorization: 'Bearer ' + session.sfdcAccessToken
            }
        };
        this._performGet(options)
            .then((response) => {
                const formattedData = response.data.records.map((component) => {
                    return {
                        id: component.Id,
                        Source: component.Source,
                        FilePath: component.FilePath,
                        attributes: component.attributes,
                        Format: component.Format
                    };
                });
                res.json({ data: formattedData });
            })
            .catch((error) => {
                res.status(500).send(error);
            });
    }

    getDownloadLightningComponent(req, res) {
        // need to use the metadata api and generate a package.xml to pass in the request.. then return to the client

        let bundleName = req.query.q;

        let session = this.authService.getSession(req, res);
        if (session === null) {
            res.status(401).send('Unauthorized');
            return;
        }

        let options = {
            url: '/services/data/v49.0/tooling/query',
            baseURL: session.sfdcInstanceUrl,
            method: 'get',
            params: {
                q: bundleName
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
