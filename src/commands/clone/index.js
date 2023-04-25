const {Actions} = require('@kapeta/nodejs-registry-utils');
const CLIHandler = require('../../CLIHandler');



/**
 *
 * @param {string} uri
 * @param {CloneCommandOptions} cmdObj
 * @returns {Promise<void>}
 */
module.exports = async function clone(uri, cmdObj) {
    const cli = CLIHandler.get(!cmdObj.nonInteractive);
    return Actions.clone(cli, uri, cmdObj);
};
