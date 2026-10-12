import * as assert from "assert";
import { getAuditMetadata } from "../../lib/backend/AuditMetadata";

suite("Unconditional event identity", () => {
    test("includes plaintext identity and originating app", () => {
        assert.deepStrictEqual(getAuditMetadata({ hash: "origin", manifest: { publisher: "Partner" } }, "Alice"), {
            user: "Alice", userEncoding: "plain", sourceAppId: "origin",
        });
    });

    test("includes identity for protected publishers", () => {
        assert.deepStrictEqual(getAuditMetadata({ hash: "origin", manifest: { publisher: "Microsoft" } }, "Bob"), {
            user: "Bob", userEncoding: "plain", sourceAppId: "origin",
        });
    });

    test("includes identity even without local app context", () => {
        assert.deepStrictEqual(getAuditMetadata(undefined, "Alice"), { user: "Alice", userEncoding: "plain" });
    });
});