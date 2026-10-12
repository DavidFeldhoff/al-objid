import { Blob, ErrorResponse } from "@vjeko.com/azure-func";
import { ALNinjaRequestHandler } from "../ALNinjaRequestHandler";
import { updateConsumptions } from "../syncIds/update";
import { AppInfo } from "../TypesV2";
import { AutoSyncIdsRequest, AutoSyncIdsResponse } from "./types";
import { validateAuditMetadata } from "../AuditLog";

const autoSyncIds = new ALNinjaRequestHandler<AutoSyncIdsRequest, AutoSyncIdsResponse>(async (request) => {
    const { appFolders } = request.body;
    // Validate the entire batch before the first folder can write anything.
    appFolders.forEach(folder => validateAuditMetadata(folder));
    let result: AutoSyncIdsResponse = {};
    for (let folder of appFolders) {
        const blob = new Blob<AppInfo>(`${folder.appId}.json`);
        const app = await blob.read();
        if (app && app._authorization && app._authorization.valid && app._authorization.key !== folder.authKey) {
            throw new ErrorResponse(`Invalid credentials for app ${folder.appId}`, 401);
        }
        const updatedApp = await updateConsumptions(folder.appId, request, folder.ids, request.method === "PATCH", folder, "auto");
        const { _forceMerge, ...consumptions } = updatedApp;
        result[folder.appId] = consumptions;
        request.markAsChanged(folder.appId, updatedApp);
    }
    return result;
}, false);

autoSyncIds.skipAuthorization();
autoSyncIds.validator.expect("body", {
    appFolders: "PerAppObjectIDs"
});

export default autoSyncIds.azureFunction;
