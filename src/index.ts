#!/usr/bin/env node
/**
 * Copyright 2023 Kapeta Inc.
 * SPDX-License-Identifier: MIT
 */

import KapetaCommand from "@kapeta/kap-command";
import { Config } from "@kapeta/nodejs-registry-utils";
import ClusterConfiguration from "@kapeta/local-cluster-config";
import { clone } from "./commands/clone";
import { install } from "./commands/install";
import { link } from "./commands/link";
import { publish } from "./commands/publish";
import { uninstall } from "./commands/uninstall";
import { validate } from "./commands/validate";
import { view } from "./commands/view";
import packageData from "../package.json";

function catchError(callback: Function) {
  return async function (this: any, cmd: any) {
    try {
      return await callback.apply(this, arguments);
    } catch (err: any) {
      console.error("[ERROR] " + err.message);
      if (cmd?.verbose) {
        console.error("[TRACE] " + err.stack);
      }
      process.exitCode = -1;
    }
  };
}

const command = new KapetaCommand(packageData.command, packageData.version);
const program = command.program();

program
  .command("publish")
  .alias("push")
  .option(
    "-r, --registry <url>",
    "Use the registry at this url",
    Config.data.registry.url
  )
  .option(
    "-i, --interactive",
    "Uses non-interactive with no colors in output. Use this for running on servers"
  )
  .option(
    "-i, --ignore-working-directory",
    "Skip check for changes in working directory"
  )
  .option("-s, --skip-tests", "Skip running tests")
  .option("-v, --verbose", "Show additional output for debugging")
  .option("--skip-install", "Do not install artifacts locally after pushing")
  .option(
    "--skip-linking",
    "Do not link current working directory to local repository"
  )
  .option("--dry-run", "Do not actually do anything - just perform checks")
  .description(
    "Push asset defined by kapeta.yml in current working directory to registry."
  )
  .action(catchError(publish));

program
  .command("clone <blockuri>")
  .option(
    "-r, --registry <url>",
    "Use the registry at this url",
    Config.data.registry.url
  )
  .option(
    "-t, --target <path>",
    "Clone to this path. Defaults to current working dir + organisation + name"
  )
  .option(
    "-i, --interactive",
    "Uses non-interactive with no colors in output. Use this for running on servers"
  )
  .option("--skip-linking", "Do not link cloned repository to local repository")
  .description(
    'Clone source code of asset from registry - e.g. clone "my-company/my-block"'
  )
  .action(catchError(clone));

program
  .command("list")
  .alias("ls")
  .option("-f, --filter [kinds...]", "Filter list by kind")
  .description("List all installed assets")
  .action((args: any) => {
    console.log("\n# Installed assets");
    const providers = ClusterConfiguration.getDefinitions(args.filter);
    providers.forEach((asset: any) => {
      console.log(
        "\n* %s[%s:%s]\n  from %s",
        asset.definition.kind,
        asset.definition.metadata.name,
        asset.version,
        asset.path
      );
    });
    console.log("");
    process.exit(0);
  });

program
  .command("link [source]")
  .description(
    'Links source directory as an asset with "local" version in local repository. Defaults to current working directory.'
  )
  .alias("ln")
  .action(catchError(link));

program
  .command("validate [source]")
  .description("Validates kapeta YML file against schema and outputs issues.")
  .action(catchError(validate));

program
  .command("install [blockuri...]")
  .alias("i")
  .option(
    "-r, --registry <url>",
    "Use the registry at this url",
    Config.data.registry.url
  )
  .option(
    "-i, --interactive",
    "Uses non-interactive with no colors in output. Use this for running on servers"
  )
  .option("--skip-dependencies", "Do not install dependencies")
  .option("-v, --verbose", "Show additional output for debugging")
  .description(
    'Install artifact for asset from registry into local repository - e.g. install "my-company/my-block". Omit version to install latest'
  )
  .action(catchError(install));

program
  .command("uninstall [blockuri...]")
  .alias("rm")
  .option(
    "-i, --interactive",
    "Uses non-interactive with no colors in output. Use this for running on servers"
  )
  .option("-v, --verbose", "Show additional output for debugging")
  .description(
    'Removes asset from local repository - e.g. uninstall "my-company/my-block:1.0.0"'
  )
  .action(catchError(uninstall));

program
  .command("view <blockuri>")
  .option(
    "-r, --registry <url>",
    "Use the registry at this url",
    Config.data.registry.url
  )
  .option("-v, --verbose", "Show additional output for debugging")
  .description('View block definition - e.g. view "my-company/my-block"')
  .action(catchError(view));

program
  .command("set-url <host>")
  .description("Updates default registry host")
  .action(
    catchError((host: string) => {
      Config.data.registry.url = host;
      Config.save();
      console.log("Default registry url set to %s", host);
    })
  );

program
  .command("set-host <type> <host>")
  .description("Updates default artifact host")
  .action(
    catchError((type: string, host: string) => {
      if (["npm", "docker", "maven"].indexOf(type) === -1) {
        console.error("Invalid type. Must be one of: npm,docker or maven");
        return;
      }

      Config.data.registry[type] = host;
      Config.save();
      console.log("Default host for %s set to %s", type, host);
    })
  );

program
  .command("upgrade")
  .description("Installs latest version of all existing providers")
  .option("-v, --verbose", "Show additional output for debugging")
  .option(
    "-i, --interactive",
    "Uses non-interactive with no colors in output. Use this for running on servers"
  )
  .action(
    catchError(async (cmdObj: any) => {
      const providers = ClusterConfiguration.getProviderDefinitions().map(
        (asset: any) => {
          return asset.definition.metadata.name;
        }
      );

      console.log("## Upgrading all providers");

      try {
        await install(providers, cmdObj);
      } catch (err: any) {
        if (err.message.indexOf("Authentication not found") > -1) {
          throw new Error(
            'Upgrading requires you are logged in. Use "kap login" to authenticate first.'
          );
        }
        throw err;
      }
    })
  );

command.start();
