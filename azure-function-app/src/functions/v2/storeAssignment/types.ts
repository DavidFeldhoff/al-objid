import { ALObjectType } from "../ALObjectType";

export interface StoreAssignmentRequest {
    type: ALObjectType;
    id: number;
    fieldId?: number;
    redirectExtensions?: true;
}

export interface StoreAssignmentResponse {
    updated: boolean;
}
