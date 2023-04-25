const {Actions} = require('@kapeta/nodejs-registry-utils');

/**
 *
 * @param {string} uri
 * @param {CommandOptions} cmdObj
 * @returns {Promise<void>}
 */
module.exports = async function view(uri, cmdObj) {
    return Actions.view(uri, cmdObj);
};
