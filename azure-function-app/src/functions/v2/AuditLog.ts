import { ErrorResponse } from "@vjeko.com/azure-func";
import { AppInfo, AuditMetadata, ChangeOperation } from "./TypesV2";

const RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_ENTRIES = 10000;

// Missing usernames use a plaintext fallback. Supplied unmarked users remain legacy ciphertext.
export function validateAuditMetadata(actor: AuditMetadata = {}): void {
    if (actor.user !== undefined && (typeof actor.user !== "string" || actor.user.length > 256)) {
        throw new ErrorResponse("user must be a string of at most 256 characters", 400);
    }
    if (actor.userEncoding !== undefined && actor.userEncoding !== "plain" && actor.userEncoding !== "encrypted") {
        throw new ErrorResponse("userEncoding must be plain or encrypted", 400);
    }
    if (actor.sourceAppId !== undefined && typeof actor.sourceAppId !== "string") {
        throw new ErrorResponse("sourceAppId must be a string", 400);
    }
    if (actor.sourceAppManifestId !== undefined && typeof actor.sourceAppManifestId !== "string") {
        throw new ErrorResponse("sourceAppManifestId must be a string", 400);
    }
}

// Called only from mutation callbacks, so event and retention share the optimistic write.
export function appendAuditLog(app: AppInfo, eventType: ChangeOperation, data: any, actor: AuditMetadata = {}): void {
    const timestamp = Date.now();
    const log = (app._log || []).filter(entry => entry.timestamp > timestamp - RETENTION_MS);
    const userEncoding = actor.user ? actor.userEncoding : "plain";
    log.push({
        timestamp,
        eventType,
        user: actor.user || "Unknown user",
        ...(userEncoding !== undefined && { userEncoding }),
        ...(actor.sourceAppId !== undefined && { sourceAppId: actor.sourceAppId }),
        ...(actor.sourceAppManifestId !== undefined && { sourceAppManifestId: actor.sourceAppManifestId }),
        data,
    });
    app._log = log.sort((left, right) => left.timestamp - right.timestamp).slice(-MAX_ENTRIES);
}