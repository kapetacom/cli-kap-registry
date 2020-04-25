const _ = require('lodash');

let PROGRESS_DEPTH = 0;

function getPrefix() {
    let prefix = '';
    for(let i = 0 ; i < PROGRESS_DEPTH; i++) {
        prefix += ' - ';
    }

    return prefix;
}

function _log(level, parentArguments) {
    let prefix = getPrefix();

    const args = _.toArray(parentArguments);
    const message = args.shift();

    console.log(prefix + message, ...args);
}

/**
 *
 * @param message
 * @param {PromiseOrCallback} promise
 * @returns {Promise<*>}
 */
exports.progress = async function(message, promise) {

    let out;
    let prefix = getPrefix();

    try {
        PROGRESS_DEPTH++;
        console.log('%s%s', prefix, message);
        if (promise instanceof Function) {
            out = await promise();
        } else {
            out = await promise;
        }
        console.log('%s OK', prefix);
        return out;
    } catch(e) {
        console.log('%s FAILED', prefix);
        throw e;
    } finally {
        PROGRESS_DEPTH--;
    }

};

/**
 *
 * @param {string} message
 * @param {PromiseOrCallback|boolean} ok
 * @returns {boolean}
 */
exports.check = async function(message, ok) {

    const okType = typeof ok;
    if (okType === 'function') {
        ok = await ok();
    }

    if (ok instanceof Promise) {
        ok = await ok;
    }

    _log('WARN', [
        '%s: %s',
        message,
        ok ? '✓' : '✖'
    ]);

    return ok;
};

exports.info = function(message) {

    _log('INFO', arguments);

};

exports.warn = function(message) {

    _log('WARN', arguments);

};

exports.debug = function(message) {

    _log('DEBUG', arguments);

};

exports.error = function() {

    _log('ERROR', arguments);

};