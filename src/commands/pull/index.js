const Config = require('../../config');
const {parseBlockwareUri} = require('../../utils/BlockwareUriParser');
const CLIHandler = require('../../handlers/CLIHandler');
const ArtifactHandler = require('../../handlers/ArtifactHandler');
const RegistryService = require('../../services/RegistryService');
const YAML = require('yaml');
const Path = require('path');
const FS = require('fs');

/**
 *
 * @param {string} uri
 * @param {PullCommandOptions} cmdObj
 * @returns {Promise<void>}
 */
module.exports = async function pull(uri, cmdObj) {
    const blockInfo = parseBlockwareUri(uri);

    const registryService = new RegistryService(
        cmdObj.registry || Config.data.registry.url,
        blockInfo.handle
    );

    const cli = new CLIHandler(!cmdObj.nonInteractive);

    cli.start('Pull image');

    const registration = await registryService.getVersion(blockInfo.name, blockInfo.version);

    if (!registration) {
        throw new Error('Registration not found: ' + uri);
    }

    if (!registration.artifact?.type) {
        throw new Error('Registration is missing artifact information: ' + uri);
    }

    const handler = ArtifactHandler.getArtifactHandlerByType(cli, registration.artifact.type);

    if (!handler) {
        throw new Error('Artifact type not found: ' + registration.artifact.type);
    }

    const target = cmdObj.target ? cmdObj.target : process.cwd();

    cli.info(`Pulling artifact using ${handler.getName()}`);

    await handler.pull(registration.artifact.details, target, registryService);

    //Write the blockware.yml - it's usually included in the package but might contain multiple
    const targetYML = Path.join(target, 'blockware.yml');
    FS.writeFileSync(targetYML, YAML.stringify(registration.content));

    cli.info(`Wrote blockware.yml to ${targetYML}`);

};