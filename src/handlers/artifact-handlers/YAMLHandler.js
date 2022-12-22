const crypto = require('crypto');
const FS = require('fs');
const Path = require('path');
const Config = require("../../config");
const YAML = require('yaml');
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
     * @param {string} target
     * @param {RegistryService} registryService
     * @returns {Promise<void>}
     */
    async pull(details, target, registryService) {
        const version = await this._cli.progress(`Downloading YAML for ${details.name}:${details.version}`,
            () => registryService.getVersion(details.name, details.version)
        );

        const filename = `${details.name.replace(/\//g,'-')}-${details.version}.yaml`;
        const dest = Path.join(target, filename);

        FS.writeFileSync(dest, YAML.stringify(version.content));

        this._cli.info(`Wrote YAML to ${dest}`);
    }

    async build() {
        //Meant as a pre-test thing - Not applicable
    }

    async test() {
        //Meant as a pre-deploy thing - Not applicable
    }
}

module.exports = YAMLHandler