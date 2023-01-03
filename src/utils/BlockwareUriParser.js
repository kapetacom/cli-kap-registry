


exports.parseBlockwareUri = function parseBlockwareUri(uri) {

    const rx = /^(?:blockware:\/\/)?([^\/\s:]+)\/([^\s:\/]+)(?::([^\s]+))?$/i;

    if (!rx.test(uri)) {
        throw new Error('Invalid blockware uri: ' + uri);
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