const CLIHandler = require('../../CLIHandler');

const {Actions} = require('@kapeta/nodejs-registry-utils');

/**
 *
 * @param {string[]} uris
 * @param {InstallCommandOptions} cmdObj
 * @returns {Promise<void>}
 */
module.exports = async function install(uris, cmdObj) {

    const cli = CLIHandler.get(!cmdObj.nonInteractive);
    cli.start('Installing assets');

    return Actions.install(cli, uris, cmdObj);
};
