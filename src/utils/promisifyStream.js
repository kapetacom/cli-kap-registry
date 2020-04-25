
/**
 *
 * @param {Stream} stream
 * @param {DataHandler} [dataHandler]
 * @returns {Promise<any>}
 */
exports.promisifyStream = (stream, dataHandler) => new Promise((resolve, reject) => {
    if (dataHandler) {
        stream.on('data', (d) => {
            dataHandler(d)
        });
    }
    stream.on('end', resolve);
    stream.on('error', reject);
});


/**
 *
 * @param {ChildProcess} child
 * @param {DataHandler} [dataHandler]
 * @returns {Promise<any>}
 */
exports.promisifyChild = (child, dataHandler) => new Promise((resolve, reject) => {
    if (dataHandler) {

        child.stdout.on('data', (data) => {
            data.toString().trim().split(/\n/g).forEach((line) => {
                dataHandler({type: 'stdout', line});
            });
        });

        child.stderr.on('data', (data) => {
            data.toString().trim().split(/\n/g).forEach((line) => {
                dataHandler({type: 'stderr', line});
            });
        });
    }

    child.on('exit', (exit, signal) => {
        resolve({exit, signal});
    });

    child.on('error', reject);
});

