const YAML = require('yaml');
const Path = require("node:path");
const FS = require("node:fs");
const FSExtra = require('fs-extra');
const ClusterConfiguration = require('@blockware/local-cluster-config');
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

    const blockwareYmlFilePath = Path.join(source, 'blockware.yml');
    if (!FS.existsSync(blockwareYmlFilePath)) {
        throw new Error('Current working directory is not a valid blockware asset. Expected a blockware.yml file');
    }

    const blockInfos = YAML.parseAllDocuments(FS.readFileSync(blockwareYmlFilePath).toString())
        .map(doc => doc.toJSON());
    blockInfos.forEach(blockInfo => {
        const [handle, name] = blockInfo.metadata.name.split('/');
        const target = ClusterConfiguration.getRepositoryAssetPath(handle, name, 'local');
        makeSymLink(source, target);
        cli.info('Linked asset %s:local\n  %s --> %s', blockInfo.metadata.name, source, target);
    });

    await cli.check('Linking done', true);

};