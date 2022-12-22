
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
 * @returns {Promise<{exit:number, signal:number, output:string}>}
 */
exports.promisifyChild = (child, dataHandler) => new Promise((resolve, reject) => {
    const chunks = [];
    child.stdout.on('data', (data) => {
        chunks.push(data);
        data.toString().trim().split(/\n/g).forEach((line) => {
            dataHandler && dataHandler({type: 'stdout', line});
        });
    });

    child.stderr.on('data', (data) => {
        data.toString().trim().split(/\n/g).forEach((line) => {
            dataHandler && dataHandler({type: 'stderr', line});
        });
    });

    child.on('exit', (exit, signal) => {
        resolve({exit, signal, output: Buffer.concat(chunks).toString()});
    });

    child.on('error', reject);
});

