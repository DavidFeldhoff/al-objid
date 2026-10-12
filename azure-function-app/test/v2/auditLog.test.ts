import { Mock } from "@vjeko.com/azure-func-test";
import { HttpMethod } from "@azure/functions";
import * as azure from "azure-storage";
import { Blob } from "@vjeko.com/azure-func";
import { createSign, generateKeyPairSync } from "crypto";
import { appendAuditLog, validateAuditMetadata } from "../../src/functions/v2/AuditLog";
import { ALNinjaRequestHandler } from "../../src/functions/v2/ALNinjaRequestHandler";
import { ALObjectType } from "../../src/functions/v2/ALObjectType";
import { AppInfo, AuditMetadata, LogEntry } from "../../src/functions/v2/TypesV2";
import { disableAuthorizeAppRateLimit, run as authorizeApp } from "../../src/functions/v2/authorizeApp";
import { disableGetNextRateLimit, run as getNext } from "../../src/functions/v2/getNext";
import { disableStoreAssignmentRateLimit, run as storeAssignment } from "../../src/functions/v2/storeAssignment";
import syncIds from "../../src/functions/v2/syncIds";
import autoSyncIds from "../../src/functions/v2/autoSyncIds";
import { StubStorage } from "../AzureTestLibrary/v2/Storage.stub";
import { initializeCustomMatchers } from "../AzureTestLibrary/CustomMatchers";

jest.mock("azure-storage");
Blob.injectCreateBlobService(azure.createBlobService);
Mock.initializeStorage(azure.createBlobService);
initializeCustomMatchers();
disableAuthorizeAppRateLimit();
disableGetNextRateLimit();
disableStoreAssignmentRateLimit();

const plain = { user: "Alice Example", userEncoding: "plain", sourceAppId: "audit-only-source" };
const ranges = [{ from: 50000, to: 50001 }];
const ids = { codeunit: [1, 1, 2], table_37: [3, 4], table_18: [5], enumextension_9: [] };
const invalidActors = [
    { user: 1 }, { user: null }, { user: [] }, { user: "x".repeat(257) },
    { userEncoding: "other" }, { userEncoding: null }, { userEncoding: 1 },
    { sourceAppId: 1 }, { sourceAppId: null }, { sourceAppId: {} },
];

let requestNumber = 0;
async function invoke(handler: any, method: string, body: any) {
    // Isolate callers rather than disabling production sync rate limiting.
    const context = new Mock.Context(new Mock.Request(method as HttpMethod, body, undefined, {
        "x-forwarded-for": `audit-test-${requestNumber++}`,
    }));
    await handler(context, context.req);
    return context;
}

function readApp(storage: StubStorage, appId = storage.appId): AppInfo {
    return storage.content[`${appId}.json`];
}

function useApp() {
    const storage = new StubStorage().app();
    Mock.useStorage(storage.content);
    return storage;
}

describe("Audit metadata and legacy compatibility", () => {
    it.each([{}, { user: "" }, { user: "x".repeat(256), userEncoding: "plain" },
        { user: "legacy-ciphertext" }, { userEncoding: "encrypted", sourceAppId: "" }])(
        "accepts optional metadata %j", actor => {
            expect(() => validateAuditMetadata(actor as AuditMetadata)).not.toThrow();
        });

    it.each([undefined, "encrypted", "plain"])("persists encoding %s without rewriting old entries", async encoding => {
        const storage = useApp();
        const legacy: LogEntry = { timestamp: Date.now() - 1000, eventType: "authorize", user: "old-ciphertext", data: {} };
        storage.appInfo._log = [legacy];
        const body = { appId: storage.appId, ids, user: "new-actor", sourceAppId: "origin", ...(encoding && { userEncoding: encoding }) };
        const context = await invoke(syncIds, "PATCH", body);
        expect(context.res).toBeStatus(200);
        const log = readApp(storage)._log;
        expect(log[0]).toEqual(legacy);
        expect(log[0]).not.toHaveProperty("userEncoding");
        expect(log[1]).toMatchObject({ user: "new-actor", sourceAppId: "origin", eventType: "syncMerge" });
        if (encoding) expect(log[1].userEncoding).toBe(encoding);
        else expect(log[1]).not.toHaveProperty("userEncoding");
        expect(body).not.toHaveProperty("_sourceAppId");
    });

    it("allows actor opt-out without stopping a successful mutation", async () => {
        const storage = useApp();
        const context = await invoke(syncIds, "POST", { appId: storage.appId, ids, userEncoding: "plain", sourceAppId: "origin" });
        expect(context.res).toBeStatus(200);
        expect(readApp(storage).codeunit).toEqual([1, 2]);
        expect(readApp(storage)._log).toEqual([]);
    });

    it("defaults to the body actor but honors an explicit actor with no user", async () => {
        const storage = useApp();
        const handler = new ALNinjaRequestHandler(async request => {
            const app = await new Blob<AppInfo>(`${request.body.appId}.json`).optimisticUpdate(app => {
                request.log(app, "authorize");
                request.log(app, "deauthorize", undefined, {});
                request.log(app, "addAssignment", undefined, { user: "override", userEncoding: "encrypted", sourceAppId: "folder" });
                return { ...app };
            });
            return { log: app._log };
        });
        handler.noRateLimit();
        const body = { appId: storage.appId, ...plain };
        const original = JSON.stringify(body);
        const context = await invoke(handler.azureFunction, "POST", body);
        expect(context.res).toBeStatus(200);
        expect(readApp(storage)._log).toHaveLength(2);
        expect(readApp(storage)._log[0]).toMatchObject(plain);
        expect(readApp(storage)._log[1]).toMatchObject({ user: "override", userEncoding: "encrypted", sourceAppId: "folder" });
        expect(JSON.stringify(body)).toBe(original);
    });

    it.each(invalidActors)("rejects invalid body metadata before a sync write: %j", async actor => {
        const storage = useApp();
        const before = JSON.stringify(storage.content);
        const context = await invoke(syncIds, "POST", { appId: storage.appId, ids, ...actor });
        expect(context.res).toBeStatus(400);
        expect(JSON.stringify(storage.content)).toBe(before);
        expect(context.bindings.notify).toBeUndefined();
    });
});

describe("Successful mutation events only", () => {
    it.each([
        ["authorize", authorizeApp, "POST", {}],
        ["deauthorize", authorizeApp, "DELETE", {}],
        ["getNext", getNext, "POST", { type: "codeunit", ranges }],
        ["addAssignment", storeAssignment, "POST", { type: "codeunit", id: 50000 }],
        ["removeAssignment", storeAssignment, "DELETE", { type: "codeunit", id: 50000 }],
        ["syncMerge", syncIds, "PATCH", { ids }],
        ["syncFull", syncIds, "POST", { ids }],
    ])("logs plaintext actor for %s", async (eventType, handler, method, payload) => {
        const storage = useApp();
        if (eventType === "deauthorize") storage.authorize();
        if (eventType === "removeAssignment") storage.setConsumption(ALObjectType.codeunit, [50000]);
        if (eventType === "syncFull") storage.appInfo._forceMerge = false;
        const context = await invoke(handler, method as string, { appId: storage.appId, authKey: storage.authKey, ...payload as any, ...plain });
        expect(context.res).toBeStatus(200);
        expect(readApp(storage)._log).toHaveLength(1);
        expect(readApp(storage)._log[0]).toMatchObject({ ...plain, eventType });
        expect(context.bindings.notify.appId).toBe(storage.appId);
    });

    it.each([
        [authorizeApp, "GET", {}],
        [getNext, "GET", { type: "codeunit", ranges }],
        [getNext, "POST", { type: "codeunit", ranges }],
        [storeAssignment, "POST", { type: "codeunit", id: 50000 }],
        [storeAssignment, "DELETE", { type: "codeunit", id: 59999 }],
    ])("does not append or prune for reads, exhausted ranges or assignment no-ops", async (handler, method, payload) => {
        const storage = useApp().setConsumption(ALObjectType.codeunit, [50000, 50001]);
        storage.appInfo._log = [{ timestamp: 1, user: "legacy", eventType: "getNext", data: {} }];
        const before = JSON.stringify(storage.content);
        const context = await invoke(handler, method as string, { appId: storage.appId, ...payload as any, ...plain });
        expect(context.res).toBeStatus(200);
        expect(JSON.stringify(storage.content)).toBe(before);
    });

    it.each([getNext, storeAssignment, syncIds])("does not log denied mutations", async handler => {
        const storage = useApp().authorize();
        const before = JSON.stringify(storage.content);
        const context = await invoke(handler, "POST", { appId: storage.appId, type: "codeunit", id: 50000, ranges, ids, ...plain });
        expect(context.res).toBeStatus(401);
        expect(JSON.stringify(storage.content)).toBe(before);
        expect(context.bindings.notify).toBeUndefined();
    });

    it.each([authorizeApp, getNext, storeAssignment])("validates actor before other mutation writes", async handler => {
        const storage = useApp();
        const before = JSON.stringify(storage.content);
        const context = await invoke(handler, "POST", { appId: storage.appId, type: "codeunit", id: 50000, ranges, ...plain, user: "x".repeat(257) });
        expect(context.res).toBeStatus(400);
        expect(JSON.stringify(storage.content)).toBe(before);
    });

    it("normalizes first and subsequent redirected getNext events", async () => {
        const storage = useApp();
        for (const id of [50000, 50001]) {
            const context = await invoke(getNext, "POST", { appId: storage.appId, type: "tableextension_37", redirectExtensions: true, ranges, ...plain });
            expect(context.res).toBeStatus(200);
            expect(readApp(storage)._log.slice(-1)[0].data).toEqual({ type: "tableextension_37", storageId: "table_37", id });
        }
    });

    it("keeps audit sourceAppId separate from signed pool authorization", async () => {
        const storage = useApp();
        const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
        storage.appInfo._pool = {
            appIds: ["member"],
            validationKey: { public: publicKey.export({ type: "spki", format: "der" }).toString("base64"), private: "" },
        } as AppInfo["_pool"];
        const payload = { appId: storage.appId, type: "codeunit", ranges };
        const _payload = JSON.stringify(payload);
        const sign = createSign("RSA-SHA256");
        sign.end(_payload);
        const _signature = sign.sign(privateKey, "base64");
        const before = JSON.stringify(storage.content);
        const denied = await invoke(getNext, "POST", { ...payload, _payload, _signature, ...plain });
        expect(denied.res).toBeStatus(400);
        expect(JSON.stringify(storage.content)).toBe(before);
        const accepted = await invoke(getNext, "POST", { ...payload, _payload, _signature, _sourceAppId: "member", ...plain });
        expect(accepted.res).toBeStatus(200);
        expect(readApp(storage)._log[0]).toMatchObject(plain);
        expect(readApp(storage)._log[0]).not.toHaveProperty("_sourceAppId");
    });
});

describe("Bounded sync events and folder actors", () => {
    it("summarizes submitted counts, including duplicates, without storage keys or arrays", async () => {
        const storage = useApp();
        const context = await invoke(syncIds, "PATCH", { appId: storage.appId, ids, ...plain });
        expect(context.res).toBeStatus(200);
        expect(readApp(storage)._log[0].data).toEqual({ origin: "manual", counts: { codeunit: 3, table: 3, enumextension: 0 } });
    });

    it.each(["same-pool", "different-pools"])("uses folder actors without inheritance in %s batches", async mode => {
        const storage = new StubStorage().app("pool-one").app("pool-two");
        for (const appId of ["pool-one", "pool-two"]) {
            readApp(storage, appId)._pool = { appIds: ["source-one", "source-two"] } as AppInfo["_pool"];
        }
        Mock.useStorage(storage.content);
        const secondPool = mode === "same-pool" ? "pool-one" : "pool-two";
        const body = { ...plain, appFolders: [
            { appId: "pool-one", ids: { codeunit: [1] }, user: "folder-one", userEncoding: "plain", sourceAppId: "source-one" },
            { appId: secondPool, ids: { codeunit: [2] }, user: "folder-two", userEncoding: "encrypted", sourceAppId: "source-two" },
            { appId: secondPool, ids: { codeunit: [3] }, sourceAppId: "opt-out" },
        ] };
        const beforeBody = JSON.stringify(body);
        const context = await invoke(autoSyncIds, "PATCH", body);
        expect(context.res).toBeStatus(200);
        const logs = mode === "same-pool" ? readApp(storage, "pool-one")._log : [
            ...readApp(storage, "pool-one")._log, ...readApp(storage, "pool-two")._log,
        ];
        expect(logs).toHaveLength(2);
        expect(logs[0]).toMatchObject({ user: "folder-one", userEncoding: "plain", sourceAppId: "source-one" });
        expect(logs[1]).toMatchObject({ user: "folder-two", userEncoding: "encrypted", sourceAppId: "source-two" });
        logs.forEach(entry => expect(entry.data).toEqual({ origin: "auto", counts: { codeunit: 1 } }));
        expect(readApp(storage, secondPool).codeunit).toContain(3);
        expect(JSON.stringify(body)).toBe(beforeBody);
    });

    it("retains unmarked legacy folder encoding and allows missing users in different apps", async () => {
        const storage = new StubStorage();
        Mock.useStorage(storage.content);
        const context = await invoke(autoSyncIds, "POST", { ...plain, appFolders: [
            { appId: "one", ids, user: "ciphertext" },
            { appId: "two", ids },
        ] });
        expect(context.res).toBeStatus(200);
        expect(readApp(storage, "one")._log[0].user).toBe("ciphertext");
        expect(readApp(storage, "one")._log[0]).not.toHaveProperty("userEncoding");
        expect(readApp(storage, "one")._log[0]).not.toHaveProperty("sourceAppId");
        expect(readApp(storage, "two")._log).toEqual([]);
    });

    it.each(invalidActors)("rejects later folder metadata before any batch writes: %j", async actor => {
        const storage = new StubStorage().app("one").app("two");
        Mock.useStorage(storage.content);
        const before = JSON.stringify(storage.content);
        const context = await invoke(autoSyncIds, "POST", { appFolders: [
            { appId: "one", ids, ...plain },
            { appId: "two", ids, ...actor },
        ] });
        expect(context.res).toBeStatus(400);
        expect(JSON.stringify(storage.content)).toBe(before);
        expect(context.bindings.notify).toBeUndefined();
    });

    it("rejects invalid batch-level metadata before folder writes", async () => {
        const storage = useApp();
        const before = JSON.stringify(storage.content);
        const context = await invoke(autoSyncIds, "PATCH", { userEncoding: false, appFolders: [{ appId: storage.appId, ids, ...plain }] });
        expect(context.res).toBeStatus(400);
        expect(JSON.stringify(storage.content)).toBe(before);
    });

    it("does not log a denied autoSync folder", async () => {
        const storage = useApp().authorize();
        const before = JSON.stringify(storage.content);
        const context = await invoke(autoSyncIds, "PATCH", { appFolders: [{ appId: storage.appId, ids, ...plain }] });
        expect(context.res).toBeStatus(401);
        expect(JSON.stringify(storage.content)).toBe(before);
    });
});

describe("Seven-day retention and newest-10k cap", () => {
    const now = 2000000000000;
    const cutoff = now - 7 * 24 * 60 * 60 * 1000;
    let clock: jest.SpyInstance;
    beforeEach(() => { clock = jest.spyOn(Date, "now").mockReturnValue(now); });
    afterEach(() => { clock.mockRestore(); });

    it("prunes only expired events while retaining legacy entries beyond four hours", async () => {
        const storage = useApp();
        const legacy = { timestamp: now - 6 * 24 * 60 * 60 * 1000, eventType: "authorize", user: "ciphertext", data: {} };
        storage.appInfo._log = [
            { ...legacy, timestamp: cutoff - 1 }, { ...legacy, timestamp: cutoff },
            legacy, { ...legacy, timestamp: cutoff + 1 },
        ];
        const context = await invoke(syncIds, "PATCH", { appId: storage.appId, ids, ...plain });
        expect(context.res).toBeStatus(200);
        expect(readApp(storage)._log.map(entry => entry.timestamp)).toEqual([cutoff + 1, legacy.timestamp, now]);
        expect(readApp(storage)._log[1]).toEqual(legacy);
    });

    it("caps out-of-order entries by newest timestamp within the optimistic mutation", async () => {
        const storage = useApp();
        storage.appInfo._log = Array.from({ length: 10050 }, (_, i) => ({
            timestamp: now - 10050 + i, user: "legacy", eventType: "syncMerge", data: { i },
        })).reverse();
        const context = await invoke(syncIds, "PATCH", { appId: storage.appId, ids, ...plain });
        expect(context.res).toBeStatus(200);
        const log = readApp(storage)._log;
        expect(log).toHaveLength(10000);
        expect(log[0].data.i).toBe(51);
        expect(log[9998].data.i).toBe(10049);
        expect(log[9999]).toMatchObject(plain);
        expect(log.every((entry, index) => !index || entry.timestamp >= log[index - 1].timestamp)).toBe(true);
    });

    it("prunes/caps on successful opt-out writes without adding an actorless event", () => {
        const app = { _log: Array.from({ length: 10001 }, (_, i) => ({
            timestamp: now - 20000 + i, user: "legacy", eventType: "authorize", data: { i },
        })) } as AppInfo;
        app._log.push({ timestamp: cutoff, user: "expired", eventType: "authorize", data: {} });
        appendAuditLog(app, "syncMerge", undefined, {});
        expect(app._log).toHaveLength(10000);
        expect(app._log[0].data.i).toBe(1);
        expect(app._log.every(entry => entry.user === "legacy")).toBe(true);
    });

    it("keeps the newest equal-timestamp entries including the appended event", () => {
        const app = { _log: Array.from({ length: 10000 }, (_, i) => ({
            timestamp: now, user: "legacy", eventType: "authorize", data: { i },
        })) } as AppInfo;
        appendAuditLog(app, "authorize", undefined, plain as AuditMetadata);
        expect(app._log).toHaveLength(10000);
        expect(app._log[0].data.i).toBe(1);
        expect(app._log[9999]).toMatchObject(plain);
    });
});