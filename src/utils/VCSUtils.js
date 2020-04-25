const GitHandler = require('./vcs-handlers/GitHandler');

const VCS_HANDLERS = [
    new GitHandler()
];

/**
 * Get version control handler for directory
 * @param {string} directory
 * @returns {VCSHandler|null}
 */
exports.getVCSHandler = async (directory) => {
    for(let i = 0 ; i < VCS_HANDLERS.length; i++) {
        const handler = VCS_HANDLERS[i];
        if (await handler.isRepo(directory)) {
            return handler;
        }
    }

    return null;
};