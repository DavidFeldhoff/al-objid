import { readFileSync, statSync } from "fs";
import { ParseError, parse } from "jsonc-parser";
import * as xml2js from "xml2js";
import { NavxManifest } from "./NavxManifest";
import { SymbolReferenceNamespace, SymbolReferenceObject, SymbolReferenceRoot } from "./SymbolReferenceSchema";
import * as JSZip from 'jszip';
import { output } from "../../features/Output";
import { stringify } from "comment-json";
import { ALObjectType } from "@vjeko.com/al-parser-types-ninja";

export class ALAppPackage {
    private _manifest!: NavxManifest;
    private _symbolReference!: SymbolReferenceRoot;
    private _fsPath!: string;
    private _fileLastModified!: Date;
    private _flattenedCache: { type: ALObjectType, id: number, name: string, namespace: string }[] = [];
    private constructor(manifest: NavxManifest, symbolReferenceSchema: SymbolReferenceRoot, fsPath: string, fileLastModified: Date) {
        this.assignProperties(manifest, symbolReferenceSchema, fsPath, fileLastModified);
    }
    private assignProperties(manifest: NavxManifest, symbolReference: SymbolReferenceRoot, fsPath: string, fileLastModified: Date) {
        this._manifest = manifest;
        this._symbolReference = symbolReference;
        this._fsPath = fsPath;
        this._fileLastModified = fileLastModified;
        this._flattenedCache = [];
    }
    public get manifest() {
        return this._manifest;
    }
    public get appId() {
        return this.manifest.Package.App[0].$.Id;
    }
    public get version() {
        return this.manifest.Package.App[0].$.Version;
    }
    public get symbolReference() {
        return this._symbolReference;
    }
    public get fsPath() {
        return this._fsPath;
    }
    public get isOutdated(): boolean {
        return this._fileLastModified < statSync(this._fsPath).mtime;
    }
    public async reloadIfOutdated(): Promise<ALAppPackage> {
        if (!this.isOutdated) {
            return this;
        }
        const newAppPackage = await ALAppPackage.tryCreate(this._fsPath);
        if (newAppPackage) {
            this.assignProperties(newAppPackage.manifest, newAppPackage.symbolReference, newAppPackage.fsPath, newAppPackage._fileLastModified);
        }
        return this;
    }

    public static async tryCreate(dependencyFileFullPath: string): Promise<ALAppPackage | undefined> {
        const data = readFileSync(dependencyFileFullPath);
        try {
            const zip = await JSZip.loadAsync(data);

            const manifest = await this.loadManifest(zip);
            if (!manifest) {
                return;
            }
            const symbolReferenceJson = zip.file("SymbolReference.json");
            if (symbolReferenceJson) {
                const content = await symbolReferenceJson.async("string");
                let errors: ParseError[] = [];
                const symbolReference = parse(content, errors, { allowEmptyContent: true, allowTrailingComma: true, disallowComments: false }) as SymbolReferenceRoot;
                if (errors.length > 0) {
                    output.log(`Json parse of ${dependencyFileFullPath} successful, but with errors: ${errors.length}.`);
                    errors.forEach(error => output.log(stringify(error)));
                }
                return new ALAppPackage(manifest, symbolReference, dependencyFileFullPath, statSync(dependencyFileFullPath).mtime);
            }
        } catch {
            output.log(`Loading dependency file failed: ${dependencyFileFullPath}`);
            return undefined;
        }
    }
    private static async loadManifest(zip: JSZip): Promise<NavxManifest | undefined> {
        const manifestFile = zip.file("NavxManifest.xml");
        if (!manifestFile) {
            return;
        }
        const manifestContent = await manifestFile.async("string");
        let manifest: NavxManifest | undefined;
        xml2js.parseString(manifestContent, (error, result) => {
            if (!error) {
                manifest = result as NavxManifest;
            }
        });


        return manifest;
    }
    public flattenDependencies(objectsOfInterest: ALObjectType[]): { type: ALObjectType, id: number, name: string, namespace: string }[] {
        const cachedResult = this._flattenedCache.filter(obj => objectsOfInterest.includes(obj.type));
        const uncachedObjectsOfInterest = objectsOfInterest.filter(obj => !this._flattenedCache.some(cached => cached.type === obj));
        let objectsOfInterest2: string[] = uncachedObjectsOfInterest.map(obj => this.objectTypeToSymbolReferenceType(obj));
        const uncachedResults = this.flattenDependenciesImpl(this.symbolReference, "", objectsOfInterest2);
        this._flattenedCache.push(...uncachedResults);
        return [...cachedResult, ...uncachedResults];
    }
    private flattenDependenciesImpl(symbolReference: SymbolReferenceRoot | SymbolReferenceNamespace, currentNamespace: string, objectsOfInterest: string[]): { type: ALObjectType, id: number, name: string, namespace: string }[] {
        const objects = [];
        for (const key of Object.keys(symbolReference)) {
            if (objectsOfInterest.includes(key)) {
                const objs = (symbolReference as unknown as unknown[])[key as keyof unknown[]] as SymbolReferenceObject[];
                objs.forEach(obj => {
                    const type = this.symbolReferenceTypeToObjectType(key);
                    if (type) {
                        objects.push({ type, id: obj.Id, name: obj.Name, namespace: currentNamespace });
                    }
                });
            }
        }
        const namespaces = symbolReference.Namespaces || [];
        for (const namespace of namespaces) {
            objects.push(...this.flattenDependenciesImpl(namespace, `${currentNamespace === "" ? "" : `${currentNamespace}.`}${namespace.Name}`, objectsOfInterest));
        }
        return objects;
    }
    private objectTypeToSymbolReferenceType(alObjectType: ALObjectType) {
        switch (alObjectType) {
            case ALObjectType.table:
                return "Tables";
            case ALObjectType.codeunit:
                return "Codeunits";
            case ALObjectType.page:
                return "Pages";
            case ALObjectType.report:
                return "Reports";
            case ALObjectType.xmlport:
                return "XmlPorts";
            case ALObjectType.query:
                return "Queries";
            case ALObjectType.controladdin:
                return "ControlAddIns";
            case ALObjectType.enum:
                return "EnumTypes";
            case ALObjectType.dotnet:
                return "DotNetPackages";
            case ALObjectType.interface:
                return "Interfaces";
            case ALObjectType.permissionset:
                return "PermissionSets";
            case ALObjectType.permissionsetextension:
                return "PermissionSetExtensions";
            case ALObjectType.reportextension:
                return "ReportExtensions";
            default:
                return "";
        }
    }
    private symbolReferenceTypeToObjectType(symbolReferenceTyp: string): ALObjectType | undefined {
        switch (symbolReferenceTyp) {
            case "Tables":
                return ALObjectType.table;
            case "Codeunits":
                return ALObjectType.codeunit;
            case "Pages":
                return ALObjectType.page;
            case "Reports":
                return ALObjectType.report;
            case "XmlPorts":
                return ALObjectType.xmlport;
            case "Queries":
                return ALObjectType.query;
            case "ControlAddIns":
                return ALObjectType.controladdin;
            case "EnumTypes":
                return ALObjectType.enum;
            case "DotNetPackages":
                return ALObjectType.dotnet;
            case "Interfaces":
                return ALObjectType.interface;
            case "PermissionSets":
                return ALObjectType.permissionset;
            case "PermissionSetExtensions":
                return ALObjectType.permissionsetextension;
            case "ReportExtensions":
                return ALObjectType.reportextension;
            default:
                return undefined;
        }
    }
}