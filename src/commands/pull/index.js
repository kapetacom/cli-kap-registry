const Config = require('../../config');
const {parseBlockwareUri} = require('../../utils/BlockwareUriParser');
const CLIHandler = require('../../handlers/CLIHandler');
const ArtifactHandler = require('../../handlers/ArtifactHandler');
const RegistryService = require('../../services/RegistryService');
const YAML = require('yaml');
const Path = require('path');
const FS = require('fs');
const FSExtra = require('fs-extra');
const ClusterConfiguration = require('@blockware/local-cluster-config');

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

    cli.start('Pull artifact');

    const assetVersion = await registryService.getVersion(blockInfo.name, blockInfo.version);

    if (!assetVersion) {
        throw new Error('Registration not found: ' + uri);
    }

    if (!assetVersion.artifact?.type) {
        throw new Error('Registration is missing artifact information: ' + uri);
    }

    const handler = ArtifactHandler.getArtifactHandlerByType(cli, assetVersion.artifact.type);

    if (!handler) {
        throw new Error('Artifact type not found: ' + assetVersion.artifact.type);
    }

    //If no target is provided - we add this asset to the local repo
    const addToLocalRepo = !cmdObj.target;

    const target = addToLocalRepo ?
        Path.join(ClusterConfiguration.getRepositoryBasedir(),
            blockInfo.handle, blockInfo.name, blockInfo.version)
        : cmdObj.target;

    cli.info(`Pulling artifact using ${handler.getName()}`);

    await handler.pull(assetVersion.artifact.details, target, registryService);

    const blockwareFolder = Path.join(target, '.blockware');

    FSExtra.mkdirpSync(blockwareFolder);

    //Write the asset.yml - it's usually included in the package but might contain multiple
    const targetYML = Path.join(blockwareFolder, 'asset.yml');
    FS.writeFileSync(targetYML, YAML.stringify(assetVersion.content));

    cli.info(`Wrote block information to ${targetYML}`);

    //Write version information to file
    const versionYML = Path.join(blockwareFolder, 'version.yml');
    FS.writeFileSync(versionYML, YAML.stringify(assetVersion));

    cli.info(`Wrote version information to ${versionYML}`);

};