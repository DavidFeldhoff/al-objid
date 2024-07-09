import { ALObjectType } from "../types/ALObjectType";
import { ConsumptionDataOfField } from "../types/ConsumptionDataOfFields";
import { AssignedALField } from "../types/AssignedALField";

export function fieldConsumptionToObjects(consumption: ConsumptionDataOfField): AssignedALField[] {
    const objects: AssignedALField[] = [];
    for (let key in consumption) {
        const fieldConsumptionKey = key as ALObjectType;
        const ids = consumption[fieldConsumptionKey];
        const type = fieldConsumptionKey.split("_")[0] as ALObjectType;
        const objectId = parseInt(fieldConsumptionKey.split("_")[1]);
        objects.push({
            type,
            objectId,
            ids,
        });
    }
    return objects;
}
