const Path = require('path');
const FS = require('fs');
const YAML = require('yaml');

const VCSHandler = require('../../handlers/VCSHandler');
const DockerService = require('../../services/DockerService');
const {promisifyChild} = require('../../utils/PromiseUtils');
const CLIHandler = require('../../handlers/CLIHandler');
const VersionCalculator = require('../../utils/VersionCalculator');
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

        this._versionCalculator = new VersionCalculator(this._cli);

        this._registryService = new RegistryService(
            Config.data.registry.url,
            Config.data.registry.organisationId
        );
        
        this._dockerService = new DockerService(this._cli);

        /**
         *
         * @type {string}
         */
        this.dockerOrganisation = Config.data.docker && Config.data.docker.org ?
            Config.data.docker.org : Config.data.registry.organisationId;

        /**
         *
         * @type {string}
         */
        this.dockerRegistryHost = Config.data.registry.docker && Config.data.registry.docker.registry ?
            Config.data.registry.docker.registry : '';

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
         * @type {BlockDefinition|null}
         */
        this.blockDefinition = null;

        /**
         * @type {string|null}
         */
        this.name = null;

        /**
         *
         * @type {string|null}
         */
        this.version = null;

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
    }

    _getDockerImageName() {
        if (this.dockerRegistryHost) {
            return `${this.dockerRegistryHost}/${this.dockerOrganisation}/${this.name}`.toLowerCase();
        }
        return `${this.dockerOrganisation}/${this.name}`.toLowerCase();
    }

    _getLocalBuildName() {
        return `${this.dockerOrganisation}/${this.name}:local`.toLowerCase();
    }

    /**
     *
     * @returns {Promise<VCSHandler>}
     * @private
     */
    async _vcs() {
        if (this._vcsHandler === false) {
            this._vcsHandler = await VCSHandler.getVCSHandler(this._cli, this._directory);
            if (this._vcsHandler) {
                this._cli.showValue(`Identified version control system`, this._vcsHandler.getName());
            } else {
                this._cli.check(`Identified version control system`, false);
            }
        }

        return this._vcsHandler;
    }

    async checkExists() {
        //Check for block.yml file

        const blockYml = Path.basename(this.file);

        if (!await this._cli.check(blockYml + ' exists', FS.existsSync(this.file))) {
            throw new Error(`${this.file} was not found`);
        }

        const fileStat = FS.statSync(this.file);

        if (!await this._cli.check(blockYml + ' is file', fileStat.isFile())) {
            throw new Error(`${this.file} is not a file. A valid file must be specified`);
        }

        //Check for Dockerfile
        const dockerfile = Path.join(this._directory, 'Dockerfile');
        if (!await this._cli.check('Dockerfile exists', FS.existsSync(dockerfile))) {
            throw new Error(`${dockerfile} was not found - docker file is required`);
        }

        const content = FS.readFileSync(this.file).toString();

        this.blockDefinition = YAML.parse(content);

        if (!this.blockDefinition.metadata) {
            throw new Error(`${this.file} is missing metadata. A valid block definition file must be specified`);
        }

        if (!this.blockDefinition.metadata.name) {
            throw new Error(`${this.file} is missing metadata.name. A valid block definition file must be specified`);
        }

        this.name = this.blockDefinition.metadata.name;

        if (!this.blockDefinition.metadata.version) {
            throw new Error(`${this.file} is missing metadata.version. A valid block definition file must be specified`);
        }

        this.version = this.blockDefinition.metadata.version;

    }

    async checkWorkingDirectory() {
        const handler = await this._vcs();
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

    async checkVersion() {
        if (!this.cmdObj.checkVersion || 
            this.cmdObj.autoVersioning) {
            return; //Ignore if version check is disabled or auto versioning is enabled
        }

        //If change does not affect resource definitions - patch (or higher)
        //If change adds to but does not change / remove resource definition - minor (or higher)
        //If change removes or changes existing resource definitions - major
        //This check will prevent committing the version if it does not match the above rule set
        //We only do this check if auto-version is disabled since it is then automatically enforced by that

        //Get latest version base on the following:
        //If there are more in the minor version range get the latest for the minor version
        //ELSE If there are more in the major version range get the latest for the major version
        //E.g.: New version: 1.2.3 - find 1.2.2 (latest with same minor version)
        //E.g.: New version: 1.3.0 - find 1.2.12 (latest with same major version)

        await this._cli.progress('Checking semantic version',async () => {
            const latestDefinition = await this._registryService.getLatestVersionBefore(this.name, this.version);

            if (latestDefinition) {
                const latestVersion = latestDefinition.block.metadata.version;
                const actualIncrement = VersionCalculator.calculateIncrementType(latestVersion, this.version);

                const nextAutoVersion = await this._versionCalculator.calculateNextVersion(this.blockDefinition, latestDefinition.block);

                const requiredIncrement = VersionCalculator.calculateIncrementType(latestVersion, nextAutoVersion);

                if (VersionCalculator.isIncrementGreaterThan(requiredIncrement, actualIncrement)) {
                    //Semantic version rules were not followed.
                    throw new Error(`Version increment not allowed: ${this.version}. ${actualIncrement} detected and required increment was ${requiredIncrement} from ${latestVersion}`);
                }
            }
        });
    }

    /**
     *
     * @returns {Promise<boolean>} returns true if the YAML file was changed
     */
    async incrementVersion() {
        if (!this.cmdObj.autoVersioning) {
            return false; //Ignore
        }

        const checksum = await this.calculateChecksum();

        return await this._cli.progress(`Checking existing version for ${this.version}`,async () => {
            const existingDefinition = await this._registryService.getVersion(this.name, this.version);
            if (existingDefinition) {

                if (existingDefinition.checksum === checksum) {
                    throw new Error(`Version already existed for checksum: ${this.blockDefinition.metadata.version} > ${checksum}.`);
                }

                //Calculate new version based on the diff set between old and new definitions
                this.blockDefinition.metadata.version = await this._versionCalculator.calculateNextVersion(this.blockDefinition, existingDefinition.block);
                this._cli.info(`Calculated next semantic version to be: ${this.blockDefinition.metadata.version}`);
                FS.writeFileSync(this.file, YAML.stringify(this.blockDefinition));
                return true;
            } else {
                //We check if this is the first version - which is the only reason why the existing definition should be unavailable for auto-versioning
                const latestVersion = await this._registryService.getLatestVersionBefore(this.name, this.version);
                if (latestVersion) {
                    this._cli.warn(`Existing version ${this.version} not found. Auto-versioning requires that you do not change the version manually.`);
                    this._cli.warn(`- Latest version found was ${latestVersion.block.metadata.version}.`);
                }
            }

            return false;
        });
    }

    /**
     *
     * @returns {Promise<Reservation>}
     */
    async reserveVersion() {
        this.reservation = await this._registryService.reserveVersion(this.blockDefinition);
        if (!this.reservation) {
            throw new Error('Failed to reserve version - no reservation returned from registry. ');
        }
        return this.reservation;
    }


    /**
     *
     * @returns {Promise<string>} calculates checksum of image content
     */
    async calculateChecksum() {
        return this._cli.progress(`Calculating checksum`, async () => {
            const checksum = await this._dockerService.calculateChecksum(this._directory);
            this._cli.info(`Checksum: ${checksum}`);
            return checksum;
        });
    }

    /**
     *
     * @returns {Promise<string>} returns image name
     */
    async buildDockerImage() {
        const dockerImageName = this._getLocalBuildName();
        await this._cli.progress(`Building local docker image: ${dockerImageName}`, async () => {
            return this._dockerService.build(this._directory, [
                dockerImageName
            ]);
        });

        return dockerImageName
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
    async vcsCommitBlock() {
        const handler = await this._vcs();

        await handler.add(this._directory, this.file);

        return handler.commit(this._directory, `[VERSION]: ${this.blockDefinition.metadata.version}`);
    }

    /**
     *
     * @returns {Promise<string>} returns VCS commit id
     */
    async getCurrentVcsCommit() {
        const handler = await this._vcs();

        return handler.getLatestCommit(this._directory);
    }

    _getDockerTags(commitId) {
        const dockerImage = this._getDockerImageName();

        const tags = this._getVersionTags(dockerImage + ':');
        if (commitId) {
            tags.push(`${dockerImage}:${commitId}`);
        }

        return tags;
    }

    _getVersionTags(prefix) {
        if (!prefix) {
            prefix = '';
        }

        const version = this.blockDefinition.metadata.version;

        const versionInfo =  VersionCalculator.parseVersion(version);

        return [
            `${prefix}${versionInfo.major}.${versionInfo.minor}.${versionInfo.patch}`,
            `${prefix}${versionInfo.major}.${versionInfo.minor}`,
            `${prefix}${versionInfo.major}`
        ];
    }

    _getPrimaryDockerImage() {
        const dockerImage = this._getDockerImageName();
        const version = this.blockDefinition.metadata.version;

        return `${dockerImage}:${version}`;
    }
    /**
     *
     * @param {string[]} tags
     * @returns {Promise<string[]>} returns all tags for image
     */
    async tagDockerImage(tags) {
        this._cli.info('Tagging docker images', tags);

        await this._dockerService.tag(this._getLocalBuildName(), tags);
    }


    async vcsPush(commitId, yamlChanged) {
        const handler = await this._vcs();

        const tag = 'v' + this.blockDefinition.metadata.version;

        const tagged = await handler.tag(this._directory, tag);
        if (tagged) {
            this._cli.info("Added tag to %s: %s", handler.getName(), tag);
        }

        if (tagged || yamlChanged) {
            await handler.push(this._directory, tagged);
        } else {
            this._cli.info("No changes to %s - not pushing source", handler.getName());
        }
    }

    /**
     *
     * @param {string[]} tags
     * @returns {Promise<void>}
     */
    async pushDockerImage(tags) {

        await this._dockerService.push(tags);
    }

    /**
     *
     * @param {Reservation} reservation
     * @returns {Promise<BlockRegistration>}
     */
    async commitReservation(reservation) {
        return await this._registryService.commitReservation(reservation);
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

        const vcsHandler = await this._vcs();

        //Make sure file structure is as expected
        await this._cli.progress('Verifying files exist', async () => this.checkExists());

        await this._cli.progress('Verifying working directory', async () => this.checkWorkingDirectory());

        await this.runBuild();

        const yamlChanged = await this.incrementVersion();

        await this.checkVersion();

        //Reserve registry version - start 2-phase commit
        const reservation = await this._cli.progress(
            `Reserving version: ${this.blockDefinition.metadata.version}`,
            async () => this.reserveVersion());

        try {

            await this.runTests();

            reservation.checksum = await this.calculateChecksum();

            await this._cli.progress('Building docker image', async () => this.buildDockerImage());

            let commitId;
            if (vcsHandler) {
                //Commit block.yml to version control with changes if they exist
                if (yamlChanged) {
                    commitId = await this._cli.progress('Committing changes', async () => this.vcsCommitBlock());
                } else {
                    commitId = await this.getCurrentVcsCommit();
                }

                this._cli.info(`Assigning ${vcsHandler.getName()} commit id to version: ${commitId} > ${this.blockDefinition.metadata.version}`);

                //Record version control id of latest commit
                reservation.vcs = {
                    type: vcsHandler.getType(),
                    checkout: await vcsHandler.getCheckoutInfo(this._directory),
                    commitId
                };
            }

            const dockerTags = this._getDockerTags(commitId);

            await this._cli.progress('Tagging docker image', async () => this.tagDockerImage(dockerTags));

            await this._cli.progress('Pushing docker image', async () => this.pushDockerImage(dockerTags));

            reservation.docker = {
                image: {
                    name: this._getDockerImageName(),
                    primary: this._getPrimaryDockerImage(),
                    tags: dockerTags
                }
            };

            if (vcsHandler) {
                await this._cli.progress('Pushing source code', async () => this.vcsPush(commitId, yamlChanged));
            }

            await this._cli.progress('Committing version', async () => this.commitReservation(reservation));
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
        file = 'block.yml';
    }

    const cli = new CLIHandler(!cmdObj.nonInteractive);

    cli.start(`Push ${file}`);

    const operation = new PushOperation(cli, file, cmdObj);

    try {
        await operation.perform();
    } catch(err) {
        cli.error('Push failed: %s', err.message);

        if (cmdObj.verbose && err.stack) {
            cli.error(err.stack);
        }
    } finally {
        cli.end();
    }

};