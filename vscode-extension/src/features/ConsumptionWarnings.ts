import { ConsumptionDataOfObject } from "../lib/types/ConsumptionDataOfObject";
import { PropertyBag } from "../lib/types/PropertyBag";
import { UI } from "../lib/UI";
import { LABELS } from "../lib/constants";
import { ExtensionContext } from "vscode";
import { WorkspaceManager } from "./WorkspaceManager";
import { ALRange } from "../lib/types/ALRange";
import { Config } from "../lib/Config";
import { ConsumptionDataOfField } from "../lib/types/ConsumptionDataOfFields";

export class ConsumptionWarnings {
    //#region Singleton
    private static _instance: ConsumptionWarnings;

    private constructor() { }

    public static get instance(): ConsumptionWarnings {
        return this._instance || (this._instance = new ConsumptionWarnings());
    }
    //#endregion

    private _context?: ExtensionContext;
    private _shownWarnings: PropertyBag<boolean> = {};
    private _warningLevels: PropertyBag<number> = {};

    private async showWarning(appId: string, type: string, remaining: number, showNumbersAboutToRunOut: (name: string, type: string, remaining: number) => Thenable<string | undefined>, showDisabledOnlyForAppAndType: (name: string, type: string) => Thenable<"OK" | undefined>
    ) {
        const warningId = `consumption-warning.${appId}.${type}`;
        if (this._context!.globalState.get(warningId)) {
            return;
        }
        if (this._shownWarnings[warningId]) {
            return;
        }
        if (this._warningLevels[warningId] === remaining) {
            return;
        }
        this._warningLevels[warningId] = remaining;
        this._shownWarnings[warningId] = true;
        const app = WorkspaceManager.instance.getALAppFromHash(appId);
        if (!app) {
            return;
        }

        const result = await showNumbersAboutToRunOut(app.manifest.name, type, remaining);
        delete this._shownWarnings[warningId];

        if (result === LABELS.BUTTON_DONT_SHOW_AGAIN) {
            showDisabledOnlyForAppAndType(app.name, type);
            this._context!.globalState.update(warningId, true);
        }
    }

    public checkRemainingIds(appId: string, consumption: ConsumptionDataOfObject) {
        const app = WorkspaceManager.instance.getALAppFromHash(appId);
        if (!app) {
            // TODO Handle notifications for app pools
            return;
        }
        let idRangesPerType: Record<string, ALRange[]> = {};
        if (app.config.objectRanges) {
            Object.keys(app.config.objectRanges).forEach(key => {
                idRangesPerType[key] = app.config.objectRanges[key];
            });
        }
        let idRanges: ALRange[] = app?.manifest.idRanges || [];
        if (app.config.idRanges && app.config.idRanges.length > 0) {
            idRanges = app.config.idRanges;
        }

        for (let type of Object.keys(consumption)) {
            let available = 0;
            const idRangesToCheck = idRangesPerType[type] || idRanges;
            available = idRangesToCheck.reduce(
                (previous, current) => previous + Math.max(current.to - current.from, 0) + 1,
                0
            );

            // The formula below will work like this:
            // - At minimum, when 5 or fewer objects are available, warning pops up
            // - When consumption is at 95% of available range and more than 5 objects are available, warning pops up
            // - If there are still more than 25 objects available, no warning will pop up regardless of above
            const warningLevel = Math.max(Math.min(available * 0.95, available - 5), available - 25);

            const total = (consumption as any)[type].filter(
                (id: number) => idRangesToCheck.filter(range => range.from <= id && range.to >= id).length > 0
            ).length;
            if (total >= warningLevel) {
                this.showWarning(appId, type, available - total, UI.nextId.showNumbersAboutToRunOut, UI.nextId.showDisabledOnlyForAppAndType);
            }
        }
    }
    public checkRemainingFieldIds(appId: string, consumption: ConsumptionDataOfField) {
        const app = WorkspaceManager.instance.getALAppFromHash(appId);
        if (!app) {
            // TODO Handle notifications for app pools
            return;
        }
        let idRangesPerType: Record<string, ALRange[]> = {};
        if (app.config.objectRanges && Config.instance.fieldAndValueIdsStayInsideObjectRange) {
            Object.keys(app.config.objectRanges).forEach(key => {
                idRangesPerType[key] = app.config.objectRanges[key];
            });
        }
        let idRanges: ALRange[] = app?.manifest.idRanges || [];
        if (app.config.idRanges && app.config.idRanges.length > 0) {
            idRanges = app.config.idRanges;
        }

        for (let fieldConsumptionKey of Object.keys(consumption)) {
            let available = 0;
            const type = fieldConsumptionKey.split("_")[0];
            const idRangesToCheck = idRangesPerType[type] || idRanges;
            available = idRangesToCheck.reduce(
                (previous, current) => previous + Math.max(current.to - current.from, 0) + 1,
                0
            );

            // The formula below will work like this:
            // - At minimum, when 5 or fewer objects are available, warning pops up
            // - When consumption is at 95% of available range and more than 5 objects are available, warning pops up
            // - If there are still more than 25 objects available, no warning will pop up regardless of above
            const warningLevel = Math.max(Math.min(available * 0.95, available - 5), available - 25);

            const total = (consumption as any)[fieldConsumptionKey].filter(
                (id: number) => idRangesToCheck.filter(range => range.from <= id && range.to >= id).length > 0
            ).length;
            if (total >= warningLevel) {
                this.showWarning(appId, type, available - total, UI.nextId.showFieldNumbersAboutToRunOut, UI.nextId.showDisabledOnlyForAppAndFieldsOfType);
            }
        }
    }

    public setContext(context: ExtensionContext) {
        this._context = context;
    }
}
