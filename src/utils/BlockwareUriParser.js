


exports.parseBlockwareUri = function parseBlockwareUri(uri) {

    const rx = /^(?:blockware:\/\/)?([^\/\s:]+)\/([^\s:\/]+)(?::([^\s]+))?$/i;

    if (!rx.test(uri)) {
        throw new Error('Invalid blockware uri: ' + uri);
    }

    let [,
        organizationId,
        name,
        version
    ] = rx.exec(uri);

    if (!version) {
        version = 'latest';
    }

    return {
        organizationId,
        name,
        version
    };
};