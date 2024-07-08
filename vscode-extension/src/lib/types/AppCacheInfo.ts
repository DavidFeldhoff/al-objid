import { EventLogEntry } from "./EventLogEntry";
import { ALRange } from "./ALRange";
import { ConsumptionDataOfObject } from "./ConsumptionDataOfObject";

export type AppCacheInfo = {
    _ranges: ALRange[];
    _log: EventLogEntry[];
} & ConsumptionDataOfObject;
