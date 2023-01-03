const YAML = require('yaml');
const Path = require("node:path");
const FS = require("node:fs");
const FSExtra = require('fs-extra');
const ClusterConfiguration = require('@blockware/local-cluster-config');

function makeSymLink(directory, versionTarget) {
    FSExtra.mkdirpSync(Path.dirname(versionTarget));
    FSExtra.createSymlinkSync(directory, versionTarget);
}

/**
 *
 * @param {string} uri
 * @param {CommandOptions} cmdObj
 * @returns {Promise<void>}
 */
module.exports = async function link(uri, cmdObj) {
    const blockwareYmlFilePath = Path.join(process.cwd(), 'blockware.yml');
    if (!FS.existsSync(blockwareYmlFilePath)) {
        console.error('Current working directory is not a valid blockware asset. Expected a blockware.yml file');
        return;
    }

    const blockInfos = YAML.parseAllDocuments(FS.readFileSync(blockwareYmlFilePath).toString())
        .map(doc => doc.toJSON());
    blockInfos.forEach(blockInfo => {
        const [handle, name] = blockInfo.metadata.name.split('/');
        const target = ClusterConfiguration.getRepositoryAssetPath(handle, name, 'local');
        makeSymLink(process.cwd(), target);
        console.log('Linked asset %s:local\n\t%s --> %s', blockInfo.metadata.name, process.cwd(), target);
    });
};