/**
 * Copyright 2023 Kapeta Inc.
 * SPDX-License-Identifier: MIT
 */

const CLIHandler = require('../../CLIHandler');
const {Actions} = require('@kapeta/nodejs-registry-utils');

/**
 *
 * @param {string[]} uris
 * @param {UninstallCommandOptions} cmdObj
 * @returns {Promise<void>}
 */
module.exports = async function uninstall(uris, cmdObj) {
    const cli = new CLIHandler(cmdObj.interactive);
    return Actions.uninstall(cli, uris);

};
