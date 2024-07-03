import * as fs from "fs";
import { Uri } from "vscode";
import { ALRange } from "./types/ALRange";
import { NavxManifest } from "./types/NavxManifest";
import JSZip = require("jszip");
import * as xml2js from "xml2js";

interface ALAppJson {
    id: string;
    name: string;
    publisher: string;
    version: string;
    idRanges: ALRange[];
    preprocessorSymbols: string[];
}

export class ALAppManifest {
    private readonly _uri: Uri;
    private readonly _manifest: ALAppJson;

    private constructor(uri: Uri, manifest: ALAppJson) {
        this._uri = uri;
        this._manifest = manifest;
    }

    public static tryCreate(uri: Uri): ALAppManifest | undefined {
        try {
            const contents = fs.readFileSync(uri.fsPath).toString();
            const appObj = JSON.parse(contents.replace(/^\uFEFF/, ""));

            const expectProperty = (property: string, type = "string") =>
                appObj.hasOwnProperty(property) && typeof appObj[property] === type;
            if (!expectProperty("id") || !expectProperty("name") || !expectProperty("version")) {
                return;
            }

            if (!appObj.idRanges && appObj.idRange) {
                appObj.idRanges = [appObj.idRange];
            }
            if (!expectProperty("idRanges", "object")) {
                return;
            }

            return new ALAppManifest(uri, appObj);
        } catch {
            return;
        }
    }

    public static async tryCreateFromAppPackage(appPackageUri: Uri) {

        const data = fs.readFileSync(appPackageUri.fsPath);
        const zip = await JSZip.loadAsync(data);
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
        return manifest && new ALAppManifest(appPackageUri,
            {
                id: manifest.Package.App[0].$.Id,
                name: manifest.Package.App[0].$.Name,
                publisher: manifest.Package.App[0].$.Publisher,
                version: manifest.Package.App[0].$.Version,
                idRanges: manifest.Package.IdRanges.map((idRange) => ({
                    from: parseInt(idRange.MinObjectId),
                    to: parseInt(idRange.MaxObjectId),
                })),
                preprocessorSymbols: []
            }
        );
    }

    /**
     * Uri of the `app.json` file.
     */
    public get uri() {
        return this._uri;
    }

    /**
     * The `id` property from the `app.json` file.
     *
     * ***DO NOT USE THIS PROPERTY UNLESS YOU ABSOLUTELY NEED IT!***
     *
     * **Instead, use the `hash` property from the parent object. The `id` property should be used
     * only for informational purposes, typically when having to present it on screen.**
     *
     * ***NEVER SEND THIS PROPERTY TO THE BACK END!***
     */
    public get id(): string {
        return this._manifest.id || "";
    }

    /**
     * The `name` property from the `app.json` file.
     */
    public get name(): string {
        return this._manifest.name || "";
    }

    /**
     * The `publisher` property from the `app.json` file.
     */
    public get publisher(): string {
        return this._manifest.publisher || "";
    }

    /**
     * The `version` property from the `app.json` file.
     */
    public get version(): string {
        return this._manifest.version || "";
    }

    /**
     * The `idRanges` property from the `app.json` file.
     */
    public get idRanges(): ALRange[] {
        return this._manifest.idRanges || [];
    }

    public get preprocessorSymbols(): string[] {
        return this._manifest.preprocessorSymbols || [];
    }
}
