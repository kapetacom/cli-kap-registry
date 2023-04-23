const Path = require('node:path');
const OS = require('node:os');
const FS = require('node:fs');
const Config = require('../../config');
const {parseKapetaUri} = require('../../utils/KapetaUriParser');
const CLIHandler = require('../../handlers/CLIHandler');
const ArtifactHandler = require('../../handlers/ArtifactHandler');
const RegistryService = require('../../services/RegistryService');
const YAML = require('yaml');
const FSExtra = require('fs-extra');
const ClusterConfiguration = require('@kapeta/local-cluster-config');

const attemptedToInstall = {};

/**
 *
 * @param {string[]} uris
 * @param {InstallCommandOptions} cmdObj
 * @returns {Promise<void>}
 */
module.exports = async function install(uris, cmdObj) {
    const cli = CLIHandler.get(!cmdObj.nonInteractive);
    cli.start('Installing assets');

    return doInstall(cli, uris, cmdObj)
};

async function doInstall(cli, uris, cmdObj) {
    const allDependencies = {};

    for(let i = 0; i < uris.length; i++) {
        const uri = uris[i];
        const blockInfo = parseKapetaUri(uri);

        try {
            const registryService = new RegistryService(
                cmdObj.registry || Config.data.registry.url,
                blockInfo.handle
            );


            const assetVersion = await cli.progress(`Loading ${uri}`,
                () => registryService.getVersion(blockInfo.name, blockInfo.version)
            );

            if (!assetVersion) {
                throw new Error('Registration not found: ' + uri);
            }

            if (!assetVersion.artifact?.type) {
                throw new Error('Registration is missing artifact information: ' + uri);
            }

            const installPath = ClusterConfiguration.getRepositoryAssetPath(
                blockInfo.handle,
                blockInfo.name,
                assetVersion.version
            );

            attemptedToInstall[`${blockInfo.handle}/${blockInfo.name}:${assetVersion.version}`] = true;

            const assetExists = await cli.progress('Checking if asset exists', () => Promise.resolve(FS.existsSync(installPath)));
            if (assetExists) {
                await cli.check(`Asset already installed at ${installPath}`, true);
                continue;
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

            assetVersion.dependencies.forEach(d => {
                allDependencies[d.name] = true;
            });
        } catch (e) {
            cli.error(`Failed to install: ${e.message}`);
        }
    }

    if (!cmdObj.skipDependencies) {
        const dependencies = Object.keys(allDependencies).filter(d => !attemptedToInstall[d]);
        if (dependencies.length === 0) {
            cli.info('Done');
            return;
        }

        return cli.progress(`Installing ${dependencies.length} dependencies`, () => doInstall(cli, dependencies, cmdObj));
    }

    await cli.check('Done installing', true);
}
