const FS = require('fs');
const Path = require('path');
/**
 * @class
 * @implements {ArtifactHandler}
 */
class MavenHandler {

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
        return "maven";
    }

    static isSupported(directory) {
        return FS.existsSync(Path.join(directory,'pom.xml'));
    }

    static create(cli, directory) {
        return new MavenHandler(cli, directory);
    }

    getName() {
        return "Maven";
    }

    calculateChecksum() {
        //Get all files in src/*
        return Promise.reject(new Error('Not Implemented'));
    }

    push(name, version, commit) {
        return Promise.reject(new Error('Not Implemented'));
    }

    pull(details) {
        return Promise.reject(new Error('Not Implemented'));
    }

    async build() {
        return this._cli.progress('Building maven package', () => this._cli.run('mvn package', this._directory));
    }

    async test() {
        return this._cli.progress('Testing maven package', () => this._cli.run('mvn test', this._directory));
    }
}

module.exports = MavenHandler