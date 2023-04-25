const CLIHandler = require('../../CLIHandler');
const {Actions} = require('@kapeta/nodejs-registry-utils');

/**
 *
 * @param {string[]} uris
 * @param {UninstallCommandOptions} cmdObj
 * @returns {Promise<void>}
 */
module.exports = async function uninstall(uris, cmdObj) {
    const cli = new CLIHandler(!cmdObj.nonInteractive);
    return Actions.uninstall(cli, uris);

};
