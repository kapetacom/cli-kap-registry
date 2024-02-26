/**
 * Copyright 2023 Kapeta Inc.
 * SPDX-License-Identifier: MIT
 */
import CLIHandler from "../CLIHandler";
import { Actions, InstallCommandOptions } from "@kapeta/nodejs-registry-utils";

export async function install(uris: string[], cmdObj: InstallCommandOptions) {
  const cli = CLIHandler.get(!cmdObj.nonInteractive);
  cli.start("Installing assets");

  return Actions.install(cli, uris, cmdObj);
}
