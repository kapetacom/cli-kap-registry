/**
 * Copyright 2023 Kapeta Inc.
 * SPDX-License-Identifier: MIT
 */

const {Actions} = require('@kapeta/nodejs-registry-utils');
const CLIHandler = require('../../CLIHandler');



/**
 *
 * @param {string} uri
 * @param {CloneCommandOptions} cmdObj
 * @returns {Promise<void>}
 */
module.exports = async function clone(uri, cmdObj) {
    const cli = CLIHandler.get(cmdObj.interactive);
    return Actions.clone(cli, uri, cmdObj);
};
