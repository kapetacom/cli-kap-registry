const Path = require('node:path');
const OS = require('node:os');
const FS = require('node:fs');
const Config = require('../../config');
const {parseBlockwareUri} = require('../../utils/BlockwareUriParser');
const CLIHandler = require('../../handlers/CLIHandler');
const ArtifactHandler = require('../../handlers/ArtifactHandler');
const RegistryService = require('../../services/RegistryService');
const YAML = require('yaml');
const FSExtra = require('fs-extra');
const ClusterConfiguration = require('@blockware/local-cluster-config');

/**
 *
 * @param {string} uri
 * @param {InstallCommandOptions} cmdObj
 * @returns {Promise<void>}
 */
module.exports = async function install(uri, cmdObj) {
    const blockInfo = parseBlockwareUri(uri);

    const registryService = new RegistryService(
        cmdObj.registry || Config.data.registry.url,
        blockInfo.handle
    );

    const cli = new CLIHandler(!cmdObj.nonInteractive);

    cli.start('Installing artifact');

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

    cli.info(`Pulling artifact using ${handler.getName()}`);

    const tmpFolder = Path.join(OS.tmpdir(), 'blockctl-asset-install', blockInfo.handle, blockInfo.name, assetVersion.version);
    if (FS.existsSync(tmpFolder)) {
        FSExtra.removeSync(tmpFolder);
    }

    FSExtra.mkdirpSync(tmpFolder);

    await handler.pull(assetVersion.artifact.details, tmpFolder, registryService);

    const installPath = ClusterConfiguration.getRepositoryAssetPath(
        blockInfo.handle,
        blockInfo.name,
        assetVersion.version
    );

    FSExtra.mkdirpSync(installPath);

    await handler.install(tmpFolder, installPath);

    const {baseDir, assetFile, versionFile} = ClusterConfiguration.getRepositoryAssetInfoPath(
        blockInfo.handle,
        blockInfo.name,
        assetVersion.version
    );

    FSExtra.mkdirpSync(baseDir);

    //Write the asset file - it's usually included in the package but might contain multiple
    FS.writeFileSync(assetFile, YAML.stringify(assetVersion.content));
    cli.info(`Wrote asset information to ${assetFile}`);

    //Write version information to file
    FS.writeFileSync(versionFile, YAML.stringify(assetVersion));
    cli.info(`Wrote version information to ${versionFile}`);

    //TODO: Install all assets that this asset depends on
    //They should be in assetVersion.dependencies
};