const crypto = require('crypto');
const FS = require('fs');
const Path = require('path');
/**
 * @class
 * @implements {ArtifactHandler}
 */
class YAMLHandler {

    /**
     *
     * @param {CLIHandler} cli
     * @param {string} directory
     */
    constructor(cli, directory) {
        this._cli = cli;
        this._directory = directory;
        this._file = undefined;
        if (FS.existsSync(Path.join(directory,'blockware.yml'))) {
            this._file = Path.join(directory,'blockware.yml');
        } else if (FS.existsSync(Path.join(directory,'blockware.yaml'))) {
            this._file = Path.join(directory,'blockware.yaml');
        } else {
            throw new Error('Failed to find blockware YML file in folder: ' + directory);
        }
    }

    static getName() {
        return "YAML File";
    }

    static getType() {
        return "yaml";
    }

    static isSupported(directory) {
        return FS.existsSync(Path.join(directory,'blockware.yml')) || FS.existsSync(Path.join(directory,'blockware.yaml'));
    }

    static create(cli, directory) {
        return new YAMLHandler(cli, directory);
    }

    async calculateChecksum() {
        const hash = crypto.createHash('sha256');
        const content = FS.readFileSync(this._file);
        hash.update(content);

        return hash.digest('hex');
    }

    async push(name, version, commit) {
        return {
            type: YAMLHandler.getType(),
            details: {
                name,
                version
            }
        }
    }

    /**
     *
     * @param {YAMLDetails} details
     * @returns {Promise<unknown>}
     */
    pull(details) {
        return Promise.reject(new Error('Not implemented'));
    }
}

module.exports = YAMLHandler