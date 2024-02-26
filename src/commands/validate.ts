/**
 * Copyright 2023 Kapeta Inc.
 * SPDX-License-Identifier: MIT
 */

import ClusterConfiguration from "@kapeta/local-cluster-config";
import { parseKapetaUri } from "@kapeta/nodejs-utils";
import YAML from "yaml";
import { validateSchema } from "@kapeta/schemas";
import CLIHandler from "../CLIHandler";
import FS from "fs";

export async function validate(source: string = process.cwd()) {
  const cli = CLIHandler.get(false);
  if (!source) {
    source = process.cwd() + "/kapeta.yml";
  }

  const stat = FS.statSync(source);

  if (stat.isDirectory()) {
    cli.error(`${source} points to directory`);
    process.exit(1);
  }

  if (!stat.isFile()) {
    cli.error(`File ${source} does not exist`);
    process.exit(1);
  }
  const content = FS.readFileSync(source, "utf8").toString();

  let sourceObject = null;
  try {
    sourceObject = YAML.parse(content);
  } catch (err: any) {
    cli.error(`Error parsing ${source}: ${err.message}`);
    process.exit(1);
  }

  let errors = [];
  if (sourceObject.kind.startsWith("core/")) {
    errors = validateSchema(sourceObject.kind, sourceObject);
  } else {
    errors = validateSchema("core/kind", sourceObject);
    if (errors.length === 0) {
      const kindUri = parseKapetaUri(sourceObject.kind);
      const provider = ClusterConfiguration.getProviderDefinitions().find(
        (provider) => {
          if (
            provider.definition.metadata.name === kindUri.fullName &&
            provider.version === kindUri.version
          ) {
            return true;
          }
          return false;
        }
      );
      if (!provider) {
        cli.error(`Could not find provider for ${sourceObject.kind}`);
        process.exit(1);
      }
      if (provider.definition?.spec?.schema) {
        errors = validateSchema(
          provider.definition.spec.schema,
          sourceObject.spec
        );
      }
    }
  }

  if (errors.length > 0) {
    cli.error(
      `File contained errors:\n  - ${errors
        .map((error) => {
          const path = "<root>" + error.instancePath;
          return `At path "${path}": ${error.message}`;
        })
        .join("\n  - ")}`
    );
    process.exit(1);
  } else {
    cli.info(`File was valid`);
  }
}
