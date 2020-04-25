const Path = require('path');
const FS = require('fs');
const YAML = require('yaml');

const VCSUtils = require('../utils/VCSUtils');
const DockerService = require('../utils/DockerService');
const {promisifyChild} = require('../utils/promisifyStream');
const cli = require('../utils/cli');
const BlockVersionCalculator = require('../utils/BlockVersionCalculator');
const RegistryService = require('../RegistryService');
const Config = require('../config');
const {spawn} = require('child_process');

class PushOperation {

    /**
     *
     * @param {string} file
     * @param {PushCommandOptions} cmdObj
     */
    constructor(file, cmdObj) {

        this._versionCalculator = new BlockVersionCalculator();

        this._registryService = new RegistryService(
            Config.data.registry.url,
            Config.data.registry.organisationId
        );
        
        this._dockerService = new DockerService();

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
            this._vcsHandler = await VCSUtils.getVCSHandler(this._directory);
            if (this._vcsHandler) {
                cli.info(`Identified version control system: ${this._vcsHandler.getName()}`);
            } else {
                cli.warn(`No version control system found in folder.`);
            }
        }

        return this._vcsHandler;
    }

    async checkExists() {
        //Check for block.yml file

        const blockYml = Path.basename(this.file);

        if (!await cli.check(blockYml + ' exists', FS.existsSync(this.file))) {
            throw new Error(`${this.file} was not found`);
        }

        const fileStat = FS.statSync(this.file);

        if (!await cli.check(blockYml + ' is file', fileStat.isFile())) {
            throw new Error(`${this.file} is not a file. A valid file must be specified`);
        }

        //Check for Dockerfile
        const dockerfile = Path.join(this._directory, 'Dockerfile');
        if (!await cli.check('Dockerfile exists', FS.existsSync(dockerfile))) {
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

                await cli.progress('Checking that working directory is clean', async () => {
                    if (!(await handler.isWorkingDirectoryClean(this._directory))) {
                        throw new Error('Working directory is not clean. Make sure everything is committed or use --ignore-working-directory to ignore')
                    }
                });

                await cli.progress('Checking that working directory is up to date with remote', async () => {
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

        await cli.progress('Checking semantic version',async () => {
            const latestDefinition = await this._registryService.getLatestVersionBefore(this.name, this.version);

            if (latestDefinition) {
                const latestVersion = latestDefinition.block.metadata.version;
                const actualIncrement = BlockVersionCalculator.calculateIncrementType(latestVersion, this.version);

                const nextAutoVersion = await this._versionCalculator.calculateNextVersion(this.blockDefinition, latestDefinition.block);

                const requiredIncrement = BlockVersionCalculator.calculateIncrementType(latestVersion, nextAutoVersion);

                if (BlockVersionCalculator.isIncrementGreaterThan(requiredIncrement, actualIncrement)) {
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

        return await cli.progress(`Checking existing version for ${this.version}`,async () => {
            const existingDefinition = await this._registryService.getVersion(this.name, this.version);
            if (existingDefinition) {

                if (existingDefinition.checksum === checksum) {
                    throw new Error(`Version already existed for checksum: ${this.blockDefinition.metadata.version} > ${checksum}.`);
                }

                //Calculate new version based on the diff set between old and new definitions
                this.blockDefinition.metadata.version = await this._versionCalculator.calculateNextVersion(this.blockDefinition, existingDefinition.block);
                cli.info(`Calculated next semantic version to be: ${this.blockDefinition.metadata.version}`);
                FS.writeFileSync(this.file, YAML.stringify(this.blockDefinition));
                return true;
            } else {
                //We check if this is the first version - which is the only reason why the existing definition should be unavailable for auto-versioning
                const latestVersion = await this._registryService.getLatestVersionBefore(this.name, this.version);
                if (latestVersion) {
                    throw new Error(`Existing version ${this.version} not found. Auto-versioning requires that you do not change the version manually.`);
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
        return cli.progress(`Calculating checksum`, async () => {
            return await this._dockerService.calculateChecksum(this._directory);
        });
    }

    /**
     *
     * @returns {Promise<string>} returns image name
     */
    async buildDockerImage() {
        const dockerImageName = this._getLocalBuildName();
        await cli.progress(`Building local docker image: ${dockerImageName}`, async () => {
            const checksum = await this._dockerService.build(this._directory, [
                dockerImageName
            ]);

            console.log('checksum', checksum);
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
            cli.debug(data.line);
        });

        if (result.exit !== 0) {
            throw new Error('Script failed');
        }

    }

    async runTests() {
        if (this.cmdObj.skipTests) {
            cli.info("Skipping tests...");
            return;
        }

        try {
            await cli.progress('Running tests', async () => {
                return this._runScript('test.sh');
            });
        } catch (e) {
            throw new Error('Tests failed');
        }
    }

    async runBuild() {
        try {
            await cli.progress('Building block', async () => {
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
        //TODO: Either unstage everything or throw if there are staged changes

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
        tags.push(`${dockerImage}:${commitId}`);
        return tags;
    }

    _getVersionTags(prefix) {
        if (!prefix) {
            prefix = '';
        }

        const version = this.blockDefinition.metadata.version;

        const versionInfo =  BlockVersionCalculator.parseVersion(version);

        return [
            `${prefix}${versionInfo.major}.${versionInfo.minor}.${versionInfo.patch}`,
            `${prefix}${versionInfo.major}.${versionInfo.minor}`,
            `${prefix}${versionInfo.major}`
        ];
    }
    /**
     *
     * @param {string[]} tags
     * @returns {Promise<string[]>} returns all tags for image
     */
    async tagDockerImage(tags) {
        cli.info('Tagging docker images', tags);

        await this._dockerService.tag(this._getLocalBuildName(), tags);
    }


    async vcsPush(commitId, yamlChanged) {
        const handler = await this._vcs();

        const tag = 'v' + this.blockDefinition.metadata.version;

        cli.info("Adding tag to %s: %s", handler.getName(), tag);
        const tagged = await handler.tag(this._directory, tag);

        if (tagged || yamlChanged) {
            await handler.push(this._directory, tagged);
        } else {
            cli.info("No changes to %s - not pushing source", handler.getName());
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

        //Make sure file structure is as expected
        await cli.progress('Verifying files exist', async () => this.checkExists());

        await cli.progress('Verifying working directory', async () => this.checkWorkingDirectory());

        await this.runBuild();

        await this.runTests();


        const yamlChanged = await this.incrementVersion();

        await this.checkVersion();

        //Reserve registry version - start 2-phase commit
        const reservation = await cli.progress(
            `Reserving version: ${this.blockDefinition.metadata.version}`,
            async () => this.reserveVersion());

        try {
            reservation.checksum = await this.calculateChecksum();

            await cli.progress('Building docker image', async () => this.buildDockerImage());

            //Commit block.yml to version control with changes if they exist
            let commitId;
            if (yamlChanged) {
                commitId = await cli.progress('Committing changes', async () => this.vcsCommitBlock());
            } else {
                commitId = await this.getCurrentVcsCommit();
            }

            cli.info(`Assigning VCS commit id to version: ${commitId} > ${this.blockDefinition.metadata.version}`);

            //Record version control id of latest commit
            const handler = await this._vcs();
            reservation.vcs = {
                type: handler.getType(),
                checkout: await handler.getCheckoutInfo(this._directory),
                commitId
            };

            const dockerTags = this._getDockerTags(commitId);

            await cli.progress('Tagging docker image', async () => this.tagDockerImage(dockerTags));

            await cli.progress('Pushing docker image', async () => this.pushDockerImage(dockerTags));

            reservation.docker = {
                images: dockerTags
            };

            await cli.progress('Pushing source code', async () => this.vcsPush(commitId, yamlChanged));

            await cli.progress('Committing version', async () => this.commitReservation(reservation));
        } catch (e) {
            await cli.progress('Aborting version', async () => this.abortReservation(reservation));
            throw e;
        }
    }
}

/**
 *
 * @param {string} file
 * @param {PushCommandOptions} cmdObj
 * @returns {Promise<void>}
 */
module.exports = async function(file, cmdObj) {
    const operation = new PushOperation(file, cmdObj);

    try {
        await operation.perform();
    } catch(err) {
        cli.error('Push failed: %s', err.message);

        if (cmdObj.verbose && err.stack) {
            cli.debug(err.stack);
        }
    }

};