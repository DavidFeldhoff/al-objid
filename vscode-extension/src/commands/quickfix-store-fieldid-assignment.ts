import { ALUniqueEntity } from "@vjeko.com/al-parser-types-ninja";
import { ALApp } from "../lib/ALApp";
import { Telemetry } from "../lib/Telemetry";
import { NinjaCommand } from "./commands";
import { Range, TextDocument, commands } from "vscode";
import { AssignmentIdContext } from "./contexts/AssignmentContext";
import { ALObjectNamespace } from "../lib/types/ALObjectNamespace";
import { getStorageIdLight } from "../lib/functions/getStorageIdLight";

/**
 * Stores a field ID assignment in the back end for a manually-assigned ID.
 */
export async function QuickFixStoreFieldIdAssignment(app: ALApp, object: { object: ALObjectNamespace, field: ALUniqueEntity }, document: TextDocument, range: Range) {
    Telemetry.instance.logAppCommand(app, NinjaCommand.QuickFixStoreFieldIdAssignment, { type: object.object.type, id: object.object.id, fieldId: object.field.id });

    if (!document || !range) {
        return;
    }

    const { type, id } = getStorageIdLight(object.object);

    commands.executeCommand(NinjaCommand.StoreIdAssignment, {
        app,
        objectType: type,
        objectId: id,
        fieldId: object.field.id
    } as AssignmentIdContext);
}
