import { RelativePattern, Uri, workspace } from "vscode";
import { ConsumptionInfo } from "./types/ConsumptionInfo";
import { executeWithStopwatchAsync } from "./MeasureTime";
import { ALObject } from "@vjeko.com/al-parser-types-ninja";
import { ParserConnector } from "../features/ParserConnector";
import { getExtendedId } from "./functions/getExtendedId";

export async function getWorkspaceFolderFiles(uri: Uri): Promise<Uri[]> {
    let folderPath: string = uri.fsPath;
    let pattern = new RelativePattern(folderPath, "**/*.al");
    return await executeWithStopwatchAsync(
        () => workspace.findFiles(pattern, null),
        `Retrieving list of files in ${uri}`
    );
}

export async function getObjectDefinitions(uris: Uri[]): Promise<ALObject[]> {
    return executeWithStopwatchAsync(() => ParserConnector.instance.parse(uris), `Parsing ${uris.length} object files`);
}

export async function updateActualConsumption(objects: ALObject[], consumption: ConsumptionInfo): Promise<void> {
    for (let object of objects) {
        let { type, id } = object;
        if (!id) continue;
        if (!consumption[type]) consumption[type] = [];
        consumption[type].push(id);

        let typeAndId = `${type}_${id}`;
        if ((object.fields || object.values) && ["tableextension", "enumextension"].includes(type.toLowerCase())) {
            const extendedDoc = await workspace.openTextDocument(object.path)
            const extendedId = await getExtendedId(extendedDoc.uri, extendedDoc.getText(), extendedDoc.eol);
            typeAndId = `${type}_${extendedId}`;
        }
        if (object.fields) {
            consumption[typeAndId] = [];
            for (let field of object.fields) {
                consumption[typeAndId].push(field.id);
            }
            continue;
        }

        if (object.values) {
            consumption[typeAndId] = [];
            for (let value of object.values) {
                consumption[typeAndId].push(value.id);
            }
        }
    }
}

export async function getActualConsumption(objects: ALObject[]): Promise<ConsumptionInfo> {
    const consumption: ConsumptionInfo = {};
    await updateActualConsumption(objects, consumption);
    return consumption;
}
