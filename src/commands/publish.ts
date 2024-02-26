/**
 * Copyright 2023 Kapeta Inc.
 * SPDX-License-Identifier: MIT
 */
import { Actions, PushCommandOptions } from "@kapeta/nodejs-registry-utils";
import CLIHandler from "../CLIHandler";

export async function publish(cmdObj: PushCommandOptions) {
  const cli = CLIHandler.get(cmdObj.interactive);
  return Actions.push(cli, process.cwd(), cmdObj);
}
