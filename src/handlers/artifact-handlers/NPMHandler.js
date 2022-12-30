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

        if (packInfo &&
            packInfo.length > 0) {
            //Delete tmp file
            if (packInfo[0].filename) {
                FS.unlinkSync(packInfo[0].filename
                    .replace(/\//g, '-')
                    .replace(/^@/,''));
            }

            if (packInfo[0].integrity) {
                return packInfo[0].integrity;
            }

            if (packInfo[0].shasum) {
                return packInfo[0].shasum;
            }
        }

        return Promise.reject(new Error('Failed to get checksum using npm pack'));
    }

    async ensureCredentials() {
        const key = `//${this._hostInfo.host}/:_authToken`
        const value = new Authentication().getToken();
        return this._cli.progress('Configuring NPM access',
            () => this._cli.run(`npm config --location user set "${key}"="${value}"`));
    }

    async versionExists(packageName, version) {
        try {
            const result = await this._cli.run(`npm view --registry ${this._hostInfo.href} ${packageName}@${version} version`);
            return result.output.trim() === version;
        } catch (e) {
            //Ignore - OK if version doesnt exist
            return false;
        }
    }

    async push(name, version, commit) {
        await this.ensureCredentials();

        let packageInfo = this._getPackageInfo();
        const npmName = '@' + name;

        await this._cli.progress('Checking NPM registry', async () => {
            if (await this.versionExists(npmName, version)) {
                throw new Error(`NPM version already exists [${npmName}:${version}] - can not be overwritten`);
            } else {
                this._cli.info('NPM registry did not contain version. Proceeding...');
            }
        })


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

    /**
     *
     * @param {NPMDetails} details
     * @param {string} target
     * @param {RegistryService} registryService
     * @returns {Promise<void>}
     */
    async pull(details, target, registryService) {
        await this.ensureCredentials();

        await this._cli.progress(`Pulling NPM package: ${details.name}:${details.version}`,
            () => this._cli.run(`npm pack --registry ${details.registry} --pack-destination=${target} @${details.name}@${details.version}`, this._directory));

    }

    _getPackageInfo() {
        const packageJson = FS.readFileSync(Path.join(this._directory, 'package.json')).toString();
        return JSON.parse(packageJson);
    }

    makePackageBackup() {
        this.makeBackup('package.json');
        this.makeBackup('package-lock.json');
    }

    makeBackup(file) {
        const backupFile = Path.join(this._directory, file + '.original');
        if (FS.existsSync(backupFile)) {
            FS.unlinkSync(backupFile);
        }
        FS.copyFileSync(Path.join(this._directory, file), backupFile);
    }

    restorePackageBackup() {
        this.restoreBackup('package.json');
        this.restoreBackup('package-lock.json');
    }

    restoreBackup(file) {
        const backupFile = Path.join(this._directory, file + '.original');
        if (FS.existsSync(backupFile)) {
            FS.unlinkSync(Path.join(this._directory, file));
            FS.renameSync(backupFile, Path.join(this._directory, file));
        }
    }

    _writePackageInfo(packageJson) {
        FS.writeFileSync(Path.join(this._directory, 'package.json'), JSON.stringify(packageJson, null, 2));
    }

    async build() {
        process.env.NODE_ENV = 'development';

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
        process.env.NODE_ENV = 'development';

        let packageInfo = this._getPackageInfo();
        if ('test' in packageInfo.scripts) {
            return this._cli.progress('Testing NPM package', () => this._cli.run('npm run test', this._directory));
        } else {
            return this._cli.warn('Not testing using NPM - no test script found');
        }
    }
}

module.exports = NPMHandler