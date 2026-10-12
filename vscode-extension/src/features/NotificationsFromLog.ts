import { EventLogEntry } from "../lib/types/EventLogEntry";
import { Config } from "../lib/Config";
import { UI } from "../lib/UI";
import { WorkspaceManager } from "./WorkspaceManager";

export class NotificationsFromLog {
    //#region Singleton
    private static _instance: NotificationsFromLog;

    private constructor() {}

    public static get instance(): NotificationsFromLog {
        return this._instance || (this._instance = new NotificationsFromLog());
    }
    //#endregion

    private _log: { [key: string]: number } = {};

    public updateLog(appId: string, log: EventLogEntry[] = [], appName: string, sourceAppId?: string): boolean {
        const lastTimestamp = this._log[appId];
        if (!lastTimestamp) {
            // On the first call, no notifications should be shown
            this._log[appId] = Date.now();
            return true;
        }

        if (!Config.instance.showEventLogNotifications) {
            return false;
        }

        let updated = false;
        let maxTimestamp = 0;
        for (let event of log) {
            if (event.timestamp <= lastTimestamp) {
                continue;
            }

            if (event.timestamp > maxTimestamp) {
                maxTimestamp = event.timestamp;
            }

            if (event.user) {
                const app = WorkspaceManager.instance.getALAppFromHash(event.sourceAppId || sourceAppId || appId);
                // Unmarked entries come from older clients and still contain ciphertext.
                const user = event.userEncoding === "plain" ? event.user : app?.decrypt(event.user) || "Unknown user";
                if (user === Config.instance.userName) {
                    continue;
                }

                UI.log.showMessage({ ...event, user }, appName);
                updated = true;
            }
        }

        this._log[appId] = maxTimestamp || Date.now();

        return updated;
    }
}
