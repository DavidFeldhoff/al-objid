import { readFileSync, statSync } from "fs";
import { ParseError, parse } from "jsonc-parser";
import * as xml2js from "xml2js";
import { NavxManifest } from "./NavxManifest";
import { SymbolReferenceRoot } from "./SymbolReferenceSchema";
import JSZip = require("jszip");

export class ALAppPackage {
    private _manifest!: NavxManifest;
    private _symbolReference!: SymbolReferenceRoot;
    private _fsPath!: string;
    private _fileLastModified!: Date
    private constructor(manifest: NavxManifest, symbolReferenceSchema: SymbolReferenceRoot, fsPath: string, fileLastModified: Date) {
        this.assignProperties(manifest, symbolReferenceSchema, fsPath, fileLastModified);
    }
    private assignProperties(manifest: NavxManifest, symbolReference: SymbolReferenceRoot, fsPath: string, fileLastModified: Date) {
        this._manifest = manifest;
        this._symbolReference = symbolReference;
        this._fsPath = fsPath;
        this._fileLastModified = fileLastModified;
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
                console.log(`Json parse of ${dependencyFileFullPath} successful, but with errors: ${errors.length}.`);
                errors.forEach(error => console.log(error));
            }
            return new ALAppPackage(manifest, symbolReference, dependencyFileFullPath, statSync(dependencyFileFullPath).mtime);
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
}