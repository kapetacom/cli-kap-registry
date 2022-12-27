const DockerHandler = require('./artifact-handlers/DockerHandler');
const NPMHandler = require('./artifact-handlers/NPMHandler');
const MavenHandler = require('./artifact-handlers/MavenHandler');
const YAMLHandler = require('./artifact-handlers/YAMLHandler');

/**
 *
 * @type {ArtifactHandlerFactory[]}
 */
const ARTIFACT_HANDLERS = [
    DockerHandler,
    NPMHandler,
    MavenHandler,
    YAMLHandler
];

/**
 * Get artifact repository handler for directory
 * @param {CLIHandler} cli
 * @param {string} directory
 * @returns {ArtifactHandler|null}
 */
exports.getArtifactHandler = async (cli, directory) => {
    for(let i = 0 ; i < ARTIFACT_HANDLERS.length; i++) {
        const handler = ARTIFACT_HANDLERS[i];
        if (await handler.isSupported(directory)) {
            return handler.create(cli, directory);
        }
    }

    return null;
};


/**
 * Get artifact repository handler for type
 * @param {CLIHandler} cli
 * @param {string} type
 * @returns {ArtifactHandler|null}
 */
exports.getArtifactHandlerByType = (cli, type) => {
    for(let i = 0 ; i < ARTIFACT_HANDLERS.length; i++) {
        const handler = ARTIFACT_HANDLERS[i];
        if (handler.getType().toLowerCase() === type.toLowerCase()) {
            return handler.create(cli, process.cwd());
        }
    }

    return null;
};