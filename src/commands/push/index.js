const Path = require('path');
const FS = require('fs');
const YAML = require('yaml');
const Installer = require('../install');
const Linker = require('../link');
const VCSHandler = require('../../handlers/VCSHandler');
const ArtifactHandler = require('../../handlers/ArtifactHandler');
const CLIHandler = require('../../handlers/CLIHandler');
const RegistryService = require('../../services/RegistryService');
const Config = require('../../config');
const {parseBlockwareUri} = require("../../utils/BlockwareUriParser");
const ClusterConfiguration = require("@blockware/local-cluster-config");
const glob = require("glob");

const LOCAL_VERSION_MAPPING_CACHE = {};

class PushOperation {

    /**
     *
     * @param {CLIHandler} cli
     * @param {string} directory
     * @param {PushCommandOptions} cmdObj
     */
    constructor(cli, directory, cmdObj) {

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
        this.file = Path.resolve(process.cwd(), directory, 'blockware.yml');

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
                await this._cli.progress('Verifying artifact type handler', () => this._artifactHandler.verify());
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
     * @param {ReservationRequest} reservationRequest
     * @returns {Promise<Reservation>}
     */
    async reserveVersions(reservationRequest) {
        this.reservation = await this._registryService.reserveVersions(reservationRequest);
        if (!this.reservation) {
            throw new Error('Failed to reserve version - no reservation returned from registry. ');
        }
        return this.reservation;
    }

    _hasScript(file) {
        const scriptPath = './scripts/' + file;
        return FS.existsSync(scriptPath);
    }

    async _runScript(file) {
        const scriptPath = './scripts/' + file;
        if (!this._hasScript(file)) {
            throw new Error('Script not found: ' + scriptPath);
        }

        const stat = FS.statSync(scriptPath);
        if (!stat.isFile()) {
            throw new Error('Script not a file: ' + scriptPath);
        }

        return this._cli.run(scriptPath, this._directory);
    }

    /**
     *
     * @param {ArtifactHandler} artifactHandler
     * @returns {Promise<void>}
     */
    async runTests(artifactHandler) {
        if (this.cmdObj.skipTests) {
            this._cli.info("Skipping tests...");
            return;
        }

        try {
            await this._cli.progress('Running tests', async () => {
                if (this._hasScript('test.sh')) {
                    return this._runScript('test.sh');
                } else {
                    return artifactHandler.test();
                }
            });
        } catch (e) {
            throw new Error('Tests failed');
        }
    }

    findAssetsInPath() {
        const baseDir = Path.dirname(this.file);
        const assetFiles = glob.sync('*/**/blockware.yml', {cwd: baseDir});
        const localAssets = {};
        for(let assetFile of assetFiles) {
            const fullPath = Path.join(baseDir,assetFile);
            const yamlData = FS.readFileSync(fullPath).toString();
            const assets = YAML.parseAllDocuments(yamlData).map(doc => doc.toJSON());
            assets.forEach(asset => {
                localAssets[asset.metadata.name] = Path.dirname(fullPath);
            });
        }

        return localAssets;
    }

    async checkDependencies() {
        const localAssets = this.findAssetsInPath();
        await this._cli.progress(`Checking ${Object.keys(localAssets).length} dependencies`, async () => {
            const newAssets = [];

            for(let assetDefinition of this.assetDefinitions) {
                newAssets.push(await this._checkDependenciesFor(assetDefinition, localAssets));
            }

            //We overwrite assetDefinitions since we might have resolved some dependencies
            this.assetDefinitions = newAssets;
        });
    }



    /**
     *
     * @param {AssetDefinition} asset
     * @param {{[key:string]:string}} localAssets
     * @return {Promise<AssetDefinition>}
     * @private
     */
    async _checkDependenciesFor(asset, localAssets) {
        const dependencies = await this.resolveDependencies(asset);

        console.log('dependencies', dependencies);
        /**
         *
         * @type {ReferenceMap[]}
         */
        const dependencyChanges = [];
        for(let dependency of dependencies) {
            const dependencyUri = parseBlockwareUri(dependency.name);
            if (dependencyUri.version !== 'local') {
                //If not local all is well
                continue;
            }

            if (LOCAL_VERSION_MAPPING_CACHE[dependency.name]) {
                //Mapping already found
                dependencyChanges.push({
                    from: dependency.name,
                    to: LOCAL_VERSION_MAPPING_CACHE[dependency.name]
                });
                continue;
            }

            const key = `${dependencyUri.handle}/${dependencyUri.name}`
            let assetLocalPath;
            if (localAssets[key]) {
                assetLocalPath = localAssets[key];
                this._cli.info(`Resolved local version for ${key} from path: ${assetLocalPath}`);
            } else {
                const localPath = ClusterConfiguration
                    .getRepositoryAssetPath(dependencyUri.handle, dependencyUri.name, dependencyUri.version);

                if (!FS.existsSync(localPath)) {
                    throw new Error('Path for local dependency not found: ' + localPath);
                }

                assetLocalPath = FS.realpathSync(localPath);

                if (!FS.existsSync(assetLocalPath)) {
                    throw new Error('Resolved path for local dependency not found: ' + localPath);
                }

                this._cli.info(`Resolved local version for ${key} from local repository: ${assetLocalPath}`);
            }


            //Local dependency - we need to push that first and
            //replace version with pushed version - but only "in-flight"
            //We dont want to change the disk version - since that allows users
            //to continue working on their local versions + local dependencies
            await this._cli.progress(`Pushing local version for ${key}`, async () => {
                const dependencyOperation = new PushOperation(this._cli, assetLocalPath, this.cmdObj);

                const {references} = await dependencyOperation.perform();

                if (references &&
                    references.length > 0) {
                    for(let reference of references) {
                        const referenceUri = parseBlockwareUri(reference);
                        if (referenceUri.handle === dependencyUri.handle &&
                            referenceUri.name === dependencyUri.name &&
                            referenceUri.version !== 'local') {
                            this._cli.info('Resolved version for local dependency: %s > %s', dependency.name, referenceUri.version);
                            dependencyChanges.push({
                                from: dependency.name,
                                to: reference
                            });
                        }
                    }
                }
            });
        }

        if (dependencyChanges.length > 0) {
            dependencyChanges.forEach(ref => {
                //Cache mappings for other push operations and assets
                LOCAL_VERSION_MAPPING_CACHE[ref.from] = ref.to;
            });
            return this.updateDependencies(asset, dependencyChanges);
        }

        return asset;
    }

    /**
     *
     * @param {ArtifactHandler} artifactHandler
     * @returns {Promise<void>}
     */
    async runBuild(artifactHandler) {
        try {
            await this._cli.progress('Building block', async () => {
                if (this._hasScript('build.sh')) {
                    return this._runScript('build.sh');
                } else {
                    return artifactHandler.build();
                }
            });
        } catch (e) {
            throw e;
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
        return await this._registryService.commitReservation(reservation.id, assetVersions);
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
     *
     * @param {AssetDefinition} asset
     * @return {Promise<AssetReference[]>}
     */
    async resolveDependencies(asset) {
        return this._registryService.resolveDependencies(asset);
    }


    /**
     *
     * @param {AssetDefinition} asset
     * @param {ReferenceMap[]} dependencies
     * @return {Promise<AssetDefinition>}
     */
    async updateDependencies(asset, dependencies) {
        return this._registryService.updateDependencies(asset, dependencies);
    }

    getReadmeData() {
        const paths = [
            {
                type: 'markdown',
                path: Path.join(this._directory,'README.md'),
            },
            {
                type: 'text',
                path: Path.join(this._directory,'README.txt')
            },
            {
                type: 'text',
                path: Path.join(this._directory,'README')
            }
        ]

        for(let i = 0; i < paths.length; i++) {
            const pathInfo = paths[i];
            if (FS.existsSync(pathInfo.path)) {
                return {
                    type: pathInfo.type,
                    content: FS.readFileSync(pathInfo.path).toString()
                }
            }
        }

        return null;
    }

    /**
     * Calls each check and step in the order it's intended.
     *
     * @returns {Promise<{references:string[],mainBranch:boolean}>}
     */
    async perform() {
        const vcsHandler = await this.vcsHandler();
        const artifactHandler = await this.artifactHandler();
        const dryRun = !!this.cmdObj.dryRun;


        //Make sure file structure is as expected
        await this._cli.progress('Verifying files exist', async () => this.checkExists());

        await this._cli.progress('Verifying working directory', async () => this.checkWorkingDirectory());

        await this.checkDependencies();

        await this.runBuild(artifactHandler);

        await this.runTests(artifactHandler);

        const {branch, main} = vcsHandler ?
            await vcsHandler.getBranch(this._directory)
            : {main:true, branch: 'master'};

        const commit =  vcsHandler ? await this.getCurrentVcsCommit() : null;
        const checksum = await artifactHandler.calculateChecksum();

        const reservation = await this._cli.progress(
            `Create version reservation`,
            async () => this.reserveVersions({
                assets: this.assetDefinitions,
                mainBranch: main,
                branchName: branch,
                commit,
                checksum
            })
        );

        const existingVersions = [];

        reservation.versions = reservation.versions.filter(version => {
            if (version.exists) {
                existingVersions.push(version);
            }
            return !version.exists;
        });

        if (existingVersions.length > 0) {
            this._cli.info(`Version already existed remotely:`);
            existingVersions.forEach(v => {
                this._cli.info(` - ${v.content.metadata.name}:${v.version}`);
            });
        }

        if (reservation.versions.length < 1) {
            this._cli.info(`No new versions found.`);
            return {
                references: existingVersions.map(assetVersion => {
                    return `blockware://${assetVersion.content.metadata.name}:${assetVersion.version}`;
                }),
                mainBranch: main
            };
        }

        this._cli.info(`Got new versions: `);
        reservation.versions.forEach(v => {
            this._cli.info(` - ${v.content.metadata.name}:${v.version}`);
        })

        /**
         * @type {AssetVersion[]}
         */
        const assetVersions = [];

        try {


            let commitId;
            /**
             * @type {Repository<any>}
             */
            let repository;

            /**
             * Tags for pushing when successful
             * @type {string[]}
             */
            let vcsTags = [];

            if (vcsHandler) {

                repository = {
                    type: vcsHandler.getType(),
                    details: await vcsHandler.getCheckoutInfo(this._directory),
                    commit,
                    branch,
                    main
                };
                commitId = commit;
                if (main) {
                    this._cli.info(`Assigning ${vcsHandler.getName()} commit id to version: ${commitId} > [${reservation.versions.map(v => v.version).join(', ')}]`);
                    if (reservation.versions.length > 1) {
                        for(let i = 0; i < reservation.versions.length; i++) {
                            const version = reservation.versions[i].version;
                            const assetDefinition = reservation.versions[i].content;
                            //Multiple assets in this repo - use separate tags for each
                            vcsTags.push(`v${version}-${assetDefinition.metadata.name}`);
                        }
                    } else if (reservation.versions.length === 1) {
                        //Only 1 asset in this repo - use simple version
                        vcsTags.push(`v${reservation.versions[0].version}`);
                    }
                }
            }



            this._cli.info(`Calculated checksum for artifact: ${checksum}`);

            const readme = this.getReadmeData();

            if (!dryRun) {

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
                        readme,
                        repository,
                        artifact
                    }

                    assetVersions.push(assetVersion);
                }

                await this._cli.progress(`Committing versions: ${assetVersions.map(av => av.version)}`, async () => this.commitReservation(reservation, assetVersions));

                if (vcsHandler && vcsTags.length > 0) {
                    try {
                        await this._cli.progress('Tagging commit', async () => {
                            for (let i = 0; i < vcsTags.length; i++) {
                                await vcsHandler.tag(this._directory, vcsTags[i]);
                            }

                            await vcsHandler.pushTags(this._directory);
                        });
                    } catch (e) {
                        //Ignore errors for tagging
                    }
                }

                await this._cli.check(`Push completed`, true);
            } else {
                for (let i = 0; i < reservation.versions.length; i++) {
                    const reservedVersion = reservation.versions[i];
                    const name = reservedVersion.content.metadata.name;



                    /**
                     *
                     * @type {AssetVersion}
                     */
                    const assetVersion = {
                        version: reservedVersion.version,
                        content: reservedVersion.content,
                        checksum,
                        readme,
                        repository,
                        artifact: null
                    }

                    assetVersions.push(assetVersion);
                    this._cli.info('Result:')
                    this._cli.info(YAML.stringify(assetVersions));
                }

                await this._cli.check(`Dry run completed`, true);
            }

            return {
                references: assetVersions.map(assetVersion => {
                    return `blockware://${assetVersion.content.metadata.name}:${assetVersion.version}`;
                }),
                mainBranch: main
            };

        } catch (e) {
            await this._cli.progress('Aborting version', async () => this.abortReservation(reservation));
            throw e;
        }
    }
}

/**
 *
 * @param {PushCommandOptions} cmdObj
 * @returns {Promise<void>}
 */
module.exports = async function push(cmdObj) {


    const cli = CLIHandler.get(!cmdObj.nonInteractive);

    const operation = new PushOperation(cli, process.cwd(), cmdObj);

    cli.start(`Push ${operation.file}`);

    try {

        if (!cmdObj.skipLinking && !cmdObj.dryRun) {
            await cli.progress('Linking local version', () => Linker());
        }

        const {references,mainBranch} = await operation.perform();

        if (mainBranch &&
            !cmdObj.skipInstall &&
            !cmdObj.dryRun &&
            references.length > 0) {
            //We install assets once we've pushed them.
            await cli.progress('Installing new versions', () => Installer(references, {
                nonInteractive: cmdObj.nonInteractive,
                registry: cmdObj.registry,
                skipDependencies: true
            }));
        }

    } catch (err) {
        cli.error('Push failed');

        if (cmdObj.verbose && err.stack) {
            cli.error(err.stack);
        }
        throw err;
    }

};