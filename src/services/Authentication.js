const FS = require('fs');
class Authentication {
    constructor() {
        this._credentials = null;
    }

    ensureCredentials() {
        if (this._credentials) {
            return;
        }
        if (!process.env.BLOCKWARE_CREDENTIALS) {
            throw new Error('BLOCKWARE_CREDENTIALS environment variable not found');
        }

        if (!FS.existsSync(process.env.BLOCKWARE_CREDENTIALS)) {
            throw new Error('Credentials file not found: ' + process.env.BLOCKWARE_CREDENTIALS);
        }

        this._credentials = JSON.parse(FS.readFileSync(process.env.BLOCKWARE_CREDENTIALS).toString());
    }

    hasCredentials() {
        return this._credentials || process?.env?.BLOCKWARE_CREDENTIALS;
    }

    getToken() {
        this.ensureCredentials();

        return this._credentials.access_token;
    }
}

Authentication.ANONYMOUS = 'anonymous';

module.exports = Authentication;