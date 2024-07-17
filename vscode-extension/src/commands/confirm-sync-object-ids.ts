import { commands, window } from "vscode";
import { URLS } from "../lib/constants";
import openExternal from "../lib/functions/openExternal";
import { Telemetry } from "../lib/Telemetry";
import { NinjaCommand } from "./commands";
import { AppsCommandContext } from "./contexts/AppsCommandContext";
import { SyncOptions } from "./sync-object-ids";
import { ALApp } from "../lib/ALApp";

const OPTION = {
    UPDATE: "Update. I want to merge actual object ID assignments with what's already recorded.",
    REPLACE: "Replace. I want to completely replace recorded object ID assignments with actual state.",
    NO: "Nothing. I have changed my mind, I won't do it at this time.",
    LEARN: "I am not sure. Tell me more about synchronization.",
};

export const confirmSyncObjectIds = async (context?: AppsCommandContext) => {
    Telemetry.instance.logCommand(NinjaCommand.ConfirmSyncObjectIds);

    let result = await window.showQuickPick(Object.values(OPTION), {
        placeHolder: "How would you like to synchronize object ID assignment information with the back end?",
    });
    switch (result) {
        case OPTION.REPLACE:
        case OPTION.UPDATE:
            let app: ALApp | undefined;
            if (context)
                if (context.apps.length > 1) {
                    app = (await window.showQuickPick(context.apps.map(app => { return { label: app.manifest.name, node: app }; }), { placeHolder: 'Which app do you want to synchronize?' }))?.node;
                    if (!app)
                        break;
                } else
                    app = context.apps.pop();
            const syncOptions: SyncOptions = { merge: result === OPTION.UPDATE, app };
            commands.executeCommand(NinjaCommand.SyncObjectIds, syncOptions);
            break;
        case OPTION.LEARN:
            openExternal(URLS.SYNCHRONIZATION_LEARN);
            break;
    }
};
