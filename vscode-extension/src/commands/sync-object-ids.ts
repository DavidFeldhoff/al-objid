import { Backend } from "../lib/backend/Backend";
import { UI } from "../lib/UI";
import { LogLevel, output } from "../features/Output";
import { ConsumptionInfo } from "../lib/types/ConsumptionInfo";
import { LABELS } from "../lib/constants";
import { getActualConsumption, getObjectDefinitions, getWorkspaceFolderFiles } from "../lib/ObjectIds";
import { Telemetry } from "../lib/Telemetry";
import { WorkspaceManager } from "../features/WorkspaceManager";
import { NinjaCommand } from "./commands";
import { ALApp } from "../lib/ALApp";
import { GetConsumptionErrorEntry } from "../lib/types/ConsumptionErrors";
import { window, workspace } from "vscode";

export interface SyncOptions {
    merge: boolean;
    skipQuestion?: boolean;
    fromInitial?: boolean;
    app?: ALApp;
}

/**
 * Synchronizes object ID consumption information with the Azure back end.
 */
export const syncObjectIds = async (options?: SyncOptions) => {
    const app = options?.app || (await WorkspaceManager.instance.selectWorkspaceFolder());

    if (!app) {
        return;
    }

    if (!options?.merge && !options?.skipQuestion) {
        let consumption = await Backend.getConsumption(app);
        if (consumption?._total) {
            let answer = await UI.sync.showAreYouSure();
            if (answer === LABELS.SYNC_ARE_YOU_SURE.NO) {
                return;
            }
        }
    }

    output.log("Starting syncing object ID consumption with the back end", LogLevel.Info);

    const uris = await getWorkspaceFolderFiles(app.uri);
    const objects = await getObjectDefinitions(uris);
    let errorEntries: GetConsumptionErrorEntry[] = [];
    const consumption: ConsumptionInfo = await getActualConsumption(objects, errorEntries);
    if (errorEntries.length > 0) {
        UI.sync.showGetConsumptionErrors(errorEntries);
        await window.showTextDocument(await workspace.openTextDocument({ language: 'json', content: JSON.stringify(errorEntries, null, 2) }));
        return;
    }

    Telemetry.instance.logAppCommand(app, NinjaCommand.SyncObjectIds);
    if (await Backend.syncIds(app, consumption, !!options?.merge)) {
        if (options?.fromInitial) {
            UI.sync.showInitialSuccessInfo(app);
        } else {
            UI.sync.showSuccessInfo(app);
        }
    }
};
