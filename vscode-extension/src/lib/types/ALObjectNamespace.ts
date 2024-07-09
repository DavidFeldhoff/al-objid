import { ALObject } from "@vjeko.com/al-parser-types-ninja";

export interface ALObjectNamespace extends ALObject {
    namespace?: string;
    extendsNamespace?: string;
    extendsId?: number;
}
