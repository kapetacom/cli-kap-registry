const CLIHandler = require('../../CLIHandler');
const {Actions} = require('@kapeta/nodejs-registry-utils');

/**
 *
 * @param {PushCommandOptions} cmdObj
 * @returns {Promise<void>}
 */
module.exports = async function push(cmdObj) {
    const cli = CLIHandler.get(!cmdObj.nonInteractive);
    return Actions.push(cli, process.cwd(), cmdObj);
};
