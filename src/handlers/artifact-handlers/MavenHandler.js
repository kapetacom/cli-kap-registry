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

    static getName() {
        return "";
    }

    static getType() {
        return "";
    }

    static isSupported(directory) {
        return FS.existsSync(Path.join(directory,'pom.xml'));
    }

    static create(cli, directory) {
        return new MavenHandler(cli, directory);
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
}

module.exports = MavenHandler