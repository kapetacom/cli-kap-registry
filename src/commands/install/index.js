/**
 * Copyright 2023 Kapeta Inc.
 * SPDX-License-Identifier: MIT
 */

const CLIHandler = require('../../CLIHandler');

const {Actions} = require('@kapeta/nodejs-registry-utils');

/**
 *
 * @param {string[]} uris
 * @param {InstallCommandOptions} cmdObj
 * @returns {Promise<void>}
 */
module.exports = async function install(uris, cmdObj) {

    const cli = CLIHandler.get(cmdObj.interactive);
    cli.start('Installing assets');

    return Actions.install(cli, uris, cmdObj);
};
