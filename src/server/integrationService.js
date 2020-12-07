//Contain all our methods for the application ie. get bundles.. get resources etc . 
const jsforce = require('jsforce');
//good example -https://github.com/adityanaag3/lwc-oss-oauth/blob/master/src/server/integrationService.js
module.exports = class IntegrationService {
    /**
     * Builds the authentication service
     * @param {winston.Logger} logger
     * @param {AuthenticationService} authService
     */
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

    getLightningComponentBundles(req,res) {
        let query = "SELECT ID, DeveloperName from LightningComponentBundle order by lastmodifieddate desc" 
        const session = this.authService.getSession(req, res);
        if (session === null) {
            return;
        }
        const conn = new jsforce.Connection({
            accessToken: session.sfdcAccessToken,
            instanceUrl: session.sfdcInstanceUrl
        });

        // Prepare query
        let soqlQuery;
        if (req.params.queryString) {
            // Retrieve details of a specific session with a given id
          
        } else {
            // Retrieve all sessions
            // In production, this should be paginated
            soqlQuery = 'SELECT ID, DeveloperName from LightningComponentBundle order by lastmodifieddate desc';
        }

        // Execute query and respond with result or error
        //https://developer.salesforce.com/docs/atlas.en-us.api_tooling.meta/api_tooling/tooling_api_objects_lightningcomponentbundle.htm
        this._runSoql(conn, soqlQuery) 
            .then((records) => {
                // Format data
                const formattedData = records.map((componentBundle) => {
                    
                    return {
                        id: componentBundle.Id,
                        DeveloperName: componentBundle.DeveloperName,
                        ManageableState: componentBundle.ManageableState,
                        IsExposed: componentBundle.IsExposed,
                        ApiVersion: componentBundle.ApiVersion
                    };
                });

                res.json({ data: formattedData });
            })
            .catch((error) => {
                this.logger.error(
                    'Failed to retrieve conference session(s)',
                    error
                );
                res.status(500).send(error);
            });
    }
    

    
};