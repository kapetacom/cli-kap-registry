const Path = require('path');
const FS = require('fs');
const YAML = require('yaml');

const VCSHandler = require('../../handlers/VCSHandler');
const ArtifactHandler = require('../../handlers/ArtifactHandler');
const {promisifyChild} = require('../../utils/PromiseUtils');
const CLIHandler = require('../../handlers/CLIHandler');
const RegistryService = require('../../services/RegistryService');
const Config = require('../../config');
const {spawn} = require('child_process');

class PushOperation {

    /**
     *
     * @param {CLIHandler} cli
     * @param {string} file
     * @param {PushCommandOptions} cmdObj
     */
    constructor(cli, file, cmdObj) {

        /**
         *
         * @type {CLIHandler}
         * @private
         */
        this._cli = cli;

        this._registryService = new RegistryService(
            Config.data.registry.url,
            Config.data.registry.organisationId
        );

        /**
         * @type {string}
         */
        this.file = Path.resolve(process.cwd(), file);

        /**
         *
         * @type {string}
         */
        this._directory = Path.dirname(this.file);

        /**
         *
         * @type {PushCommandOptions}
         */
        this.cmdObj = cmdObj;

        /**
         *
         * @type {AssetDefinition[]|null}
         */
        this.assetDefinitions = null;

        /**
         *
         * @type {Reservation|null}
         */
        this.reservation = null;

        /**
         *
         * @type {VCSHandler|null|boolean}
         * @private
         */
        this._vcsHandler = false;

        /**
         *
         * @type {ArtifactHandler|null|boolean}
         * @private
         */
        this._artifactHandler = false;
    }

    /**
     *
     * @returns {Promise<VCSHandler>}
     * @private
     */
    async vcsHandler() {
        if (this._vcsHandler === false) {
            this._vcsHandler = await VCSHandler.getVCSHandler(this._cli, this._directory);
            if (this._vcsHandler) {
                this._cli.showValue(`Identified version control system`, this._vcsHandler.getName());
            } else {
                await this._cli.check(`Identified version control system`, false);
            }
        }

        return this._vcsHandler;
    }

    /**
     *
     * @returns {Promise<ArtifactHandler>}
     * @private
     */
    async artifactHandler() {
        if (this._artifactHandler === false) {
            this._artifactHandler = await ArtifactHandler.getArtifactHandler(this._cli, this._directory);
            if (this._artifactHandler) {
                this._cli.showValue(`Identified artifact type`, this._artifactHandler.getName());
            } else {
                await this._cli.check(`Identified artifact type`, false);
            }
        }

        return this._artifactHandler;
    }

    async checkExists() {
        //Check for blockware.yml file

        const blockYml = Path.basename(this.file);

        if (!await this._cli.check(blockYml + ' exists', FS.existsSync(this.file))) {
            throw new Error(`${this.file} was not found`);
        }

        const fileStat = FS.statSync(this.file);

        if (!await this._cli.check(blockYml + ' is file', fileStat.isFile())) {
            throw new Error(`${this.file} is not a file. A valid file must be specified`);
        }

        const content = FS.readFileSync(this.file).toString();

        this.assetDefinitions = YAML.parseAllDocuments(content).map(doc => doc.toJSON());

        this.assetDefinitions.forEach(assetDefinition => {
            if (!assetDefinition.metadata) {
                throw new Error(`${this.file} is missing metadata. A valid block definition file must be specified`);
            }

            if (!assetDefinition.metadata.name) {
                throw new Error(`${this.file} is missing metadata.name. A valid block definition file must be specified`);
            }
        })

    }

    async checkWorkingDirectory() {
        const handler = await this.vcsHandler();
        if (handler) {
            if (!this.cmdObj.ignoreWorkingDirectory) {

                await this._cli.progress('Checking that working directory is clean', async () => {
                    if (!(await handler.isWorkingDirectoryClean(this._directory))) {
                        throw new Error('Working directory is not clean. Make sure everything is committed or use --ignore-working-directory to ignore')
                    }
                });

                await this._cli.progress('Checking that working directory is up to date with remote', async () => {
                    if (!(await handler.isWorkingDirectoryUpToDate(this._directory))) {
                        throw new Error('Working directory is not up to date with remote. Pull the latest changes or use --ignore-working-directory to continue.')
                    }
                });
            }
        }
    }

    /**
     *
     * @param {AssetDefinition[]} assets
     * @returns {Promise<Reservation>}
     */
    async reserveVersions(assets) {
        this.reservation = await this._registryService.reserveVersions(assets);
        if (!this.reservation) {
            throw new Error('Failed to reserve version - no reservation returned from registry. ');
        }
        return this.reservation;
    }

    async _runScript(file) {
        const child = spawn('./scripts/' + file, {
            cwd: this._directory,
            detached: true,
            shell: true,
            stdio: ['ignore', 'pipe', 'pipe']
        });

        const result = await promisifyChild(child, (data) => {
            this._cli.debug(data.line);
        });

        if (result.exit !== 0) {
            throw new Error('Script failed');
        }

    }

    async runTests() {
        if (this.cmdObj.skipTests) {
            this._cli.info("Skipping tests...");
            return;
        }

        try {
            await this._cli.progress('Running tests', async () => {
                return this._runScript('test.sh');
            });
        } catch (e) {
            throw new Error('Tests failed');
        }
    }

    async runBuild() {
        try {
            await this._cli.progress('Building block', async () => {
                return this._runScript('build.sh');
            });
        } catch (e) {
            throw new Error('Build failed');
        }
    }


    /**
     *
     * @returns {Promise<string>} returns VCS commit id
     */
    async getCurrentVcsCommit() {
        const handler = await this.vcsHandler();

        return handler.getLatestCommit(this._directory);
    }

    /**
     *
     * @param {Reservation} reservation
     * @param {AssetVersion[]} assetVersions
     * @returns {Promise<void>}
     */
    async commitReservation(reservation, assetVersions) {
        return await this._registryService.commitReservation(reservation.reservationId, assetVersions);
    }

    /**
     *
     * @param {Reservation} reservation
     * @returns {Promise<void>}
     */
    async abortReservation(reservation) {
        await this._registryService.abortReservation(reservation);
    }

    /**
     * Calls each check and step in the order it's intended.
     *
     * @returns {Promise<void>}
     */
    async perform() {

        const vcsHandler = await this.vcsHandler();

        const artifactHandler = await this.artifactHandler();

        //Make sure file structure is as expected
        await this._cli.progress('Verifying files exist', async () => this.checkExists());

        await this._cli.progress('Verifying working directory', async () => this.checkWorkingDirectory());

        await this.runBuild();

        /**
         * Reserve registry version - start 2-phase commit
         *
         * @type {Reservation}
         */
        const reservation = await this._cli.progress(
            `Create version reservation`,
            async () => this.reserveVersions(this.assetDefinitions)
        );

        /**
         *
         * @type {AssetVersion[]}
         */
        const assetVersions = [];

        try {

            await this.runTests();

            let commitId,
                repository;

            if (vcsHandler) {
                repository = {
                    type: vcsHandler.getType(),
                    checkout: await vcsHandler.getCheckoutInfo(this._directory),
                    commit: await this.getCurrentVcsCommit()
                };
                commitId = repository.commit;
                this._cli.info(`Assigning ${vcsHandler.getName()} commit id to version: ${commitId} > ${assetVersion.version}`);
            }

            const checksum = await artifactHandler.calculateChecksum();

            for (let i = 0; i < reservation.versions.length; i++) {
                const reservedVersion = reservation.versions[i];
                const name = reservedVersion.content.metadata.name;

                const artifact = await artifactHandler.push(name, reservedVersion.version, commitId);

                /**
                 *
                 * @type {AssetVersion}
                 */
                const assetVersion = {
                    version: reservedVersion.version,
                    content: reservedVersion.content,
                    checksum,
                    repository,
                    artifact
                }

                assetVersions.push(assetVersion);
            }

            await this._cli.progress('Committing version', async () => this.commitReservation(reservation, assetVersions));
        } catch (e) {
            await this._cli.progress('Aborting version', async () => this.abortReservation(reservation));
            throw e;
        }
    }
}

/**
 *
 * @param {string} [file="block.yml"]
 * @param {PushCommandOptions} cmdObj
 * @returns {Promise<void>}
 */
module.exports = async function push(file, cmdObj) {

    if (!file) {
        file = 'blockware.yml';
    }

    const cli = new CLIHandler(!cmdObj.nonInteractive);

    cli.start(`Push ${file}`);

    const operation = new PushOperation(cli, file, cmdObj);

    try {
        await operation.perform();
    } catch (err) {
        cli.error('Push failed: %s', err.message);

        if (cmdObj.verbose && err.stack) {
            cli.error(err.stack);
        }
    } finally {
        cli.end();
    }

};