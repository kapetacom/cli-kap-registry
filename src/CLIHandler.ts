/**
 * Copyright 2023 Kapeta Inc.
 * SPDX-License-Identifier: MIT
 */
import * as Util from "util";
import * as _ from "lodash";
import blessed from "blessed";
import OverviewEntry from "./cli/OverviewEntry";
import { spawn } from "@kapeta/nodejs-process";
import Symbols from "./cli/symbols";
import {
  PromiseOrCallback,
  ProgressListener,
} from "@kapeta/nodejs-registry-utils";

function checkMark(ok: boolean): string {
  return ok ? Symbols.success : Symbols.error;
}

let singleton: CLIHandler;

class CLIHandler implements ProgressListener {
  private readonly interactive: boolean;
  private nestingLevel: number;
  private _entries: number;
  private _sections: number;
  private _screen?: blessed.widget.Screen;
  private _overview?: blessed.widget.Box;
  private _details?: blessed.widget.Log;

  static get(interactive: boolean): CLIHandler {
    if (!singleton) {
      singleton = new CLIHandler(interactive);
    }
    return singleton;
  }

  constructor(interactive: boolean) {
    this.nestingLevel = 0;
    this.interactive = !!interactive;
    this._entries = 0;
    this._sections = 0;
  }

  async run(
    command: string,
    directory: string
  ): Promise<{ exit: number; signal: any; output: string }> {
    this.info(`Running command "${command}"`);

    return new Promise(async (resolve, reject) => {
      try {
        const child = spawn(command, [], {
          cwd: directory ? directory : process.cwd(),
          shell: true,
          stdio: ["pipe", "pipe", "pipe"],
        });

        child.onData((data: any) => {
          this.debug(data.line);
        });

        const chunks: any[] = [];
        child.process.stdout?.on("data", (data: any) => {
          chunks.push(data);
        });

        child.process.on("exit", (exit: number, signal: any) => {
          if (exit !== 0) {
            reject(
              new Error(`Command "${command}" failed with exit code ${exit}`)
            );
            return;
          }
          resolve({ exit, signal, output: Buffer.concat(chunks).toString() });
        });

        await child.wait();
      } catch (e) {
        reject(e);
      }
    });
  }

  start(title: string): void {
    if (this._screen) {
      return;
    }

    if (!this.interactive) {
      this.info(" !! Non interactive mode enabled !!\n");
      return;
    }

    this._screen = blessed.screen({
      smartCSR: true,
    });

    this._screen.title = title;

    this._screen.key(["q", "C-c"], () => {
      process.exit();
    });

    this._overview = blessed.box({
      top: 0,
      left: 0,
      width: "30%",
      bottom: 0,
      content: "",
      tags: true,
      border: {
        type: "line",
      },
      style: {
        fg: "white",
        bg: "magenta",
        border: {
          fg: "#f0f0f0",
        },
        hover: {
          bg: "green",
        },
      },
    });

    this._screen.append(this._overview);

    this._details = blessed.log({
      top: 0,
      left: "30%",
      right: 0,
      bottom: 0,
      tags: true,
      border: {
        type: "line",
      },
      keys: true,
      mouse: true,
      alwaysScroll: true,
      scrollable: true,
      scrollbar: {
        style: {
          bg: "blue",
        },
      },
      style: {
        focus: {
          border: {
            fg: "blue",
          },
        },
      },
    });

    this._screen.append(this._details);

    this._details.focus();
  }

  end(): void {
    if (!this._screen) {
      return;
    }

    this._screen.render();

    const snapshot = this._screen.screenshot();
    this._screen.destroy();
    process.stdout.write(snapshot);
  }

  async progress(message: string, promise: PromiseOrCallback): Promise<any> {
    let out;

    if (this.interactive) {
      const entry = new OverviewEntry({
        top: this._entries++,
      });
      this._overview?.append(entry);
      try {
        entry.start(this._getPrefix() + message);

        if (this.nestingLevel > 0) {
          this.info(this._getPrefix() + message);
        } else {
          this.section(message);
        }

        this.nestingLevel++;

        if (typeof promise === "function") {
          out = await promise();
        } else {
          out = await promise;
        }
        entry.end(true);
        return out;
      } catch (e) {
        entry.end(false);
        throw e;
      } finally {
        this.nestingLevel--;
      }
      return;
    }

    try {
      this.info(message + " - START");
      this.nestingLevel++;

      if (promise instanceof Function) {
        out = await promise();
      } else {
        out = await promise;
      }
      this.nestingLevel--;
      this.info(message + " - OK");
      return out;
    } catch (e) {
      this.nestingLevel--;
      this.info(message + " - FAILED");
      throw e;
    }
  }

  async check(
    message: string,
    ok: PromiseOrCallback | boolean
  ): Promise<boolean> {
    const okType = typeof ok;

    if (this.interactive) {
      const entry = new OverviewEntry({
        top: this._entries++,
      });

      entry.start(this._getPrefix() + message);

      if (ok instanceof Function) {
        ok = await ok();
      }

      if (ok instanceof Promise) {
        ok = await ok;
      }

      entry.end(ok as boolean);
      if (ok) {
        this.info(this._getPrefix() + message + " - OK");
      } else {
        this.warn(this._getPrefix() + message + " - FAILED");
      }

      this._overview?.append(entry);
      return ok;
    }

    if (ok instanceof Function) {
      ok = await ok();
    }

    if (ok instanceof Promise) {
      ok = await ok;
    }

    this._log("INFO", ["%s: %s", message, checkMark(ok as boolean)]);

    return ok;
  }

  showValue(message: string, value: string): void {
    if (this.interactive) {
      const entry = new OverviewEntry({
        top: this._entries++,
      });

      entry.start(this._getPrefix() + message + ": {bold}" + value + "{/}");
      entry.end(true);

      this._overview?.append(entry);
      return;
    }

    this._log("INFO", ["%s: %s", message, value]);
  }

  info(message: string): void {
    this._log("INFO", Array.from(arguments));
  }

  warn(message: string): void {
    this._log("WARN", Array.from(arguments));
  }

  debug(message: string): void {
    this._log("DEBUG", Array.from(arguments));
  }

  error(message: string): void {
    this._log("ERROR", Array.from(arguments));
  }

  section(title: string): void {
    this.info("\n");
    this.info("------------------------------------------");
    this.info(" " + ++this._sections + ". " + title);
    this.info("------------------------------------------");
    this.info("\n");
  }

  _log(level: string, parentArguments: any[]): void {
    const args = _.toArray(parentArguments);
    const message = args.shift();

    let prefix = "";
    let postfix = "";
    if (this.interactive) {
      postfix = "{/}";
      switch (level) {
        case "WARN":
          prefix = "{yellow-fg}";
          break;
        case "ERROR":
          prefix = "{red-fg}";
          break;
        case "INFO":
          break;
        case "DEBUG":
          prefix = "{blue-fg}";
          break;
      }
    } else {
      prefix = this._getPrefix();
    }

    this._println(prefix + Util.format(message, ...args) + postfix);
  }

  _println(text: string): void {
    if (this.interactive) {
      this._details?.add(text);
    } else {
      process.stdout.write(text + "\n");
    }
  }

  _getPrefix(): string {
    let prefix = "";
    for (let i = 0; i < this.nestingLevel; i++) {
      if (this.interactive) {
        prefix += " ‣ ";
      } else {
        prefix += " - ";
      }
    }

    return prefix;
  }
}

export default CLIHandler;
