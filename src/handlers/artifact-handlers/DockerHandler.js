const FS = require('node:fs');
const Path = require('node:path');
const URL = require('node:url');
const DockerService = require("../../services/DockerService");
const Config = require("../../config");
const VersionCalculator = require("../../utils/VersionCalculator");
const Authentication = require("../../services/Authentication");
const FSExtra = require("fs-extra");
/**
 * @class
 * @implements {ArtifactHandler}
 */
class DockerHandler {
    /**
     *
     * @param {CLIHandler} cli
     * @param {string} directory
     */
    constructor(cli, directory) {
        this._cli = cli;
        this._directory = directory;
        this._hostInfo = URL.parse(Config.data.registry.docker);
        this._dockerService = new DockerService(this._cli, this._hostInfo, new Authentication().getToken());


    }


    static getType() {
        return "docker";
    }

    /**
     *
     * @param dirname
     * @returns {Promise<boolean>}
     */
    static async isSupported(dirname) {
        return FS.existsSync(Path.join(dirname,'Dockerfile'));
    }

    static create(cli, directory) {
        return new DockerHandler(cli, directory);
    }

    getName() {
        return "Docker";
    }


    async verify() {
        return this._dockerService.verify();
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
     * @param {string} name
     * @param {string} version
     * @param {string|undefined} [commitId]
     * @returns {Promise<Artifact<DockerDetails>>}
     */
    async push( name, version, commitId) {
        //Create artifact

        await this._cli.progress(`Building docker image for ${name}:${version}`, async () => this.buildDockerImage(name));

        const dockerTags = this._getDockerTags(name, version, commitId);

        await this._cli.progress('Tagging docker image', async () => this.tagDockerImage(name, dockerTags));

        await this._cli.progress('Pushing docker image', async () => await this._dockerService.push(dockerTags));

        return {
            type: DockerHandler.getType(),
            details: {
                name: this._getDockerImageName(name),
                primary: this._getPrimaryDockerImage(name, version),
                tags: dockerTags
            }
        };
    }

    /**
     *
     * @param {string} name
     * @param {string} version
     * @param {string} [commitId]
     * @returns {string[]}
     * @private
     */
    _getDockerTags(name, version, commitId) {
        const dockerImage = this._getDockerImageName(name);

        const tags = this._getVersionTags(version, dockerImage + ':');
        if (commitId) {
            tags.push(`${dockerImage}:${commitId}`);
        }

        return tags;
    }

    /**
     *
     * @param {string} version
     * @param {string} [prefix='']
     * @returns {string[]}
     * @private
     */
    _getVersionTags(version, prefix) {
        if (!prefix) {
            prefix = '';
        }

        const versionInfo = VersionCalculator.parseVersion(version);

        return [
            `${prefix}${versionInfo.major}.${versionInfo.minor}.${versionInfo.patch}`,
            `${prefix}${versionInfo.major}.${versionInfo.minor}`,
            `${prefix}${versionInfo.major}`
        ];
    }

    /**
     *
     * @param {string} name
     * @param {string} version
     * @returns {string}
     * @private
     */
    _getPrimaryDockerImage(name, version) {
        const dockerImage = this._getDockerImageName(name);

        return `${dockerImage}:${version}`;
    }

    /**
     *
     * @param {string} name
     * @param {string[]} tags
     * @returns {Promise<string[]>} returns all tags for image
     */
    async tagDockerImage(name, tags) {
        this._cli.info('Tagging docker images', tags);

        await this._dockerService.tag(this._getLocalBuildName(name), tags);
    }


    /**
     *
     * @param {string} name
     * @returns {Promise<string>} returns image name
     */
    async buildDockerImage(name) {
        const dockerImageName = this._getLocalBuildName(name);
        await this._cli.progress(`Building local docker image: ${dockerImageName}`, async () => {
            return this._dockerService.build(this._directory, [
                dockerImageName
            ]);
        });

        return dockerImageName
    }

    /**
     *
     * @param {string} name
     * @returns {string}
     * @private
     */
    _getDockerImageName(name) {
        if (this._hostInfo) {
            return `${this._hostInfo.host}/${name}`.toLowerCase();
        }
        return `${name}`.toLowerCase();
    }

    /**
     *
     * @param {string} name
     * @returns {string}
     * @private
     */
    _getLocalBuildName(name) {
        return `${name}:local`.toLowerCase();
    }


    /**
     *
     * @param {DockerDetails} details
     * @param {string} target
     * @param {RegistryService} registryService
     * @returns {Promise<void>}
     */
    async pull(details, target, registryService) {
        await this._cli.progress(`Pulling docker image: ${details.primary}`, async () => {
            await this._dockerService.pull(details.primary);
        });

        //We just put this here to actually put something on disk
        //Currently unused
        FS.writeFileSync(Path.join(target, 'docker-info.json'), JSON.stringify(details, null, 2));
    }

    async install(sourcePath, targetPath) {
        FSExtra.moveSync(sourcePath, targetPath, {recursive: true, overwrite: true});
    }

    async build() {
        //Meant as a pre-test thing - Not applicable
    }

    async test() {
        //Meant as a pre-deploy thing - Not applicable
    }
}

/**
 *
 * @type {ArtifactHandlerFactory}
 *
 */
module.exports = DockerHandler;