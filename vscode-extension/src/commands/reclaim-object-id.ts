import { Telemetry } from "../lib/Telemetry";
import { UI } from "../lib/UI";
import { Backend } from "../lib/backend/Backend";
import { NinjaCommand } from "./commands";
import { AssignmentIdContext } from "./contexts/AssignmentContext";

export default async function confirmReclaimObjectId(context: AssignmentIdContext) {
    const { app, objectType, objectId, fieldId } = context;
    Telemetry.instance.logAppCommand(app, NinjaCommand.ReclaimObjectId, { objectType, objectId, fieldId });

    const response = await Backend.removeAssignment(app, objectType, objectId, fieldId);
    if (response) {
        UI.assignment.reclaimSucceeded(objectType, objectId, fieldId);
    } else {
        UI.assignment.reclaimFailed(objectType, objectId, fieldId);
    }
}
