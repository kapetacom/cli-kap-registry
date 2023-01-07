const request = require('request-promise-native');
const Authentication = require("./Authentication");

class RegistryService {

    /**
     *
     * @param {string} baseUrl
     * @param {string} handle
     */
    constructor(baseUrl, handle) {
        this.baseUrl = baseUrl;
        this.handle = handle;
        this.authentication = new Authentication();
    }

    /**
     *
     * @param {AssetDefinition[]} assets
     * @returns {Promise<Reservation>}
     */
    async reserveVersions(assets) {
        return  this._request('POST', `/reserve`, assets);
    }

    /**
     *
     * @param {string} reservationId
     * @param {AssetVersion[]} assetVersions
     * @returns {Promise<void>}
     */
    async commitReservation(reservationId, assetVersions ) {
        return this._request('POST', `/publish`, assetVersions, {
            'If-Match': reservationId
        });
    }

    /**
     *
     * @param {Reservation} reservation
     * @returns {Promise<void>}
     */
    async abortReservation(reservation) {
        return this._request('DELETE', `/reservations/${encodeURIComponent(reservation.id)}/abort`);
    }

    /**
     *
     * @param {string} name
     * @param {string} version
     * @returns {Promise<AssetVersion>}
     */
    async getVersion(name, version) {
        let handle = this.handle;

        if (name.indexOf('/') > -1) {
            [handle, name] = name.split('/');
        }

        return this._request('GET', `/${encodeURIComponent(handle)}/${encodeURIComponent(name)}/${encodeURIComponent(version)}`);
    }

    /**
     *
     * @param {string} name
     * @param {string} version
     * @returns {Promise<AssetVersion>}
     */
    async getLatestVersionBefore(name, version) {
        return this._request('GET', `/${encodeURIComponent(this.handle)}/${encodeURIComponent(name)}/${encodeURIComponent(version)}/previous`);
    }

    async _request(method, path, body, headers) {
        const authHeaders = {};
        if (this.authentication.hasCredentials()) {
            authHeaders['authorization'] = `Bearer ${this.authentication.getToken()}`;
        }
        try {
            const requestOptions = {
                method,
                url: this.baseUrl + `/v1/registry${path}`,
                body: body,
                json: true,
                headers: {
                    'accept': 'application/json',
                    ...authHeaders,
                    ...headers
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