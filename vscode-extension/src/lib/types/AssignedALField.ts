import { ALObjectType } from "./ALObjectType";


export interface AssignedALField {
    type: ALObjectType;
    objectId: number;
    ids: number[];
}
