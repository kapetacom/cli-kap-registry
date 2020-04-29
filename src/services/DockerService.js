const Docker = require('dockerode');
const DockerfileParser = require('docker-file-parser');
const FS = require('fs');
const Path = require('path');
const glob = require('glob');
const tar = require('tar-fs');
const zlib = require('zlib');
const crypto = require('crypto');

const {promisifyStream} = require('../utils/PromiseUtils');

const createDockerDataHandler = function(lineHandler) {
    return  (data) => {
        const chunks = data.toString().trim().split(/\n/g);
        chunks.forEach((chunk) => {
            const info = JSON.parse(chunk);
            lineHandler(info);
        });

    }
};

class DockerService {

    /**
     *
     * @param {CLIHandler} cli
     */
    constructor(cli) {
        this._cli = cli;
        this._docker = new Docker();
    }

    async pull(image) {
        let [imageName, tag] = DockerService.splitName(image);
        if (!tag) {
            tag = 'latest';
        }

        await this._docker.image.create({}, {
            fromImage: imageName,
            tag: tag
        }).then(stream => promisifyStream(stream));
    }

    _pack(directory) {
        const entries = this._getFilesToBeAdded(Path.join(directory, 'Dockerfile'));
        entries.push('Dockerfile');

        const pack = tar.pack(directory, {
            entries
        });

        return pack.pipe(zlib.createGzip());
    }

    async calculateChecksum(directory) {
        const hash = crypto.createHash('sha256');
        const stream = this._pack(directory);

        stream.on('data', function(data) {
            hash.update(data);
        });

        await promisifyStream(stream);

        return hash.digest('hex');
    }

    /**
     *
     * @param {string} directory
     * @param {string[]} imageTags
     * @returns {Promise<string>}
     */
    async build(directory, imageTags) {

        const stream = this._pack(directory);

        const buildStream = await this._docker.buildImage(stream, {t: imageTags});

        await promisifyStream(buildStream, createDockerDataHandler((data) => {
            if (data.stream &&
                data.stream.trim()) {
                this._cli.debug(data.stream.trim());
            }
        }));
    }

    /**
     *
     * @param {string[]} tags
     * @returns {Promise<void>}
     */
    async push(tags) {

        for(let i = 0 ; i < tags.length; i++) {
            const fullTag = tags[i];
            let [imageName,tag] = DockerService.splitName(fullTag);

            const image = this._docker.getImage(imageName);
            await this._cli.progress("Pushing docker image: " + fullTag, async() => {
                const stream = await image.push({tag});
                await promisifyStream(stream, createDockerDataHandler((data) => {
                    if (!data.status) {
                        return;
                    }

                    if (!data.id) {
                        this._cli.debug(data.status.trim());
                        return;
                    }
                    this._cli.debug(data.id, data.status.trim(), data.progressDetail && data.progressDetail.progress  ? data.progressDetail.progress : '');
                }));
            });
        }
    }

    static splitName(imageName) {
        let slashIx = imageName.lastIndexOf('/');
        if (slashIx < 0) {
            slashIx = 0;
        }

        const colonIx = imageName.lastIndexOf(':');
        if (colonIx < slashIx) {
            //Either not there or part of repo name:
            //- my-image
            //- localhost:5000/my-image
            return [imageName, 'latest'];
        }


        const tag = imageName.substr(colonIx + 1);
        imageName = imageName.substr(0, colonIx);

        return [imageName, tag];
    }

    /**
     *
     * @param {string} imageName
     * @param {string[]} tags
     * @returns {Promise<void>}
     */
    async tag(imageName, tags) {
        const image = this._docker.getImage(imageName);

        for(let i = 0; i < tags.length; i++) {
            const fullTag = tags[i];
            const [repo, tag] = DockerService.splitName(fullTag);
            await image.tag({
                repo,
                tag
            });
        }
    }

    /**
     *
     * @param {string} image
     * @param {string[]} command
     * @returns {Promise<void>}
     */
    async execute(image, command) {
        const dockerContainer = await this._docker.createContainer({
            Tty: true,
            Image: image,
            Cmd: command
        });

        const stream = await dockerContainer.attach({
            stream: true,
            stdout: true,
            stderr: true
        });

        await dockerContainer.start();
        await promisifyStream(stream, (line) => {
            this._cli.debug(line);
        });

        const inspect = await dockerContainer.inspect();
        if (inspect.State &&
            inspect.State.ExitCode !== 0) {
            throw new Error('Container execution failed');
        }
    }


    /**
     * Reads Dockerfile and returns all files that are to be added to the image
     * @param dockerfile
     * @returns {[]}
     * @private
     */
    _getFilesToBeAdded(dockerfile) {
        const dockerFileContent = FS.readFileSync(dockerfile).toString();
        const directory = Path.dirname(dockerfile);

        const dockerCommands = DockerfileParser.parse(dockerFileContent);

        const addCommands = dockerCommands.filter((command) => ['COPY','ADD'].indexOf(command.name) > -1);

        let files = [];

        addCommands.forEach((addCommand) => {

            const addedFiles = glob.sync(addCommand.args[0], {cwd: directory});
            files = files.concat(addedFiles);
        });


        return files;
    }
}

module.exports = DockerService;