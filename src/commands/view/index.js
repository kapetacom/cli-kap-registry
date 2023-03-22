const YAML = require('yaml');
const Config = require('../../config');
const {parseKapetaUri} = require('../../utils/KapetaUriParser');
const RegistryService = require('../../services/RegistryService');

/**
 *
 * @param {string} uri
 * @param {CommandOptions} cmdObj
 * @returns {Promise<void>}
 */
module.exports = async function view(uri, cmdObj) {
    const blockInfo = parseKapetaUri(uri);

    const registryService = new RegistryService(
        cmdObj.registry || Config.data.registry.url,
        blockInfo.handle
    );

    const registration = await registryService.getVersion(blockInfo.name, blockInfo.version);

    if (!registration) {
        throw new Error('Registration not found: ' + uri);
    }

    console.log(YAML.stringify(registration));
};
