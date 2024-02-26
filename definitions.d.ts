declare module "@kapeta/kap-command" {
  import { Command } from "commander";

  export default class KapetaCommand {
    constructor(name: string, version: string);
    program(): Command;
    start(): void;
  }
}
