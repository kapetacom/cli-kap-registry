const FS = require('node:fs');
const URL = require('node:url');
const Path = require('node:path');
const Config = require("../../config");
const Authentication = require('../../services/Authentication');

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
        this._hostInfo = URL.parse(Config.data.registry.npm);
    }

    static getType() {
        return "npm";
    }

    getName() {
        return "NPM";
    }

    static isSupported(directory) {
        return FS.existsSync(Path.join(directory, 'package.json'));
    }

    static create(cli, directory) {
        return new NPMHandler(cli, directory);
    }

    async verify() {
        const cmd = (process.platform === 'win32') ? 'where npm' : 'which npm';
        return await this._cli.progress('Finding NPM executable',
            () => this._cli.run(cmd, this._directory)
        );
    }

    async calculateChecksum() {
        const result = await this._cli.progress('Calculating checksum', () => this._cli.run('npm pack --dryrun --json', this._directory));
        const packInfo = result.output ? JSON.parse(result.output) : null;

        if (packInfo && packInfo.filename) {
            FS.unlinkSync(packInfo.filename);
        }

        if (packInfo &&
            packInfo.length > 0 &&
            packInfo[0].shasum) {
            return packInfo[0].shasum;
        }

        return Promise.reject(new Error('Failed to get checksum using npm pack'));
    }

    async ensureCredentials() {
        const key = `//${this._hostInfo.host}/:_authToken`
        const value = new Authentication().getToken();
        return this._cli.progress('Configuring NPM access',
            () => this._cli.run(`npm config set "${key}"="${value}"`));
    }

    async push(name, version, commit) {
        await this.ensureCredentials();

        let packageInfo = this._getPackageInfo();
        const npmName = '@' + name;
        let changedPackage = false;
        try {

            if (packageInfo.name !== npmName ||
                packageInfo.version !== version) {
                this.makePackageBackup();
                packageInfo.name = npmName;
                packageInfo.version = version;
                this._writePackageInfo(packageInfo);
                changedPackage = true;
            }

            await this._cli.progress(`Pushing NPM package: ${npmName}:${version}`,
                () => this._cli.run(`npm publish --registry ${this._hostInfo.href}`, this._directory));

        } finally {
            if (changedPackage) {
                this.restorePackageBackup();
            }
        }

        return {
            type: NPMHandler.getType(),
            details: {
                name: name,
                version: version,
                registry: this._hostInfo.href
            }
        };

    }

    async pull(details) {
        await this.ensureCredentials();

        return Promise.reject(new Error('Not Implemented'));
    }

    _getPackageInfo() {
        const packageJson = FS.readFileSync(Path.join(this._directory, 'package.json')).toString();
        return JSON.parse(packageJson);
    }

    makePackageBackup() {
        const backupFile = Path.join(this._directory, 'package.json.original');
        if (FS.existsSync(backupFile)) {
            FS.unlinkSync(backupFile);
        }
        FS.copyFileSync(Path.join(this._directory, 'package.json'), backupFile);
    }

    restorePackageBackup() {
        const backupFile = Path.join(this._directory, 'package.json.original');
        if (FS.existsSync(backupFile)) {
            FS.unlinkSync(Path.join(this._directory, 'package.json'));
            FS.renameSync(backupFile, Path.join(this._directory, 'package.json'));
        }
    }

    _writePackageInfo(packageJson) {
        FS.writeFileSync(Path.join(this._directory, 'package.json'), JSON.stringify(packageJson, null, 2));
    }

    async build() {
        await this._cli.progress('Installing NPM package',
            () => this._cli.run('npm install', this._directory)
        );

        let packageInfo = this._getPackageInfo();
        if ('build' in packageInfo.scripts) {
            return this._cli.progress('Building NPM package',
                () => this._cli.run('npm run build', this._directory));
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