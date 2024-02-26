declare module "@kapeta/kap-command" {
    import {Command} from "commander";

    export default class KapetaCommand {
        constructor(name: string, version: string);

        program(): Command;

        start(): void;
    }
}

declare module 'blessed' {

    export function screen(options: any): widget.Screen;

    export function log(options: any): widget.Log;

    export function text(options: any): widget.Text;

    export function box(options: any): widget.Box;

    export namespace widget {
        export class Element {
            public screen: Screen;
            public type: string;

            constructor(options: any);

            append(element: any): void;
            focus(): void;

            destroy(): void;
        }

        export class Screen extends Element {
            public title: string;

            constructor(options: any);

            render(): void;

            key(name: string[], callback: () => void): void;

            screenshot(): string;
        }

        export class Log extends Element {
            constructor(options: any);
            add(text: string): void;
        }

        export class Text extends Element {
            constructor(options: any);
        }

        export class Box extends Element {
            public screen: Screen;
            public type: string;

            constructor(options: any);
        }

        export type BoxOptions = Partial<{
            parent: any;
            top: number;
            left: number;
            right: number;
            height: number;
            tags: boolean;
            content: string;
        }>

    }
}
