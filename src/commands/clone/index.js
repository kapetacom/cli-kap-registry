const Path = require('path');
const mkdirp = require('mkdirp');
const FS = require('fs');
const Config = require('../../config');
const {parseBlockwareUri} = require('../../utils/BlockwareUriParser');
const RegistryService = require('../../services/RegistryService');
const VCSHandler = require('../../handlers/VCSHandler');
const CLIHandler = require('../../handlers/CLIHandler');


/**
 *
 * @param {string} uri
 * @param {CloneCommandOptions} cmdObj
 * @returns {Promise<void>}
 */
module.exports = async function clone(uri, cmdObj) {
    const blockInfo = parseBlockwareUri(uri);

    const registryService = new RegistryService(
        cmdObj.registry || Config.data.registry.url,
        blockInfo.organizationId
    );

    const registration = await registryService.getVersion(blockInfo.name, blockInfo.version);

    if (!registration) {
        throw new Error('Registration not found: ' + uri);
    }

    if (!registration.vcs ||
        !registration.vcs.type) {
        throw new Error('Registration is missing version control information: ' + uri);
    }

    const handler = await VCSHandler.getVCSHandlerByType(cli, registration.vcs.type);

    if (!handler) {
        throw new Error('No version control handler found for type: ' + registration.vcs.type);
    }

    try {


        const cli = new CLIHandler(true);

        cli.start('Clone repository');

        const target = cmdObj.target || Path.join(process.cwd(), blockInfo.organizationId, registration.block.metadata.name);
        await cli.progress('Preparing for repository clone', async () => {
            const targetParent = Path.resolve(target, '../');

            if (FS.existsSync(targetParent)) {
                cli.debug(`Verified parent folder exists: ${targetParent}`);
            } else {
                cli.debug(`Creating parent folder: ${targetParent}`);
                mkdirp.sync(targetParent);
            }
        });

        await handler.clone(registration.vcs.checkout, registration.vcs.commitId, target);
    } catch (e) {
        cli.error(e.message);
    } finally {
        cli.end();
    }

};