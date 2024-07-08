import { Disposable, EventEmitter } from "vscode";
import { ConsumptionDataOfObject } from "../lib/types/ConsumptionDataOfObject";
import { ALObjectType } from "../lib/types/ALObjectType";
import { PropertyBag } from "../lib/types/PropertyBag";
import { ConsumptionWarnings } from "./ConsumptionWarnings";
import { ConsumptionDataOfField } from "../lib/types/ConsumptionDataOfFields";

export interface ConsumptionEventInfo {
    appId: string;
    consumption: ConsumptionDataOfObject;
}

export class ConsumptionCache implements Disposable {
    //#region Singleton
    private static _instance: ConsumptionCache;

    private constructor() { }

    public static get instance(): ConsumptionCache {
        return this._instance || (this._instance = new ConsumptionCache());
    }
    //#endregion

    private _disposed: boolean = false;
    private _cacheOfObjects: PropertyBag<ConsumptionDataOfObject> = {};
    private _cacheOfFields: PropertyBag<ConsumptionDataOfField> = {};
    private readonly _onConsumptionUpdateEmitter = new EventEmitter<ConsumptionEventInfo>();
    private readonly _onConsumptionUpdateEvent = this._onConsumptionUpdateEmitter.event;

    public onConsumptionUpdate(appId: string, onUpdate: (consumption: ConsumptionDataOfObject) => void): Disposable {
        return this._onConsumptionUpdateEvent(e => {
            if (e.appId === appId) {
                onUpdate(e.consumption);
            }
        });
    }

    public updateConsumption(appId: string, consumption: any): boolean {
        const consumptionObjectIds: ConsumptionDataOfObject = {} as any as ConsumptionDataOfObject;
        Object.keys(consumption)
            .filter(key => Object.values<string>(ALObjectType).includes(key))
            .forEach(key => (consumptionObjectIds as any)[key] = consumption[key]);

        const consumptionFieldIds: ConsumptionDataOfField = {};
        Object.keys(consumption)
            .filter(key => !Object.values<string>(ALObjectType).includes(key))
            .forEach(key => consumptionFieldIds[key] = consumption[key]);

        let objectIdsUpdated = JSON.stringify(this._cacheOfObjects[appId]) !== JSON.stringify(consumptionObjectIds);
        if (objectIdsUpdated) {
            this._cacheOfObjects[appId] = consumptionObjectIds;
            ConsumptionWarnings.instance.checkRemainingIds(appId, consumptionObjectIds);
            this._onConsumptionUpdateEmitter.fire({ appId, consumption: consumptionObjectIds });
        }
        let fieldIdsUpdated = JSON.stringify(this._cacheOfFields[appId]) !== JSON.stringify(consumptionFieldIds);
        if (fieldIdsUpdated) {
            this._cacheOfFields[appId] = consumptionFieldIds;
            // TODO: Handle warning for field ids
        }
        return objectIdsUpdated || fieldIdsUpdated;
    }

    public getObjectConsumption(appId: string): ConsumptionDataOfObject {
        return this._cacheOfObjects[appId];
    }
    public getFieldConsumption(appId: string): ConsumptionDataOfField {
        return this._cacheOfFields[appId];
    }


    dispose() {
        if (this._disposed) {
            return;
        }
        this._disposed = true;
        this._onConsumptionUpdateEmitter.dispose();
    }
}
