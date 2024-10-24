import { Blob } from "@vjeko.com/azure-func";
import { findFirstAvailableId } from "../../../common/util";
import { ALNinjaRequestContext, AppInfo, Range } from "../TypesV2";
import { ConsumptionUpdateContext } from "./types";
import { ALObjectType } from "../ALObjectType";

interface UpdateResult {
    app: AppInfo;
    success: boolean;
}

export async function updateConsumption(appId: string, request: ALNinjaRequestContext, type: ALObjectType | string, storageId: string, assignFromRanges: Range[], appRanges: Range[], context: ConsumptionUpdateContext): Promise<UpdateResult> {
    let success = true;

    const blob = new Blob<AppInfo>(`${appId}.json`);
    const app = await blob.optimisticUpdate((app, attempts) => {
        if (attempts === 100) {
            success = false;
            return app;
        }

        context.updated = false;
        context.updateAttempts = attempts;

        if (!app) {
            app = {} as AppInfo;
        }

        app._ranges = appRanges;
        const consumption = app[storageId];

        // No ids consumed yet, consume the first one and exit
        if (!consumption || !consumption.length) {
            context.updated = true;
            app[storageId] = [context.id];
            request.log(app, "getNext", { type: storageId, id: context.id });
            return { ...app };
        }

        if (consumption.indexOf(context.id) >= 0) {
            // Somebody has consumed this id in the meantime, retrieve the new one
            context.id = findFirstAvailableId(assignFromRanges, consumption);

            // If id is 0, then there are no numbers left, return the same array
            if (context.id === 0) {
                context.available = false;
                return app;
            }
        }

        context.updated = true;
        app[storageId] = [...consumption, context.id].sort((left, right) => left - right);
        request.log(app, "getNext", { type, storageId, id: context.id });
        return { ...app };
    });

    return { app, success };
}
