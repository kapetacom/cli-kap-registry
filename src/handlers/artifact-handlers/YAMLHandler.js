const crypto = require('crypto');
const FS = require('fs');
const Path = require('path');
const Config = require("../../config");
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
    }

    static getType() {
        return "yaml";
    }

    getName() {
        return "YAML File";
    }

    static isSupported() {
        //Is always supported if there is a YAML file - and we wouldn't get here if there wasn't
        return true;
    }

    static create(cli, directory) {
        return new YAMLHandler(cli, directory);
    }

    async verify() {

    }

    async calculateChecksum() {
        return '';
    }

    async push(name, version, commit) {
        return {
            type: YAMLHandler.getType(),
            details: {
                name,
                version,
                commit
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

    async build() {
        //Meant as a pre-test thing
    }

    async test() {
        //Meant as a pre-test thing
    }
}

module.exports = YAMLHandler