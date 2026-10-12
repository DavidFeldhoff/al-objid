import { AuditMetadata, ObjectConsumptions } from "../TypesV2";

export interface AppConsumption extends AuditMetadata {
    appId: string;
    authKey?: string;
    ids: ObjectConsumptions;
}

export interface AutoSyncIdsRequest {
    appFolders: AppConsumption[];
}

export interface AutoSyncIdsResponse {
    [key: string]: ObjectConsumptions;
}
