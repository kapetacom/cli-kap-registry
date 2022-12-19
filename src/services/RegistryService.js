const request = require('request-promise-native');

class RegistryService {

    /**
     *
     * @param {string} baseUrl
     * @param {string} handle
     */
    constructor(baseUrl, handle) {
        this.baseUrl = baseUrl;
        this.handle = handle;
    }

    /**
     *
     * @param {AssetDefinition[]} assets
     * @returns {Promise<Reservation>}
     */
    async reserveVersions(assets) {
        return  this._request('POST', `/reservation`, assets);
    }

    /**
     *
     * @param {string} reservationId
     * @param {AssetVersion[]} assetVersions
     * @returns {Promise<void>}
     */
    async commitReservation(reservationId, assetVersions ) {
        return this._request('POST', `/`, assetVersions, {
            'If-Match': reservationId
        });
    }

    /**
     *
     * @param {Reservation} reservation
     * @returns {Promise<void>}
     */
    async abortReservation(reservation) {
        return this._request('DELETE', `/reservations/${encodeURIComponent(reservation.reservationId)}/abort`);
    }

    /**
     *
     * @param {string} name
     * @param {string} version
     * @returns {Promise<AssetVersion>}
     */
    async getVersion(name, version) {
        return this._request('GET', `/${encodeURIComponent(this.handle)}/${encodeURIComponent(name)}/${encodeURIComponent(version)}`);
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
        try {
            const requestOptions = {
                method,
                url: this.baseUrl + `/v1/registry${path}`,
                body,
                json: true,
                headers: {
                    'accept': 'application/json',
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