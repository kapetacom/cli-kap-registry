const Path = require('path');
const FS = require('fs');
const FSExtra = require('fs-extra');
const Config = require('../../config');
const {parseKapetaUri} = require('../../utils/KapetaUriParser');
const RegistryService = require('../../services/RegistryService');
const VCSHandler = require('../../handlers/VCSHandler');
const CLIHandler = require('../../handlers/CLIHandler');
const Linker = require('../link');


/**
 *
 * @param {string} uri
 * @param {CloneCommandOptions} cmdObj
 * @returns {Promise<void>}
 */
module.exports = async function clone(uri, cmdObj) {
    const blockInfo = parseKapetaUri(uri);

    const registryService = new RegistryService(
        cmdObj.registry || Config.data.registry.url,
        blockInfo.handle
    );

    const cli = CLIHandler.get(!cmdObj.nonInteractive);

    const registration = await registryService.getVersion(blockInfo.name, blockInfo.version);

    if (!registration) {
        throw new Error('Registration not found: ' + uri);
    }

    if (!registration.repository ||
        !registration.repository.type) {
        throw new Error('Registration is missing version control information: ' + uri);
    }

    const handler = await VCSHandler.getVCSHandlerByType(cli, registration.repository.type);

    if (!handler) {
        throw new Error('No version control handler found for type: ' + registration.vcs.type);
    }


    const target = cmdObj.target || Path.join(process.cwd(), registration.content.metadata.name);

    cli.start(`Clone repository to ${target}`);
    await cli.progress('Preparing for repository clone', async () => {
        const targetParent = Path.resolve(target, '../');

        if (FS.existsSync(targetParent)) {
            cli.debug(`Verified parent folder exists: ${targetParent}`);
        } else {
            cli.debug(`Creating parent folder: ${targetParent}`);
            FSExtra.mkdirpSync(targetParent);
        }
    });

    const checkoutId = (blockInfo.version === 'current') ?
        registration.repository.branch :
        registration.repository.commit

    const clonedPath = await handler.clone(registration.repository.details, checkoutId, target);

    await cli.check('Asset source code was cloned', true);

    if (!cmdObj.skipLinking ||
        blockInfo.version !== 'current') {
        await cli.progress('Linking code to local repository', () => Linker(clonedPath));
    }
};
