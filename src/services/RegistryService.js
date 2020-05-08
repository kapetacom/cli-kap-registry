

const request = require('request-promise-native');
const HEADER_ORG = 'x-blockware-org';
const HEADER_OPTS = 'x-blockware-options';

class RegistryService {

    /**
     *
     * @param {string} baseUrl
     * @param {string} organisationId
     */
    constructor(baseUrl, organisationId) {
        this.baseUrl = baseUrl;
        this.organisationId = organisationId;
    }

    /**
     *
     * @param {BlockDefinition} blockDefinition
     * @param {object} [options]
     * @returns {Promise<Reservation>}
     */
    async reserveVersion(blockDefinition, options) {
        return  this._request('POST', `/block/reservation/create`, blockDefinition, options);
    }

    /**
     *
     * @param {Reservation} reservation
     * @param {object} [options]
     * @returns {Promise<BlockRegistration>}
     */
    async commitReservation(reservation, options) {
        return this._request('POST', `/block/reservation/commit`, reservation, options);
    }

    /**
     *
     * @param {Reservation} reservation
     * @param {object} [options]
     * @returns {Promise<void>}
     */
    async abortReservation(reservation, options) {
        return this._request('POST', `/block/reservation/abort`, reservation, options);
    }

    /**
     *
     * @param {string} name
     * @param {string} version
     * @returns {Promise<BlockRegistration>}
     */
    async getVersion(name, version) {
        return this._request('GET', `/block/${encodeURIComponent(name)}/${encodeURIComponent(version)}`);
    }

    /**
     *
     * @param {string} name
     * @param {string} version
     * @returns {Promise<BlockRegistration>}
     */
    async getLatestVersionBefore(name, version) {
        return this._request('GET', `/block/${encodeURIComponent(name)}/${encodeURIComponent(version)}/previous`);
    }

    /**
     *
     * @param {string} name
     * @returns {Promise<BlockRegistration>}
     */
    async getLatestVersion(name) {
        return this.getVersion(name, 'latest');
    }

    async _request(method, path, body, options) {
        try {
            const requestOptions = {
                method,
                url: this.baseUrl + `/${encodeURIComponent(this.organisationId)}${path}`,
                body,
                json: true,
                headers: {
                    'accept': 'application/json',
                    [HEADER_OPTS]: JSON.stringify(options || {})
                }
            };

            return await request(requestOptions);
        } catch(e) {
            if (e.message.indexOf('ECONNREFUSED') > -1) {
                throw new Error(`Failed to reach Blockware registry on ${this.baseUrl}. Please check your settings and try again.`);
            }

            if (e.statusCode > 0) {
                if (e.statusCode === 404) {
                    return null;
                }

                if (e.response && e.response.body) {
                    const errorStructure = e.response.body;
                    if (errorStructure.message) {
                        throw new Error(errorStructure.message);
                    }
                }
            }

            throw e;
        }
    }
}


module.exports = RegistryService;