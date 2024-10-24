import { Config } from "../Config";
import { ALObjectNamespace } from "../types/ALObjectNamespace";

export function getStorageIdLight(object: ALObjectNamespace): { type: string, id: number } {
    if (Config.instance.storeExtensionValuesOrIdsOnBaseObject && ["tableextension", "enumextension"].includes(object.type) && object.extendsId) {
        return { type: object.type.replace("extension", ""), id: object.extendsId };
    } else {
        return { type: object.type, id: object.id };
    }
}