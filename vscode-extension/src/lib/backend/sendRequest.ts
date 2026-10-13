import { NotificationsFromLog } from "../../features/NotificationsFromLog";
import { output } from "../../features/Output";
import { EventLogEntry } from "../types/EventLogEntry";
import { Config } from "../Config";
import { HttpMethod, Https } from "./Https";
import { executeWithStopwatchAsync } from "../MeasureTime";
import { ConsumptionCache } from "../../features/ConsumptionCache";
import { API_RESULT } from "../constants";
import { WorkspaceManager } from "../../features/WorkspaceManager";
import { HttpRequest } from "./HttpRequest";
import { HttpResponse } from "./HttpResponse";
import { HttpEndpoint } from "./HttpEndpoint";
import { HttpErrorHandler } from "./HttpErrorHandler";
import { HttpEndpoints } from "./HttpEndpoints";
import { preprocessHttpStatusError } from "./preprocessHttpStatusError";
import { handleHttpErrorDefault } from "./handleHttpErrorDefault";
import { getAuditMetadata } from "./AuditMetadata";

/**
 * Sends a request to the back-end API.
 *
 * @param path Back-end endpoint
 * @param method HTTP method
 * @param data Data to send to the back-end endpoint
 * @param errorHandler Error handler to execute in case of unsuccessful request
 * @param sourceAppId Original app hash, before any pool ID substitution
 * @template T Type of response object expected from the back end
 * @returns `HttpResponse` object that contains full information about response, error, and error handling status
 */
export async function sendRequest<T>(
    path: string,
    method: HttpMethod,
    data: any = {},
    errorHandler?: HttpErrorHandler<T>,
    endpoint: HttpEndpoint = HttpEndpoints.default,
    sourceAppId?: string
): Promise<HttpResponse<T>> {
    const { hostname, key } = endpoint;
    const headers: any = {
        "Content-Type": "application/json",
    };
    if (key) {
        headers["X-Functions-Key"] = key;
    }

    const https = new Https({
        hostname,
        path,
        headers,
    });

    if (Config.instance.useVerboseOutputLogging) {
        let { authKey, ...log } = data;
        output.log(
            `[Verbose] sending request to https://${hostname}${path}: ${JSON.stringify(
                Array.isArray(data) ? data : log
            )}`
        );
    }

    const request: HttpRequest = { hostname, path, method, data };
    const response: HttpResponse<T> = {
        error: null,
        status: API_RESULT.NOT_SENT,
    };

    const app = WorkspaceManager.instance.getALAppFromHash(sourceAppId || data?.appId);
    if (data && typeof data === "object" && !Array.isArray(data) && data.appId) {
        // Always attribute backend changes, independently of notification preferences.
        delete data.user;
        delete data.userEncoding;
        delete data.sourceAppId;
        delete data.sourceAppManifestId;
        Object.assign(data, getAuditMetadata(app, Config.instance.userName));
    }

    return await executeWithStopwatchAsync(async () => {
        try {
            response.value = await https.send<T>(method, data);
            response.status = API_RESULT.SUCCESS;

            const appInfo = (response.value as any)?._appInfo;
            if (appInfo) {
                const { appId } = data;
                const { _log, ...consumptions } = appInfo;
                if (app && appId) {
                    NotificationsFromLog.instance.updateLog(appId, _log as EventLogEntry[], app.manifest.name, app.hash);
                    ConsumptionCache.instance.updateConsumption(appId, consumptions);
                }
            }
        } catch (error: any) {
            if (preprocessHttpStatusError(error)) {
                response.error = error;
                response.status = API_RESULT.ERROR_HANDLED;
                return response;
            }
            output.log(`Sending ${method} request to ${path} endpoint resulted in an error: ${JSON.stringify(error)}`);
            response.error = error;
            response.status = API_RESULT.ERROR_NOT_HANDLED;
            if (!errorHandler || !(await errorHandler(response, request))) {
                handleHttpErrorDefault(response, request);
            }
        }
        return response;
    }, `Sending ${method} request to ${path} endpoint`);
}
