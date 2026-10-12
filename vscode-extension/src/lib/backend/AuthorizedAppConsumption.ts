import { ConsumptionInfo } from "../types/ConsumptionInfo";
import { AuditMetadata } from "./AuditMetadata";

export interface AuthorizedAppConsumption extends AuditMetadata {
    appId: string;
    authKey: string;
    ids: ConsumptionInfo;
}
