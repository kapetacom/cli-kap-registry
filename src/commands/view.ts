/**
 * Copyright 2023 Kapeta Inc.
 * SPDX-License-Identifier: MIT
 */
import { Actions, CommandOptions } from "@kapeta/nodejs-registry-utils";

export async function view(uri: string, cmdObj: CommandOptions) {
  return Actions.view(uri, cmdObj);
}
