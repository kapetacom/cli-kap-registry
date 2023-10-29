/**
 * Copyright 2023 Kapeta Inc.
 * SPDX-License-Identifier: MIT
 */

const CLIHandler = require('../../CLIHandler');
const {Actions} = require('@kapeta/nodejs-registry-utils');


/**
 *
 * @param {string} [source=process.cwd()]
 * @returns {Promise<void>}
 */
module.exports = async function link(source) {
    const cli = CLIHandler.get(false);
    return Actions.link(cli, source);
};
