import { Disposable, Position, Uri } from "vscode";
import { ALParserNinja } from "@vjeko.com/al-parser-ninja";
import { LogLevel, output } from "./Output";
import { CheckType } from "@vjeko.com/al-parser-ninja/dist/CheckType";
import { ALRange } from "../lib/types/ALRange";
import { existsSync, readFileSync } from "fs";
import { ALObjectNamespace } from "../lib/types/ALObjectNamespace";
import { findNamespaceAndIdInDependencyPackages } from "../lib/functions/findNamespaceAndIdInDependencyPackages";
import { TempParserFix } from "../lib/types/TempParserFix";

export interface NextIdContext {
    injectSemicolon: boolean;
    requireId?: number;
    additional?: {
        ordinal: number;
        range: ALRange;
    };
}

export class ParserConnector implements Disposable {
    private _initialized: boolean = false;
    private _initialization: Promise<void>;

    private get initialization(): Promise<void> {
        if (!this._initialized) {
            output.log("[AL Parser] Waiting for parser initialization to complete", LogLevel.Verbose);
        }
        return this._initialization;
    }

    public async parse(uris: Uri[], tempParserFix: TempParserFix): Promise<ALObjectNamespace[]> {
        output.log(`[AL Parser] Parsing ${uris.length} file(s)`);
        await this.initialization;
        const files = uris.map(uri => uri.fsPath)
            .filter(fsPath => existsSync(fsPath)); // During auto-sync the uris are partially gone already due to the heavy branch switching
        const objects = await ALParserNinja.parse(files) as any as ALObjectNamespace[];
        objects
            .filter(o => o.error)
            .forEach(o =>
                output.log(`[AL Parser] Error parsing ${o.name} (${o.path}): ${(o as any).error}`, LogLevel.Info)
            );

        if (tempParserFix.shouldFixFullyQualifiedName) {
            for (const object of objects.filter(o => o.extends !== undefined)) {
                const result = await this.getExtendInfos(object.type, object.path, undefined, tempParserFix.updateDependencyCache);
                if (result) {
                    ({ extends: object.extends, extendsNamespace: object.extendsNamespace, extendsId: object.extendsId } = result);
                }
            }
        }

        return objects;
    }

    public async getExtendInfos(extensionType: string, path: string, lines: string[] = readFileSync(path, 'utf8').split('\n'), updateDependencyCache: boolean = true): Promise<{ extends: string; extendsNamespace: string, extendsId: number } | undefined> {
        if (!["tableextension", "enumextension"].includes(extensionType.toLowerCase())) {
            return undefined;
        }
        const regex = new RegExp(`${extensionType} \\d+ ("[^"]+"|\\w+) extends (?:(?<namespace>(?:[^".\\n]+\\.)*[^".\\n]+)\\.)?(?<objectname>"[^"]+"|\\w+)`, 'i');
        for (let lineNo = 0; lineNo < lines.length; lineNo++) {
            const match = lines[lineNo].match(regex);
            if (match && match.index !== undefined && match.groups?.objectname) {
                let namespaceAndId = await findNamespaceAndIdInDependencyPackages(Uri.file(path), lineNo, extensionType, match.groups!.objectname, updateDependencyCache);
                if (namespaceAndId) {
                    return { extends: match.groups?.objectname, extendsNamespace: namespaceAndId.namespace, extendsId: namespaceAndId.id };
                }
            }
        }
    }

    public async checkField(
        code: string,
        position: Position,
        symbols: string[],
        context: NextIdContext
    ): Promise<boolean> {
        output.log("[AL Parser] Checking if field ID is expected at current position");
        await this.initialization;
        const { line, character } = position;
        const response = await ALParserNinja.check(CheckType.field, code, { line, character }, symbols);
        if (!response.valid) {
            return false;
        }
        context.injectSemicolon = !response.semiColon;
        return true;
    }

    public async checkValue(
        code: string,
        position: Position,
        symbols: string[],
        context: NextIdContext
    ): Promise<boolean> {
        output.log("[AL Parser] Checking if enum value ID is expected at current position");
        await this.initialization;
        const { line, character } = position;
        const response = await ALParserNinja.check(CheckType.value, code, { line, character }, symbols);
        if (!response.valid) {
            return false;
        }
        context.injectSemicolon = !response.semiColon;
        return true;
    }

    //#region Singleton
    private static _instance: ParserConnector;

    private constructor() {
        output.log("[AL Parser] Initializing parser...", LogLevel.Verbose);
        this._initialization = ALParserNinja.initialize();
        ALParserNinja.on("error", (e: Error) => output.log(`[AL Parser] Parser error ${e.message}`, LogLevel.Info));
        this._initialization.then(() => {
            output.log("[AL Parser] Parser is now initialized.", LogLevel.Verbose);
            this._initialized = true;
        });
    }

    public static get instance(): ParserConnector {
        return this._instance || (this._instance = new ParserConnector());
    }
    //#endregion

    //#region Disposable
    private _disposed: boolean = false;

    public async dispose(): Promise<void> {
        if (this._disposed) {
            return;
        }

        this._disposed = true;
        await ALParserNinja.terminate();
    }
    //#endregion
}
