const YAML = require('yaml');
const Path = require("node:path");
const FS = require("node:fs");
const FSExtra = require('fs-extra');
const ClusterConfiguration = require('@kapeta/local-cluster-config');
const CLIHandler = require("../../handlers/CLIHandler");

function makeSymLink(directory, versionTarget) {
    if (FS.existsSync(versionTarget)) {
        FSExtra.removeSync(versionTarget);
    }
    FSExtra.mkdirpSync(Path.dirname(versionTarget));
    FSExtra.createSymlinkSync(directory, versionTarget);
}

/**
 *
 * @param {string} [source=process.cwd()]
 * @returns {Promise<void>}
 */
module.exports = async function link(source) {
    if (!source) {
        source = process.cwd();
    }

    const cli = CLIHandler.get(false);

    const kapetaYmlFilePath = Path.join(source, 'kapeta.yml');
    if (!FS.existsSync(kapetaYmlFilePath)) {
        throw new Error('Current working directory is not a valid kapeta asset. Expected a kapeta.yml file');
    }

    const assetInfos = YAML.parseAllDocuments(FS.readFileSync(kapetaYmlFilePath).toString())
        .map(doc => doc.toJSON());

    //If there are multiple assets in the kapeta.yml - we still just create 1 symlink since both will
    //otherwise be loaded twice
    const assetInfo = assetInfos[0];
    const [handle, name] = assetInfo.metadata.name.split('/');
    const target = ClusterConfiguration.getRepositoryAssetPath(handle, name, 'local');
    makeSymLink(source, target);

    assetInfos.forEach(blockInfo => {
        cli.info('Linked asset %s:local\n  %s --> %s', blockInfo.metadata.name, source, target);
    })

    await cli.check('Linking done', true);

};
