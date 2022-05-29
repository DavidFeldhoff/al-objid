import { commands, env, Uri, window } from "vscode";
import { SyncObjectIdsCommandContext } from "../features/treeView/rangeExplorer/contexts/SyncObjectIdsCommandContext";
import { URLS } from "../lib/constants";
import { NinjaCommand } from "./commands";

const OPTION = {
    UPDATE: "Update. I want to merge actual object ID assignments with what's already recorded.",
    REPLACE: "Replace. I want to completely replace recorded object ID assignments with actual state.",
    NO: "Nothing. I have changed my mind, I won't do it at this time.",
    LEARN: "I am not sure. Tell me more about synchronization.",
};

export const confirmSyncObjectIds = async (context: SyncObjectIdsCommandContext) => {
    let result = await window.showQuickPick(Object.values(OPTION), {
        placeHolder: "How would you like to synchronize object ID assignment information with the back end?",
    });
    switch (result) {
        case OPTION.REPLACE:
        case OPTION.UPDATE:
            commands.executeCommand(NinjaCommand.SyncObjectIds, { merge: result === OPTION.UPDATE }, context.appId);
            break;
        case OPTION.LEARN:
            env.openExternal(Uri.parse(URLS.SYNCHRONIZATION_LEARN));
            break;
    }
};
