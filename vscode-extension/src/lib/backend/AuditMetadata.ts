export interface AuditMetadata {
    user?: string;
    userEncoding?: "plain" | "encrypted";
    sourceAppId?: string;
}

interface AuditApp {
    hash: string;
    manifest: { publisher: string };
}

/** The actor is the originating app, never an arbitrary member of a shared pool. */
export function getAuditMetadata(app: AuditApp | undefined, userName: string): AuditMetadata {
    return { user: userName, userEncoding: "plain", ...(app && { sourceAppId: app.hash }) };
}