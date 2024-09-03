import { Blob } from "@vjeko.com/azure-func";
import { ALNinjaRequestContext, AppInfo } from "../TypesV2";

interface UpdateResult {
    app: AppInfo;
    success: boolean;
}

export async function addAssignment(appId: string, request: ALNinjaRequestContext, storageId: string, idToAssign: number, content: any): Promise<UpdateResult> {
    let success = true;

    const blob = new Blob<AppInfo>(`${appId}.json`);
    const app = await blob.optimisticUpdate((app) => {
        if (!app) {
            app = {} as AppInfo;
        }

        let consumption = app[storageId] || [];
        if (consumption.includes(idToAssign)) {
            success = false;
            return app;
        }
        app[storageId] = [...consumption, idToAssign].sort((left, right) => left - right);
        request.log(app, "addAssignment", content);
        return { ...app };
    });

    return { app, success };
}

export async function removeAssignment(appId: string, request: ALNinjaRequestContext, storageId: string, idToRemove: number, content: any): Promise<UpdateResult> {
    let success = true;

    const blob = new Blob<AppInfo>(`${appId}.json`);
    const app = await blob.optimisticUpdate((app) => {
        if (!app) {
            app = {} as AppInfo;
            return app;
        }

        let consumption: number[] = app[storageId] || [];
        if (!consumption.includes(idToRemove)) {
            return app;
        }

        app[storageId] = consumption.filter(x => x !== idToRemove);
        if ((app[storageId] as number[]).length === 0)
            delete app[storageId];
        request.log(app, "removeAssignment", content);

        return { ...app };
    });

    return { app, success };
}
