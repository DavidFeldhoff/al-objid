import * as assert from "assert";
import { getAuditMetadata } from "../../lib/backend/AuditMetadata";

suite("Unconditional event identity", () => {
    test("includes plaintext identity and originating app", () => {
        assert.deepStrictEqual(getAuditMetadata({ hash: "origin", manifest: { id: "11111111-1111-1111-1111-111111111111", publisher: "Partner" } }, "Alice"), {
            user: "Alice", userEncoding: "plain", sourceAppId: "origin", sourceAppManifestId: "11111111-1111-1111-1111-111111111111",
        });
    });

    test("includes identity for protected publishers", () => {
        assert.deepStrictEqual(getAuditMetadata({ hash: "origin", manifest: { id: "22222222-2222-2222-2222-222222222222", publisher: "Microsoft" } }, "Bob"), {
            user: "Bob", userEncoding: "plain", sourceAppId: "origin", sourceAppManifestId: "22222222-2222-2222-2222-222222222222",
        });
    });

    test("includes identity even without local app context", () => {
        assert.deepStrictEqual(getAuditMetadata(undefined, "Alice"), { user: "Alice", userEncoding: "plain" });
    });
});