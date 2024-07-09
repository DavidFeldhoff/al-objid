import { Blob } from "@vjeko.com/azure-func";
import { ALObjectType } from "../ALObjectType";
import { ALNinjaRequestContext, AppInfo } from "../TypesV2";

interface UpdateResult {
    app: AppInfo;
    success: boolean;
}

export async function addAssignment(appId: string, request: ALNinjaRequestContext, type: ALObjectType, id: number, fieldId?: number): Promise<UpdateResult> {
    let success = true;

    const blob = new Blob<AppInfo>(`${appId}.json`);
    const app = await blob.optimisticUpdate((app) => {
        if (!app) {
            app = {} as AppInfo;
        }

        if (fieldId) {
            let consumption = app[`${type}_${id}`] || [];
            if (consumption.includes(fieldId)) {
                success = false;
                return app;
            }
            app[`${type}_${id}`] = [...consumption, fieldId].sort((left, right) => left - right);
            request.log(app, "addAssignment", { type, id, fieldId });
            return { ...app };
        } else {

            let consumption = app[type];
            if (!consumption) {
                consumption = [];
            }

            if (consumption.includes(id)) {
                success = false;
                return app;
            }

            app[type] = [...consumption, id].sort((left, right) => left - right);
            request.log(app, "addAssignment", { type, id });

            return { ...app };
        }
    });

    return { app, success };
}

export async function removeAssignment(appId: string, request: ALNinjaRequestContext, type: ALObjectType, id: number, fieldId?: number): Promise<UpdateResult> {
    let success = true;

    const blob = new Blob<AppInfo>(`${appId}.json`);
    const app = await blob.optimisticUpdate((app) => {
        if (!app) {
            app = {} as AppInfo;
            return app;
        }

        if (fieldId) {
            let consumption: number[] = app[`${type}_${id}`] || [];
            if (!consumption.includes(fieldId)) {
                return app;
            }
            app[`${type}_${id}`] = consumption.filter(x => x !== fieldId);
            request.log(app, "removeAssignment", { type, id, fieldId });
            return { ...app };
        } else {
            let consumption = app[type];
            if (!consumption || !consumption.includes(id)) {
                return app;
            }

            app[type] = consumption.filter(x => x !== id);
            request.log(app, "removeAssignment", { type, id });

            return { ...app };
        }
    });

    return { app, success };
}
