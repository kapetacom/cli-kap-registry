const Config = require('../../config');
const {parseBlockwareUri} = require('../../utils/BlockwareUriParser');
const CLIHandler = require('../../handlers/CLIHandler');
const ArtifactHandler = require('../../handlers/ArtifactHandler');
const RegistryService = require('../../services/RegistryService');

/**
 *
 * @param {string} uri
 * @param {CommandOptions} cmdObj
 * @returns {Promise<void>}
 */
module.exports = async function pull(uri, cmdObj) {
    const blockInfo = parseBlockwareUri(uri);

    const registryService = new RegistryService(
        cmdObj.registry || Config.data.registry.url,
        blockInfo.handle
    );

    const cli = new CLIHandler(true);

    cli.start('Pull image');

    try {
        const registration = await registryService.getVersion(blockInfo.name, blockInfo.version);

        if (!registration) {
            throw new Error('Registration not found: ' + uri);
        }

        if (!registration.artifact?.type) {
            throw new Error('Registration is missing artifact information: ' + uri);
        }

        const handler = ArtifactHandler.getArtifactHandler(cli, registration.artifact.type);

        if (!handler) {
            throw new Error('Artifact type not found: ' + registration.artifact.type);
        }

        await handler.pull(registration.artifact.details);

    } finally {
        cli.end();
    }
};