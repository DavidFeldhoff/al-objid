import { Uri, EndOfLine, Position, Location, commands, workspace } from "vscode";

const baseObjectLookupTable: Record<string, number> = {};

const regexp = /(tableextension|enumextension) \d+ (\w+|"[^"]+") extends (\w+|"[^"]+")/i;

export async function getExtendedId(uri: Uri, documentText: string, eol: EndOfLine): Promise<number | null> {
    const regexpMatchArr = documentText.match(regexp);
    if (!regexpMatchArr || regexpMatchArr.index === undefined) {
        return null;
    }

    const baseObjectName = regexpMatchArr[3];
    const resolvedId = baseObjectLookupTable[baseObjectName];
    if (resolvedId) {
        return resolvedId;
    }

    const linebreak = eol === EndOfLine.CRLF ? '\r\n' : '\n'
    const textToExtendedObject = documentText.substring(0, regexpMatchArr.index + regexpMatchArr[0].length)
    const line = textToExtendedObject.split(linebreak).length - 1
    const character = textToExtendedObject.split(linebreak).pop()!.length
    const pos = new Position(line, character)
    const locations: Location[] | undefined = await commands.executeCommand('vscode.executeDefinitionProvider', uri, pos)
    if (!locations || locations.length === 0) {
        return null;
    }

    const extendedDoc = await workspace.openTextDocument(locations[0].uri)
    const extendedIdMatches = extendedDoc.lineAt(locations[0].range.end.line).text.match(/^(table|enum|report|page|permissionset) (\d+) (\w+|"[^"]+")/i)
    if (!extendedIdMatches) {
        return null;
    }

    // put to lookup table
    const baseObjectId = parseInt(extendedIdMatches[2]);
    baseObjectLookupTable[baseObjectName] = baseObjectId;
    return baseObjectId;
}