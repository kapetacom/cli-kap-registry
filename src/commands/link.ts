/**
 * Copyright 2023 Kapeta Inc.
 * SPDX-License-Identifier: MIT
 */

import CLIHandler from "../CLIHandler";
import { Actions } from "@kapeta/nodejs-registry-utils";

export async function link(source: string = process.cwd()) {
  const cli = CLIHandler.get(false);
  return Actions.link(cli, source);
}
