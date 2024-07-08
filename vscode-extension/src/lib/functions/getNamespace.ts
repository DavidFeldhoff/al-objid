import { Hover, Position, Uri, commands } from "vscode";
import { LogLevel, output } from "../../features/Output";
import { readFileSync } from "fs";
import { CodeCommand } from "../../commands/commands";

export async function getNamespace(uri: Uri, extensionObjectType: string): Promise<string>;
export async function getNamespace(uri: Uri, position: Position): Promise<string>;
export async function getNamespace(uri: Uri, arg: Position | string): Promise<string> {
    if (typeof arg === 'string') {
        const result = getPositionOfBaseObjectReference(uri, arg)
        if (result && 'baseObjectNamespace' in result && result.baseObjectNamespace)
            return result.baseObjectNamespace;
    }
    let position = typeof arg === 'string' ? getPositionOfBaseObjectReference(uri, arg) : arg;
    if (!position) {
        output.log(`[Get Namespace] Unable to find position of base ${arg} object reference in ${uri.fsPath}`, LogLevel.Verbose)
        return "";
    }
    let hover: Hover | undefined;
    for (let i = 0; i < 5 && hover === undefined; i++) {
        let hovers: Hover[] | undefined = await commands.executeCommand(CodeCommand.ExecuteHoverProvider, uri, position);
        hover = hovers?.find(hover => hover.contents.length > 0 && (hover.contents[0] as { value: string }).value.includes('```al'))
    }
    if (hover)
        if (hover.contents.length > 0) {
            const hoverContent: any = hover.contents[0];
            const hoverContentMatch = hoverContent.value.match(/(table|enum) [^\r]+/i);
            if (hoverContentMatch) {
                let fullQualifiedObjectName = hoverContentMatch[0].substring(hoverContentMatch[1].length + 1)
                const regexMatch = fullQualifiedObjectName.match(/([^."]+$|"[^"]*"$)/i)
                if (regexMatch) {
                    const objectName = regexMatch[1];
                    const namespace = fullQualifiedObjectName.substring(0, Math.max(fullQualifiedObjectName.length - objectName.length - 1, 0));
                    output.log(`[Get Namespace] Found namespace for ${uri.fsPath}: ${namespace || "No namespace defined"}`, LogLevel.Verbose)
                    return namespace;
                }
            }
        }
    output.log(`[Get Namespace] Error: Could not find namespace for ${uri.fsPath}`, LogLevel.Info)
    return "";
};
function getPositionOfBaseObjectReference(uri: Uri, type: string): Position | undefined | { position: Position, baseObjectName: string | undefined, baseObjectNamespace: string | undefined } {
    const lines: string[] = readFileSync(uri.fsPath, 'utf8').split('\n')
    const regex = new RegExp(`${type} \\d+ ("[^"]+"|\\w+) extends `, 'i');
    for (let lineNo = 0; lineNo < lines.length; lineNo++) {
        const match = lines[lineNo].match(regex);
        if (match && match.index !== undefined) {
            const regexp = /.* extends (?:(?<namespace>(?:[^".\n]+\.)*[^".\n]+)\.)?(?<objectname>"[^"]+"|\w+)/i
            const match = lines[lineNo].match(regexp);
            if (match && match.index) {
                return {
                    position: new Position(lineNo, match.index + match[0].length + 2),
                    baseObjectName: match.groups?.objectname,
                    baseObjectNamespace: match.groups?.namespace
                }
            }
        }
    }
    return undefined;
}