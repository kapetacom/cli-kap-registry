/**
 * Copyright 2023 Kapeta Inc.
 * SPDX-License-Identifier: MIT
 */
import { Actions, CloneCommandOptions } from "@kapeta/nodejs-registry-utils";
import CLIHandler from "../CLIHandler";

export async function clone(uri: string, cmdObj: CloneCommandOptions) {
  const cli = CLIHandler.get(!cmdObj.nonInteractive);
  return Actions.clone(cli, uri, cmdObj);
}
