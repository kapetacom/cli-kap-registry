const CLIHandler = require('../../CLIHandler');
const {Actions} = require('@kapeta/nodejs-registry-utils');

/**
 *
 * @param {PublishCommandOptions} cmdObj
 * @returns {Promise<void>}
 */
module.exports = async function push(cmdObj) {
    const cli = CLIHandler.get(cmdObj.interactive);
    return Actions.push(cli, process.cwd(), cmdObj);
};
