import * as path from "path";
import * as fs from "fs";
import { Disposable, EventEmitter, Uri, WorkspaceFolder, extensions, workspace } from "vscode";
import { getSha256 } from "./functions/getSha256";
import { ALAppManifest } from "./ALAppManifest";
import { ObjIdConfig } from "./ObjIdConfig";
import { APP_FILE_NAME, CONFIG_FILE_NAME, MSFT_EXTENSION_ID } from "./constants";
import { output } from "../features/Output";
import { FileWatcher } from "./FileWatcher";
import { ObjIdConfigWatcher } from "./ObjectIdConfigWatcher";
import { decrypt, encrypt } from "./Encryption";
import { BackEndAppInfo } from "./backend/BackEndAppInfo";
import { Telemetry, TelemetryEventType } from "./Telemetry";
import { AssigmentMonitor } from "../features/AssignmentMonitor";
import { WorkspaceManager } from "../features/WorkspaceManager";
import { parse } from "comment-json";
import { ALAppPackage } from "./types/ALAppPackage";
import versionCompare from "version-compare";
import { executeWithStopwatchAsync } from "./MeasureTime";

export class ALApp implements Disposable, BackEndAppInfo {
    private readonly _uri: Uri;
    private readonly _configUri: Uri;
    private readonly _name: string;
    private readonly _assignmentMonitor: AssigmentMonitor;
    private readonly _manifestWatcher: FileWatcher;
    private readonly _manifestChanged: Disposable;
    private readonly _configWatcher: ObjIdConfigWatcher;
    private readonly _onManifestChanged = new EventEmitter<ALApp>();
    private readonly _onConfigChanged = new EventEmitter<ALApp>();
    private readonly _packageCachePaths: string[];
    public readonly onManifestChanged = this._onManifestChanged.event;
    public readonly onConfigChanged = this._onConfigChanged.event;
    private _loadAllDependenciesPromise: Promise<ALAppPackage[]> | undefined = undefined;
    private _dependencies: ALAppPackage[] = [];
    private _diposed = false;
    private _manifest: ALAppManifest;
    private _config: ObjIdConfig;
    private _hash: string | undefined;
    private _encryptionKey: string | undefined;

    private constructor(uri: Uri, name: string, manifest: ALAppManifest) {
        this._uri = uri;
        this._manifest = manifest;
        this._name = name;
        this._configUri = Uri.file(path.join(uri.fsPath, CONFIG_FILE_NAME));
        this._config = this.createObjectIdConfig();
        this._packageCachePaths = this.getPackageCachePathsFromConfig();

        this._manifestWatcher = new FileWatcher(manifest.uri);
        this._manifestChanged = this._manifestWatcher.onChanged(() => this.onManifestChangedFromWatcher());

        this._configWatcher = new ObjIdConfigWatcher(
            this._config,
            () => this,
            () => {
                const newConfig = this.setUpConfigFile();
                this._onConfigChanged.fire(this);
                return newConfig;
            }
        );

        this._assignmentMonitor = new AssigmentMonitor(uri, this._config.appPoolId || this.hash);
        this.loadAllDependencies();
    }
    private getPackageCachePathsFromConfig(): string[] {
        const settingsJsonPath = path.join(this.uri.fsPath, ".vscode", "settings.json");
        if (fs.existsSync(settingsJsonPath)) {
            const content = fs.readFileSync(settingsJsonPath).toString() || "{}";
            const settingsJson = parse(content) as Record<string, any>;
            if (settingsJson["al.packageCachePath"]) {
                const packageCachePath = settingsJson["al.packageCachePath"];
                return Array.isArray(packageCachePath) ?
                    packageCachePath :
                    [packageCachePath];
            }
        }
        if (workspace.workspaceFile) {
            const content = fs.readFileSync(workspace.workspaceFile.fsPath).toString() || "{}";
            const workspaceSettingsJson = parse(content) as Record<string, any>;
            if (workspaceSettingsJson["settings"] && workspaceSettingsJson["settings"]["al.packageCachePath"]) {
                const packageCachePath = workspaceSettingsJson["settings"]["al.packageCachePath"] as string[];
                return Array.isArray(packageCachePath) ? packageCachePath : [packageCachePath];
            }
        }
        return extensions.getExtension(MSFT_EXTENSION_ID)?.packageJSON.contributes?.configuration?.properties['al.packageCachePath']?.default || ["./.alpackages "]
    }

    private createObjectIdConfig(): ObjIdConfig {
        const objIdConfig = new ObjIdConfig(this._configUri, this);
        this.logTelemetryFeatures(objIdConfig);
        return objIdConfig;
    }

    private logTelemetryFeatures(objIdConfig: ObjIdConfig): void {
        const features: string[] = [];
        if (objIdConfig.idRanges.length > 0) {
            features.push("logicalRanges");
        }
        if (objIdConfig.objectTypesSpecified.length > 0) {
            features.push("objectRanges");
        }
        if (objIdConfig.appPoolId?.trim()) {
            features.push("appPoolId");
        }
        if (objIdConfig.bcLicense?.trim()) {
            features.push("bcLicense");
        }
        if (features.length) {
            // TODO This is a stupid way to address problems explained deeper in #41 and #42
            /*
            The problem is that during app initialization, at this point the WorkspaceManager instance in creation has
            not yet been assigned to the singleton instance property, but WorkspaceManager.instance will be accessed from
            call stack of checkApp function in Backend, that happens during processing of telemetry.
            This would not be a problem if #41 and #42 were done. Then, telemetry would send ALApp instance, rather than
            app hash, and checkApp function would not need to access WorkspaceManager.instance or check for app pool.

            Once #41 and #42 are solved, refactor this one, too.
            */
            setTimeout(() => {
                Telemetry.instance.logOnceAndNeverAgain(TelemetryEventType.FeatureInUse, this, { features });
            }, 2000);
        }
    }

    private onManifestChangedFromWatcher() {
        output.log(`Change detected on ${this._manifest.uri.fsPath}`);
        const manifest = ALAppManifest.tryCreate(this._manifest.uri);
        if (!manifest) {
            // This can only mean that the new manifest is not a valid JSON that we can parse.
            // Until it is edited again, and parsable again, we keep the old manifest in memory.
            return;
        }

        const oldId = this._manifest.id;
        this._manifest = manifest;
        if (manifest.id !== oldId) {
            output.log(`Manifest id changed from ${oldId} to ${manifest.id}, resetting hash and encryption key.`);
            this._hash = undefined;
            this._encryptionKey = undefined;
            this._configWatcher.updateConfigAfterAppIdChange(this.setUpConfigFile());
        }
        this._onManifestChanged.fire(this);
    }

    private setUpConfigFile(): ObjIdConfig {
        return (this._config = this.createObjectIdConfig());
    }

    public static tryCreate(folder: WorkspaceFolder): ALApp | undefined {
        const uri = folder.uri;
        const manifestUri = Uri.file(path.join(uri.fsPath, APP_FILE_NAME));
        if (!fs.existsSync(manifestUri.fsPath)) {
            return;
        }

        const manifest = ALAppManifest.tryCreate(manifestUri);
        return manifest && new ALApp(uri, folder.name, manifest);
    }

    /**
     * URI of the folder (root) of this AL app.
     */
    public get uri(): Uri {
        return this._uri;
    }

    public get name(): string {
        return this._name;
    }

    /**
     * App manifest (`app.json`) representation as an object. This object is read-only.
     */
    public get manifest(): ALAppManifest {
        return this._manifest;
    }

    /**
     * Ninja config file (`.objidconfig`) representation as an object. This object is read/write.
     * Any changes you make to its public properties will be persisted to the underlying
     * `.objidconfig` file.
     */
    public get config(): ObjIdConfig {
        return this._config;
    }

    /**
     * SHA256 hash of the app ID (the `id` property from `app.json`). This property is needed for
     * identifying the app for most purposes throughout Ninja.
     */
    public get hash() {
        return this._hash || (this._hash = getSha256(this._manifest.id));
    }

    /**
     * Returns app pool ID that this app belongs to. If the hash does not belong
     * to a pool, then the same as `hash` is returned.
     * @returns Pool ID of the pool, if the specified app belongs to a pool; otherwise the app hash is returned
     */
    public get appId() {
        return WorkspaceManager.instance.getPoolIdFromAppIdIfAvailable(this.hash);
    }

    /**
     * Returns the `authKey` property from the `.objidconfig` file. This property is here to implement BackEndAppInfo.
     */
    public get authKey(): string {
        return this._config.authKey;
    }

    /**
     * Loads all .app files of the packageCachePaths of this app. 
     * In the best case it simply returns these from the workspace cache, but it might also update the cache if necessary.
     * @returns Infos of the .app-packages of the dependencies of this app while making use of a workspace dependency cache.
     */
    private async loadAllDependencies(): Promise<ALAppPackage[]> {
        if (this._loadAllDependenciesPromise)
            return this._loadAllDependenciesPromise;
        this._loadAllDependenciesPromise = executeWithStopwatchAsync(
            () => WorkspaceManager.instance.loadDependencyPackages(this),
            `Start loading dependency packages for ${this.name}`
        );
        this._loadAllDependenciesPromise.then(() => { this._loadAllDependenciesPromise = undefined; });
        return this._loadAllDependenciesPromise;
    }

    /**
     * Returns the highest version of each dependency of this app.
     * @returns the highest version of each dependency of this app.
     */
    public async getDependencies(): Promise<ALAppPackage[]> {
        const invalidCache = this._dependencies.some(dep => dep.isOutdated) ||
            this.dependencyPackageUris.some(uri => !this._dependencies.some(dep => dep.fsPath === uri.fsPath));
        if (invalidCache) {
            this._dependencies = await executeWithStopwatchAsync(
                () => this.loadAllDependencies(),
                `Load dependencies for ${this.name}`
            );
        }
        const appPackages = this._dependencies.filter(appPackage => appPackage !== undefined) as ALAppPackage[];

        const dependencies: ALAppPackage[] = []
        const uniqueApps = new Set(appPackages.map(p => p.appId))
        uniqueApps.forEach(appId => {
            const appVersions = appPackages.filter(p => p.appId === appId)
            const latestVersion = appVersions.reduce((prev, current) => versionCompare(prev.version, current.version) >= 0 ? prev : current)
            dependencies.push(latestVersion)
        });
        return dependencies;
    }
    public get dependencyPackageUris(): Uri[] {
        const uris: Uri[] = [];
        for (const packageCachePath of this.packageCachePaths) {
            const packageUri = path.isAbsolute(packageCachePath) ? Uri.file(packageCachePath) : Uri.file(path.join(this.uri.fsPath, packageCachePath));
            if (fs.existsSync(packageUri.fsPath))
                for (const file of fs.readdirSync(packageUri.fsPath, { withFileTypes: true }))
                    if (file.isFile() && file.name.endsWith(".app"))
                        uris.push(Uri.file(path.join(packageUri.fsPath, file.name)));
        }
        return uris;
    }

    /**
     * Encryption key of the app ID, to be used for encrypting potentially sensitive information
     * during back-end communication. Never send
     */
    public get encryptionKey() {
        if (this._encryptionKey) {
            return this._encryptionKey;
        }

        const key = getSha256(this._manifest.id.replace("-", ""));
        const first = key[0];
        const numeric = parseInt(first, 16);
        this._encryptionKey = key.substring(numeric, numeric + 32);
        return this._encryptionKey;
    }

    /**
     * Returns the package cache path(s) for this app. If the path is not specified in the app settings or in the workspace settings
     * the default path is returned.
     */
    public get packageCachePaths(): string[] {
        return this._packageCachePaths;
    }

    /**
     * Returns the assignment monitor instance for this app.
     */
    public get assignmentMonitor(): AssigmentMonitor {
        return this._assignmentMonitor;
    }

    /**
     * Encrypts a string using the app encryption key.
     * @param value String to encrypt
     * @returns Encrypted string (or `undefined` if encryption failed)
     */
    public encrypt(value: string): string | undefined {
        return encrypt(value, this.encryptionKey);
    }

    /**
     * Decrypts a string using the app encryption key.
     * @param value String to decrypt
     * @returns Decrypted string (or `undefined` if decryption failed)
     */
    public decrypt(value: string): string | undefined {
        return decrypt(value, this.encryptionKey);
    }

    /**
     * Checks if this ALApp instance represents the specified workspace folder.
     * @param folder Workspace folder for which to check if this ALApp instance represents it.
     * @returns Boolean value indicating whether this ALApp instance represents the specified workspace folder.
     */
    public isFolder(folder: WorkspaceFolder): boolean {
        return folder.uri.fsPath == this._uri.fsPath;
    }

    public dispose() {
        if (this._diposed) {
            return;
        }
        this._diposed = true;
        this._manifestChanged.dispose();
        this._manifestWatcher.dispose();
        this._configWatcher.dispose();
        this._onManifestChanged.dispose();
        this._onConfigChanged.dispose();
    }
}
