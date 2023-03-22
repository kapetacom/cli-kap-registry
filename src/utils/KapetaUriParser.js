
exports.parseKapetaUri = function parseKapetaUri(uri) {

    const rx = /^(?:kapeta:\/\/)?([^\/\s:]+)\/([^\s:\/]+)(?::([^\s]+))?$/i;

    if (!rx.test(uri)) {
        throw new Error('Invalid kapeta uri: ' + uri);
    }

    let [,
        handle,
        name,
        version
    ] = rx.exec(uri);

    if (!version) {
        version = 'current';
    }

    return {
        handle,
        name,
        version
    };
};
