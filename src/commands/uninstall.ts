/**
 * Copyright 2023 Kapeta Inc.
 * SPDX-License-Identifier: MIT
 */
import {
  Actions,
  UninstallCommandOptions,
} from "@kapeta/nodejs-registry-utils";
import CLIHandler from "../CLIHandler";

export async function uninstall(
  uris: string[],
  cmdObj: UninstallCommandOptions
) {
  const cli = new CLIHandler(!cmdObj.nonInteractive);
  return Actions.uninstall(cli, uris);
}
