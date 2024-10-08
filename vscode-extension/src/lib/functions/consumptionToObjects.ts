import { ConsumptionDataOfObject } from "../types/ConsumptionDataOfObject";
import { ALObjectType } from "../types/ALObjectType";
import { AssignedALObject } from "../types/AssignedALObject";

export function consumptionToObjects(consumption: ConsumptionDataOfObject): AssignedALObject[] {
    const objects: AssignedALObject[] = [];
    for (let key in consumption) {
        const type = key as ALObjectType;
        const ids = consumption[type];
        for (const id of ids) {
            objects.push({
                type,
                id,
            });
        }
    }
    return objects;
}
