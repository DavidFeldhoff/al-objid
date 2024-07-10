import { ALObject, ALUniqueEntity } from "@vjeko.com/al-parser-types-ninja";

export function getAlObjectEntityIds(object: ALObject): ALUniqueEntity[] {
    return object.fields || object.values || [];
}