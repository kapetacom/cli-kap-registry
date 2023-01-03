#!/usr/bin/env node
const BlockwareCommand = require('@blockware/blockctl-command');
const packageData = require('./package');
const Config = require('./src/config');
const ClusterConfiguration = require('@blockware/local-cluster-config');
const command = new BlockwareCommand(packageData.command, packageData.version);
const program = command.program();

function catchError(callback) {

    return async function() {
        try {
            return await callback.apply(this, arguments);
        } catch(err) {
            console.error('[ERROR] ' + err.message);
            process.exit(-1);
        }
    }
}


program
    .command('push [file]')
    .option('-r, --registry <url>', 'Use the registry at this url', Config.data.registry.url)
    .option('-n, --non-interactive', 'Uses non-interactive with no colors in output. Use this for running on servers')
    .option('-i, --ignore-working-directory', 'Skip check for changes in working directory')
    .option('-s, --skip-tests', 'Skip running tests')
    .option('-v, --verbose', 'Show additional output for debugging')
    .description('push block to registry')
    .action(catchError(require('./src/commands/push')));

program
    .command('clone <blockuri>')
    .option('-r, --registry <url>', 'Use the registry at this url', Config.data.registry.url)
    .option('-t, --target <path>', 'Clone to this path. Defaults to current working dir + organisation + name')
    .option('-n, --non-interactive', 'Uses non-interactive with no colors in output. Use this for running on servers')
    .description('Clone source code of asset from registry - e.g. clone "my-company/my-block"')
    .action(catchError(require('./src/commands/clone')));

program
    .command('pull <blockuri>')
    .option('-r, --registry <url>', 'Use the registry at this url', Config.data.registry.url)
    .option('-t, --target <path>', 'Pull to this path- Defaults to current working dir')
    .option('-n, --non-interactive', 'Uses non-interactive with no colors in output. Use this for running on servers')
    .description('Pull artifact for asset from registry - e.g. pull "my-company/my-block"')
    .action(catchError(require('./src/commands/pull')));

program
    .command('list')
    .alias('ls')
    .option('-f, --filter [kinds...]', 'Filter list by kind')
    .description('List all installed assets')
    .action((args) => {
        console.log('\n# Installed assets');
        const providers = ClusterConfiguration.getDefinitions(args.filter);
        providers.forEach((asset) => {
            console.log( '\n* %s[%s:%s]\n  from %s', asset.definition.kind, asset.definition.metadata.name, asset.version, asset.path);
        });
        console.log('');
        process.exit(0);
    });

program
    .command('link')
    .description('Links current working directory as an asset with "local" version in local repository.')
    .alias('ln')
    .action(catchError(require('./src/commands/link')));

program
    .command('install <blockuri>')
    .alias('i')
    .option('-r, --registry <url>', 'Use the registry at this url', Config.data.registry.url)
    .option('-n, --non-interactive', 'Uses non-interactive with no colors in output. Use this for running on servers')
    .description('Install artifact for asset from registry into local repository - e.g. install "my-company/my-block"')
    .action(catchError(require('./src/commands/install')));

program
    .command('uninstall <blockuri>')
    .alias('rm')
    .option('-n, --non-interactive', 'Uses non-interactive with no colors in output. Use this for running on servers')
    .description('Removes asset from local repository - e.g. uninstall "my-company/my-block:1.0.0"')
    .action(catchError(require('./src/commands/uninstall')));

program
    .command('view <blockuri>')
    .option('-r, --registry <url>', 'Use the registry at this url', Config.data.registry.url)
    .description('View block definition - e.g. view "my-company/my-block"')
    .action(catchError(require('./src/commands/view')));

program
    .command('set-url <host>')
    .description('Updates default registry host')
    .action(catchError((host) => {
        Config.data.registry.url = host;
        Config.save();
        console.log('Default registry url set to %s', host);
    }));

program
    .command('set-host <type> <host>')
    .description('Updates default artifact host')
    .action(catchError((type, host) => {
        if (['npm','docker','maven'].indexOf(type) === -1) {
            console.error('Invalid type. Must be one of: npm,docker or maven');
            return;
        }

        Config.data.registry[type] = host;
        Config.save();
        console.log('Default host for %s set to %s', type, host);
    }));

command.start();