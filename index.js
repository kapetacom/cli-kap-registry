#!/usr/bin/env node

const BlockwareCommand = require('@blockware/blockctl-command');
const packageData = require('./package');
const Config = require('./src/config');


const command = new BlockwareCommand(packageData.command, packageData.version);
const program = command.program();


function catchError(callback) {

    return async function() {
        try {
            return await callback.apply(this, arguments);
        } catch(err) {
            console.error('[ERROR] ' + err.message);
        }
    }
}


program
    .command('push [file]')
    .option('-r, --registry <url>', 'Use the registry at this url', Config.data.registry.url)
    .option('-n, --non-interactive', 'Uses non-interactive with no colors in output. Use this for running on servers')
    .option('-i, --ignore-working-directory', 'Skip check for changes in working directory')
    .option('-s, --skip-tests', 'Skip running tests')
    .option('-a, --auto-versioning [enabled]', 'Automatically increment the semantic version', true)
    .option('-c, --check-version [enabled]', 'Check that the version provided adheres to semantic versioning rules', true)
    .option('-t, --reserve-ttl <ms>', 'How long to let a version reservation live before expiring', 5000)
    .option('--dry-run', 'Only write what would happen - do not actually do anything')
    .option('-v, --verbose', 'Show additional output for debugging')
    .description('push block to registry')
    .action(catchError(require('./src/commands/push')));

program
    .command('clone <blockuri>')
    .option('-r, --registry <url>', 'Use the registry at this url', Config.data.registry.url)
    .option('-t, --target <path>', 'Clone to this path. Defaults to current working dir + organisation + name')
    .description('Clone source code of block from registry - e.g. clone "blockware://my-company/my-block"')
    .action(catchError(require('./src/commands/clone')));

program
    .command('pull-image <blockuri>')
    .option('-r, --registry <url>', 'Use the registry at this url', Config.data.registry.url)
    .description('Pull docker image for block from registry - e.g. pull "blockware://my-company/my-block"')
    .action(catchError(require('./src/commands/pull-image')));

program
    .command('view <blockuri>')
    .option('-r, --registry <url>', 'Use the registry at this url', Config.data.registry.url)
    .description('View block definition - e.g. view "blockware://my-company/my-block"')
    .action(catchError(require('./src/commands/view')));

program
    .command('set-url <registry>')
    .description('Updates default registry url')
    .action(catchError((registry) => {
        Config.data.registry.url = registry;
        Config.save();
        console.log('Default registry url set to %s', registry);
    }));

command.start();