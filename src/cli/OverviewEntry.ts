/**
 * Copyright 2023 Kapeta Inc.
 * SPDX-License-Identifier: MIT
 */
import * as blessed from "blessed";
import Symbols from "./symbols";

class OverviewEntry extends blessed.widget.Box {
  private _timer: NodeJS.Timeout | null;
  private _text: any;
  private _icon: any;

  constructor(options: blessed.widget.BoxOptions) {
    super(options);

    this._timer = null;

    this.type = "overview-entry";

    this._text = new blessed.widget.Text({
      parent: this,
      top: 0,
      left: 0,
      right: 3,
      height: 1,
      tags: true,
      content: "",
    });

    this._icon = new blessed.widget.Text({
      parent: this,
      top: 0,
      width: 1,
      right: 0,
      height: 1,
      content: "|",
      bold: "bold",
      tags: true,
      fg: "blue",
    });
  }

  value(text: string): void {
    this._text.setContent(text);
    this._icon.hide();
  }

  start(text: string): void {
    this._text.setContent(text);

    this._timer = setInterval(() => {
      if (this._icon.content === "|") {
        this._icon.setContent("/");
      } else if (this._icon.content === "/") {
        this._icon.setContent("-");
      } else if (this._icon.content === "-") {
        this._icon.setContent("\\");
      } else if (this._icon.content === "\\") {
        this._icon.setContent("|");
      }
      this.screen.render();
    }, 200);
  }

  end(ok: boolean): void {
    this._timer && clearInterval(this._timer);

    this._icon.setContent(
      ok ? `{green-fg}${Symbols.success}{/}` : `{red-fg}${Symbols.error}{/}`
    );

    this.screen.render();
  }
}

export default OverviewEntry;
