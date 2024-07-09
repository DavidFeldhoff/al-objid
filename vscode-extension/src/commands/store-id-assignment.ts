import { Telemetry } from "../lib/Telemetry";
import { UI } from "../lib/UI";
import { Backend } from "../lib/backend/Backend";
import { LABELS, URLS } from "../lib/constants";
import openExternal from "../lib/functions/openExternal";
import { NinjaCommand } from "./commands";
import { AssignmentIdContext } from "./contexts/AssignmentContext";

export default async function storeIdAssignment(context: AssignmentIdContext) {
    const { app, objectType, objectId, fieldId } = context;
    Telemetry.instance.logAppCommand(app, NinjaCommand.StoreIdAssignment, { objectType, objectId, fieldId });

    const result = await Backend.addAssignment(app, objectType, objectId, fieldId);
    if (!result) {
        if ((await UI.assignment.showNotUpdatedError(objectType, objectId, fieldId)) === LABELS.BUTTON_LEARN_MORE) {
            openExternal(URLS.WIKI.DOES_EVERYONE_NEED_TO_USE_NINJA);
        }
    }
}
