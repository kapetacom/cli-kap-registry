const FS = require('node:fs');
const {parseBlockwareUri} = require('../../utils/BlockwareUriParser');
const CLIHandler = require('../../handlers/CLIHandler');
const FSExtra = require('fs-extra');
const ClusterConfiguration = require('@blockware/local-cluster-config');

/**
 *
 * @param {string} uri
 * @param {UninstallCommandOptions} cmdObj
 * @returns {Promise<void>}
 */
module.exports = async function uninstall(uri, cmdObj) {
    const blockInfo = parseBlockwareUri(uri);

    const cli = new CLIHandler(!cmdObj.nonInteractive);

    cli.start('Removing asset');

    const path = ClusterConfiguration.getRepositoryAssetPath(blockInfo.handle, blockInfo.name, blockInfo.version);

    if (!FS.existsSync(path)) {
        throw new Error('Asset not installed: ' + uri);
    }

    //TODO: Remove all assets that depend on this asset
    FSExtra.removeSync(path, {recursive: true});

    await cli.check(`Removed asset ${uri}`, true);

};