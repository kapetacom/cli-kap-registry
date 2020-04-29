const GitHandler = require('./vcs-handlers/GitHandler');

const VCS_HANDLERS = [
    GitHandler
];

/**
 * Get version control handler for directory
 * @param {CLIHandler} cli
 * @param {string} directory
 * @returns {VCSHandler|null}
 */
exports.getVCSHandler = async (cli, directory) => {
    for(let i = 0 ; i < VCS_HANDLERS.length; i++) {
        const handler = VCS_HANDLERS[i];
        if (await handler.isRepo(directory)) {
            return new handler(cli);
        }
    }

    return null;
};

/**
 * Get version control handler for type
 * @param {CLIHandler} cli
 * @param {string} type
 * @returns {VCSHandler|null}
 */
exports.getVCSHandlerByType = async (cli, type) => {
    for(let i = 0 ; i < VCS_HANDLERS.length; i++) {
        const handler = VCS_HANDLERS[i];
        if (await handler.getType().toLowerCase() === type.toLowerCase()) {
            return new handler(cli);
        }
    }

    return null;
};