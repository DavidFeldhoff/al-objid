import { RelativePattern, Uri, workspace } from "vscode";
import { ConsumptionInfo } from "./types/ConsumptionInfo";
import { executeWithStopwatchAsync } from "./MeasureTime";
import { ALObject } from "@vjeko.com/al-parser-types-ninja";
import { ParserConnector } from "../features/ParserConnector";
import { getExtendedId } from "./functions/getExtendedId";
import { readFileSync } from "fs";
import { Config } from "./Config";
import { output } from "../features/Output";

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
        if (Config.instance.storeExtensionValuesOrIdsOnBaseObject) {
            if ((object.fields || object.values) && ["tableextension", "enumextension"].includes(type.toLowerCase())) {
                const extendedId = await getExtendedId(Uri.file(object.path), readFileSync(object.path, { encoding: 'utf8' }));
                if (!extendedId) {
                    output.log(`[Update Consumption] Error: Unable to update consumption for ${type} ${id} ${object.name} as the base object wasn't found.`);
                    continue;
                }
                typeAndId = `${type}_${extendedId}`;
            }
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
