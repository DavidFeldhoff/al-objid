import { ALNinjaRequestContext, AppInfo, AuditMetadata, ObjectConsumptions } from "../TypesV2";
import { Blob } from "@vjeko.com/azure-func";
import { ALObjectType } from "../ALObjectType";
import { validateAuditMetadata } from "../AuditLog";

export async function updateConsumptions(appId: string, request: ALNinjaRequestContext, objectIds: ObjectConsumptions, patch: boolean, actor?: AuditMetadata, origin: "manual" | "auto" = "manual"): Promise<AppInfo> {
    validateAuditMetadata(actor === undefined ? request.body : actor);
    // Aggregate extended storage IDs by object type; never log keys or ID arrays.
    const counts: Partial<Record<ALObjectType, number>> = {};
    for (const key of Object.keys(objectIds)) {
        const type = key.split("_")[0] as ALObjectType;
        if (Object.prototype.hasOwnProperty.call(ALObjectType, type)) {
            counts[type] = (counts[type] || 0) + objectIds[key].length;
        }
    }
    let blob = new Blob<AppInfo>(`${appId}.json`);
    const app = await blob.optimisticUpdate(app => {
        if (!app) {
            app = {} as AppInfo;
        }

        if (typeof app._forceMerge !== "boolean") {
            app._forceMerge = true;
        }
        const merge = patch || app._forceMerge;

        request.log(app, merge ? "syncMerge" : "syncFull", { origin, counts }, actor);

        let { _authorization, _ranges, _log, _pool, _forceMerge, ...consumptions } = app;
        if (!merge) {
            consumptions = {} as ObjectConsumptions;
        }
        for (let key of Object.keys(objectIds)) {
            let existing = consumptions[key] || [];
            consumptions[key] = [...new Set([...(merge ? existing : []), ...objectIds[key]])].sort((left, right) => left - right);
        }
        return { _authorization, _ranges, _log, _pool, _forceMerge, ...consumptions };
    });
    return app;
}
