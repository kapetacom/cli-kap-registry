const FS = require('fs');
class Authentication {
    constructor() {
        if (!process.env.BLOCKWARE_CREDENTIALS) {
            throw new Error('BLOCKWARE_CREDENTIALS environment variable not found');
        }

        if (!FS.existsSync(process.env.BLOCKWARE_CREDENTIALS)) {
            throw new Error('Credentials file not found: ' + process.env.BLOCKWARE_CREDENTIALS);
        }

        this._credentials = JSON.parse(FS.readFileSync(process.env.BLOCKWARE_CREDENTIALS).toString());
    }

    getToken() {
        return this._credentials.access_token;
    }
}

module.exports = Authentication;