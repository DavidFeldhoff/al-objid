import { RelativePattern, Uri, workspace } from "vscode";
import { ConsumptionInfo } from "./types/ConsumptionInfo";
import { executeWithStopwatchAsync } from "./MeasureTime";
import { ALObject } from "@vjeko.com/al-parser-types-ninja";
import { ParserConnector } from "../features/ParserConnector";
import { getStorageIdOfALObject } from "./functions/getStorageId";
import { ALObjectNamespace } from "./types/ALObjectNamespace";
import { getAlObjectEntityIds } from "./functions/getAlObjectEntityIds";
import { GetConsumptionErrorEntry } from "./types/ConsumptionErrors";

export async function getWorkspaceFolderFiles(uri: Uri): Promise<Uri[]> {
    let folderPath: string = uri.fsPath;
    let pattern = new RelativePattern(folderPath, "**/*.al");
    return await executeWithStopwatchAsync(
        () => workspace.findFiles(pattern, null),
        `Retrieving list of files in ${uri}`
    );
}

export async function getObjectDefinitions(uris: Uri[], tempFixFQN: { fixFqn: boolean, updateDependencyCache: boolean } = { fixFqn: true, updateDependencyCache: true }): Promise<ALObjectNamespace[]> {
    return executeWithStopwatchAsync(() => ParserConnector.instance.parse(uris, tempFixFQN), `Parsing ${uris.length} object files`);
}

export async function updateActualConsumption(objects: ALObject[], consumption: ConsumptionInfo, updateDependencyCache: boolean) {
    const errorEntries: GetConsumptionErrorEntry[] = [];
    for (let object of objects) {
        let { type, id } = object;
        if (!id) {
            errorEntries.push({
                object: `${type}_0_${object.name}`,
                reason: "No ID"
            });
            continue;
        }
        if (!consumption[type]) consumption[type] = [];
        consumption[type].push(id);

        const fieldsOrValues = getAlObjectEntityIds(object);
        if (fieldsOrValues.length === 0)
            continue;

        let typeAndId = await getStorageIdOfALObject(object, updateDependencyCache);
        if (!typeAndId) {
            errorEntries.push({
                object: `${type}_${id}_${object.name}`,
                reason: `Unable to store ${type === "tableextension" ? 'field' : 'value'} IDs as ID of base object wasn't found. Please check if the base object is in the workspace or dependency packages.`
            });
            continue;
        }

        if (fieldsOrValues.length > 0) {
            consumption[typeAndId] = [];
            for (let fieldOrValue of fieldsOrValues) {
                consumption[typeAndId].push(fieldOrValue.id);
            }
        }
    }
    return errorEntries;
}

export async function getActualConsumption(objects: ALObject[], errorEntries?: GetConsumptionErrorEntry[]): Promise<ConsumptionInfo> {
    const consumption: ConsumptionInfo = {};
    const entries = await updateActualConsumption(objects, consumption, true);
    if (errorEntries)
        errorEntries = entries;
    return consumption;
}
