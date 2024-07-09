import { ALObjectType } from "../ALObjectType";

export interface StoreAssignmentRequest {
    type: ALObjectType;
    id: number;
    fieldId?: number;
}

export interface StoreAssignmentResponse {
    updated: boolean;
}
