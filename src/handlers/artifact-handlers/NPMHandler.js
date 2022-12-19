const FS = require('fs');
const Path = require('path');

/**
 * @class
 * @implements {ArtifactHandler}
 */
class NPMHandler {

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
        return "npm";
    }

    getName() {
        return "NPM";
    }

    static isSupported(directory) {
        return FS.existsSync(Path.join(directory,'package.json'));
    }

    static create(cli, directory) {
        return new NPMHandler(cli, directory);
    }

    calculateChecksum() {
        //Get all files not except .npmignore
        return Promise.reject(new Error('Not Implemented'));
    }

    push(name, version, commit) {
        return Promise.reject(new Error('Not Implemented'));
    }

    pull(details) {
        return Promise.reject(new Error('Not Implemented'));
    }

    _getPackageInfo() {
        const packageJson = FS.readFileSync(Path.join(this._directory, 'package.json')).toString();
        return JSON.parse(packageJson);
    }

    async build() {
        let packageInfo = this._getPackageInfo();
        if ('build' in packageInfo.scripts) {
            return this._cli.progress('Testing NPM package', () => this._cli.run('npm run build', this._directory));
        } else {
            return this._cli.warn('Not building using NPM - no build script found');
        }
    }

    async test() {
        let packageInfo = this._getPackageInfo();
        if ('test' in packageInfo.scripts) {
            return this._cli.progress('Testing NPM package', () => this._cli.run('npm run test', this._directory));
        } else {
            return this._cli.warn('Not testing using NPM - no test script found');
        }
    }
}

module.exports = NPMHandler