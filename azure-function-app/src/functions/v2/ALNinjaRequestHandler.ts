import { ErrorResponse, RequestHandler } from "@vjeko.com/azure-func";
import { injectValidators } from "./injectValidators";
import { ALNinjaRequestContext, AppBindings, AppInfo, AuditMetadata, DefaultBindings } from "./TypesV2";
import { validatePoolSignature } from "./ValidatePoolSignature";
import { appendAuditLog, validateAuditMetadata } from "./AuditLog";

injectValidators();

interface AppIdBody extends AuditMetadata {
    appId: string;
    authKey?: string;
}

interface PoolBody {
    _sourceAppId: string;
    _payload: string;
    _signature: string;
}

type ALNinjaBindings<T> = AppBindings & T;
type ALNinjaRequest<T> = AppIdBody & PoolBody & T;

interface ALNinjaHandlerFunc<TRequest, TResponse, TBindings> {
    (context: ALNinjaRequestContext<ALNinjaRequest<TRequest>, ALNinjaBindings<TBindings>>): Promise<TResponse>;
}

export class ALNinjaRequestHandler<TRequest, TResponse, TBindings = DefaultBindings>
    extends RequestHandler<ALNinjaRequest<TRequest>, TResponse, ALNinjaBindings<TBindings>> {
    private _skipAuthorization: boolean = false;
    private _notForPools: string[] = [];
    private _bound: boolean = false;
    private _requirePoolSignature: boolean = false;
    private _requireManagementSignature: boolean = false;
    private _requireSourceAppIdMatch: boolean = false;

    public constructor(handler: ALNinjaHandlerFunc<TRequest, TResponse, TBindings>, withValidation: boolean = true) {
        super(async (request) => {
            const alNinjaRequest = (request as unknown as ALNinjaRequestContext<TRequest, TBindings>);
            validateAuditMetadata(request.body);
            alNinjaRequest.log = (app, eventType, data, actor) => {
                appendAuditLog(app, eventType, data, actor === undefined ? request.body : actor);
            };
            let appUpdated: AppInfo | null = null;
            alNinjaRequest.markAsChanged = (appId, app, authorization) => {
                appUpdated = app;
                const payload: any = { appId };
                if (authorization) {
                    payload.authorization = authorization;
                }
                request.rawContext.bindings.notify = payload;
            };

            if (!this._bound) {
                await request.bind();
                this._bound = true;
            }
            const { app } = request.bindings;

            if (app && app._pool) {
                if (this._notForPools.includes("*") || this._notForPools.includes(request.method.toUpperCase())) {
                    throw new ErrorResponse(`Cannot perform this operation on a pool`, 403);
                }

                if (this._requirePoolSignature || this._requireManagementSignature) {
                    const { _payload, _signature } = request.body;
                    if (!_payload || !_signature) {
                        throw new ErrorResponse(`Signature required when performing this operation on a pool`, 403);
                    }
                    const key = this._requireManagementSignature ? app._pool.managementKey.public : app._pool.validationKey.public;
                    const valid = validatePoolSignature(key, _payload, _signature);
                    if (!valid) {
                        throw new ErrorResponse(`Invalid signature`, 403);
                    }
                }

                if (this._requireSourceAppIdMatch) {
                    const { _sourceAppId } = request.body;
                    if (!_sourceAppId) {
                        throw new ErrorResponse("Missing _sourceAppId property", 400);
                    }
                    if (!app._pool.appIds.includes(_sourceAppId)) {
                        throw new ErrorResponse(`Source app is not authorized to perform this operation`, 403);
                    }
                }
            }

            const response = await handler(request as any);

            if (appUpdated) {
                const { _authorization, _ranges, _forceMerge, ...appInfo } = appUpdated;
                (response as any)._appInfo = appInfo;
            }
            return response;
        });

        this.onAuthorization(async (req) => {
            if (this._skipAuthorization) {
                return true;
            }

            if (!req.body.appId) {
                /*
                We cannot treat requests without appId as unauthorized!
                If there is something wrong with these requests, these apply:
                - They will fail validation (if appId is required)
                - Actual function handler should take care of these requests
                */
                return true;
            }

            await req.bind();
            this._bound = true;

            const { app } = req.bindings;

            if (!app || !app._authorization || !app._authorization.valid) {
                return true;
            }

            return req.body.authKey === app._authorization.key;
        });

        this.bind("{appId}.json").to("app");

        if (withValidation) {
            this.validator.expect("body", {
                "appId": "string"
            });
        }
    }

    public skipAuthorization() {
        this._skipAuthorization = true;
    }

    public notForPools(...method: string[]) {
        this._notForPools.push(...(method.map(m => m.toUpperCase())));
    }

    public requirePoolSignature() {
        this._requirePoolSignature = true;
    }

    public requireManagementSignature() {
        this._requireManagementSignature = true;
    }

    public requireSourceAppIdMatch() {
        this._requireSourceAppIdMatch = true;
    }
}
