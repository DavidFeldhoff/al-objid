import { RelativePattern, Uri, workspace } from "vscode";
import { ConsumptionInfo } from "./types/ConsumptionInfo";
import { executeWithStopwatchAsync } from "./MeasureTime";
import { ALObject } from "@vjeko.com/al-parser-types-ninja";
import { ParserConnector } from "../features/ParserConnector";
import { getStorageId } from "./functions/getStorageId";
import { ALObjectNamespace } from "./types/ALObjectNamespace";
import { getAlObjectEntityIds } from "./functions/getAlObjectEntityIds";

export async function getWorkspaceFolderFiles(uri: Uri): Promise<Uri[]> {
    let folderPath: string = uri.fsPath;
    let pattern = new RelativePattern(folderPath, "**/*.al");
    return await executeWithStopwatchAsync(
        () => workspace.findFiles(pattern, null),
        `Retrieving list of files in ${uri}`
    );
}

export async function getObjectDefinitions(uris: Uri[]): Promise<ALObjectNamespace[]> {
    return executeWithStopwatchAsync(() => ParserConnector.instance.parse(uris), `Parsing ${uris.length} object files`);
}

export async function updateActualConsumption(objects: ALObject[], consumption: ConsumptionInfo): Promise<void> {
    for (let object of objects) {
        let { type, id } = object;
        if (!id) continue;
        if (!consumption[type]) consumption[type] = [];
        consumption[type].push(id);

        let typeAndId = await getStorageId(object);
        if (!typeAndId)
            continue;

        const fieldsOrValues = getAlObjectEntityIds(object);
        if (fieldsOrValues.length > 0) {
            consumption[typeAndId] = [];
            for (let fieldOrValue of fieldsOrValues) {
                consumption[typeAndId].push(fieldOrValue.id);
            }
            continue;
        }
    }
}

export async function getActualConsumption(objects: ALObject[]): Promise<ConsumptionInfo> {
    const consumption: ConsumptionInfo = {};
    await updateActualConsumption(objects, consumption);
    return consumption;
}
