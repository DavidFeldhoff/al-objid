import { ALObjectType } from "./ALObjectType";


export interface AssignedALObject {
    type: ALObjectType;
    id: number;
    possiblePaths?: string[];
    name?: string;
    fieldOrValueIds?: number[];
}
