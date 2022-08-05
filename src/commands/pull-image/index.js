const YAML = require('yaml');
const Config = require('../../config');
const {parseBlockwareUri} = require('../../utils/BlockwareUriParser');
const CLIHandler = require('../../handlers/CLIHandler');
const RegistryService = require('../../services/RegistryService');
const DockerService = require('../../services/DockerService');

/**
 *
 * @param {string} uri
 * @param {CommandOptions} cmdObj
 * @returns {Promise<void>}
 */
module.exports = async function pullImage(uri, cmdObj) {
    const blockInfo = parseBlockwareUri(uri);

    const registryService = new RegistryService(
        cmdObj.registry || Config.data.registry.url,
        blockInfo.handle
    );

    const cli = new CLIHandler(true);

    cli.start('Pull image');

    try {

        const dockerService = new DockerService(cli);

        const registration = await registryService.getVersion(blockInfo.name, blockInfo.version);

        if (!registration) {
            throw new Error('Registration not found: ' + uri);
        }

        if (!registration.docker ||
            !registration.docker.image ||
            !registration.docker.image.primary) {
            throw new Error('Registration is missing docker information: ' + uri);
        }

        await cli.progress(`Pulling docker image: ${registration.docker.image.primary}`, async () => {
            await dockerService.pull(registration.docker.image.primary);
        });
    } finally {
        cli.end();
    }
};