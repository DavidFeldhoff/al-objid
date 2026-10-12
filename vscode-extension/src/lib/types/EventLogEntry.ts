import { EventType } from "./EventType";
import { AuditMetadata } from "../backend/AuditMetadata";

export interface EventLogEntry extends AuditMetadata {
    eventType: EventType;
    timestamp: number;
    user: string;
    data: any;
}
