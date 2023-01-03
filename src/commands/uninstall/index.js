const FS = require('node:fs');
const {parseBlockwareUri} = require('../../utils/BlockwareUriParser');
const CLIHandler = require('../../handlers/CLIHandler');
const FSExtra = require('fs-extra');
const ClusterConfiguration = require('@blockware/local-cluster-config');

/**
 *
 * @param {string[]} uris
 * @param {UninstallCommandOptions} cmdObj
 * @returns {Promise<void>}
 */
module.exports = async function uninstall(uris, cmdObj) {
    const cli = new CLIHandler(!cmdObj.nonInteractive);
    cli.start('Removing assets');
    for (let i = 0; i < uris.length; i++) {
        const uri = uris[i];
        const blockInfo = parseBlockwareUri(uri);
        const path = ClusterConfiguration.getRepositoryAssetPath(blockInfo.handle, blockInfo.name, blockInfo.version);

        if (!FS.existsSync(path)) {
            await cli.check(`Asset not installed: ${uri}`, false);
            continue;
        }

        //TODO: Remove all assets that depend on this asset
        FSExtra.removeSync(path, {recursive: true});

        await cli.check(`Removed asset: ${uri}`, true);
    }

};