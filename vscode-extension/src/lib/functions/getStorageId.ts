import { EndOfLine, TextDocument, window } from "vscode";
import { LogLevel, output } from "../../features/Output";
import { ParserConnector } from "../../features/ParserConnector";
import { Config } from "../Config";
import { ALObject } from "@vjeko.com/al-parser-types-ninja";
import { WorkspaceManager } from "../../features/WorkspaceManager";
import { dirname } from "path";
import { SymbolReferenceNamespace, SymbolReferenceObject, SymbolReferenceRoot } from "../types/SymbolReferenceSchema";
import { ALObjectNamespace } from "../types/ALObjectNamespace";

/**
 * Returns the storage Id for the ninja backend. 
 * Save to use even with unsaved documents
 * @param alObject The ALObject to get the storage id for
 */
export async function getStorageId(alObject: ALObject): Promise<string | undefined>;
/**
 * Returns the storage Id for the ninja backend. 
 * Save to use even with unsaved documents.
 * @param type Type of the extension object
 * @param id Id of the extension object
 * @param extendsObject Name of the base object
 * @param extendsNamespace Namespace of the base object
 * @param uri Uri of the extension document
 */
export async function getStorageId(type: string, id: number, document: TextDocument): Promise<string | undefined>;
export async function getStorageId(arg1: string | ALObject, id?: number, document?: TextDocument): Promise<string | undefined> {
    const type = typeof arg1 === 'string' ? arg1 : arg1.type;
    id = typeof arg1 === 'string' ? id : arg1.id;
    if (!Config.instance.storeExtensionValuesOrIdsOnBaseObject || !["tableextension", "enumextension"].includes(type.toLowerCase()))
        return `${type}_${id}`;

    const object = await getFinalParameters(arg1, id, document);
    if (object.extends) {
        const baseObjectId = await getExtendedId(object.type, object.extends, object.path, object.extendsNamespace || "");
        if (baseObjectId)
            return `${object.type.replace("extension", "")}_${baseObjectId}`;
        window.showErrorMessage(`Ninja: Could not find base object ${object.extends} in the dependencies. This is needed to get the consumption data.`);
    }
    return undefined;
}
async function getFinalParameters(arg1: string | ALObject, id?: number, document?: TextDocument): Promise<{ type: string; id: number; extends: string | undefined; extendsNamespace?: string; path: string }> {
    let object: { type: string, id: number; extends: string | undefined; extendsNamespace?: string; path: string; } = {} as any;
    if (typeof arg1 === "string") {
        const extendedObjectDetails = await getExtendedObjectDetails(arg1, document!);
        return {
            type: arg1,
            id: id!,
            extends: extendedObjectDetails?.extends,
            extendsNamespace: extendedObjectDetails?.extendsNamespace,
            path: document!.uri!.fsPath
        };
    } else {
        const alObject = arg1;
        object.path = alObject.path;
        object.type = alObject.type.toLocaleLowerCase();
        object.id = alObject.id;
        if ('extendsNamespace' in alObject) {
            object.extends = alObject.extends;
            object.extendsNamespace = (alObject as ALObjectNamespace).extendsNamespace;
        } else {
            // temporary fix as the parser does not return the right extended object name and namespace
            const extendInfos = await ParserConnector.instance.getExtendInfos(alObject.type, alObject.path);
            object.extends = extendInfos?.extends;
            object.extendsNamespace = extendInfos?.extendsNamespace;
        }
    }
    output.log(`[Get Storage Id] Found base object namespace for ${object.path}: ${object.extendsNamespace}`, LogLevel.Verbose);
    return object;
}
/**
 * Returns the base object name if it can find it. 
 * First tries to get the infos from the unsaved document to not require to have it saved all the time.
 * If that doesn't work it tries to get the infos from the saved document.
 * @param document TextDocument object of the current al file
 * @param symbol Symbol of the current al object
 * @returns the base object name in case it is a tableextension or enumextension
 */
async function getExtendedObjectDetails(extensionType: string, document: TextDocument): Promise<{ extends: string, extendsNamespace?: string } | undefined> {
    return await ParserConnector.instance.getExtendInfos(extensionType, document.uri.fsPath, document.getText().split(document.eol === EndOfLine.LF ? "\n" : "\r\n"));
}

const baseObjectLookupTable: Record<string, number> = {};

/**
 * Get the id of the base table or base enum if it is a tableextension or enumextension, respectively.
 * Always works with the latest dependencies and therefore might update the workspace dependency cache.
 * Can also deal with unsaved documents as the necessary parameters are direclty injected.
 * @param extensionObjectType The type of the object. Either "tableextension" or "enumextension"
 * @param baseObjectName The name of the base object
 * @param extensionfsPath the fspath of the extension document
 */
async function getExtendedId(extensionObjectType: string, baseObjectName: string, extensionfsPath: string, baseObjectNamespace: string): Promise<number | null> {
    extensionObjectType = extensionObjectType.toLowerCase();
    baseObjectName = baseObjectName.replace(/"/g, '');

    const baseObjectType = extensionObjectType.replace("extension", "");
    const fullQualifiedObjectName = `${baseObjectNamespace ? `${baseObjectNamespace}.` : ""}${baseObjectName}`;
    const resolvedId = baseObjectLookupTable[`${baseObjectType} ${fullQualifiedObjectName}`];
    if (resolvedId) {
        return resolvedId;
    }
    const app = WorkspaceManager.instance.alApps.find(app => dirname(extensionfsPath).startsWith(dirname(app.uri.fsPath)));
    if (!app) {
        output.log(`[Get Extended Id] Error: Could not find app for ${extensionfsPath}. Available apps were ${WorkspaceManager.instance.alApps.map(app => app.uri.fsPath).join(', ')}`, LogLevel.Info);
        return null;
    }
    const dependencies = await app.getDependencies();
    for (const dependencyPackage of dependencies) {
        const baseObject = findBaseObject(dependencyPackage.symbolReference, baseObjectType, baseObjectName, baseObjectNamespace);
        if (baseObject) {
            output.log(`[Get Extended Id] Found base object for ${baseObjectType} ${fullQualifiedObjectName} in ${dependencyPackage.symbolReference.Name} with id ${baseObject.id}`, LogLevel.Verbose);
            baseObjectLookupTable[`${baseObjectType} ${fullQualifiedObjectName}`] = baseObject.id;
            return baseObject.id;
        }
    }
    output.log(`[Get Extended Id] Error: Could not find base object for ${baseObjectType} ${fullQualifiedObjectName}. Checked the following dependency files: ${dependencies.map(dep => dep.fsPath).join(', ')}`, LogLevel.Info);
    return null;
}

function findBaseObject(symbolReferenceRoot: SymbolReferenceRoot, baseObjectType: string, baseObjectName: string, baseObjectNamespace: string): { name: string, id: number, namespace: string } | undefined {
    const namespaceParts = baseObjectNamespace.split('.').filter(part => part !== "");
    output.log(`[Find Base Object] Search ${symbolReferenceRoot.Name}`, LogLevel.Verbose);
    let symRef: SymbolReferenceRoot | SymbolReferenceNamespace | undefined = symbolReferenceRoot;
    for (const namespacePart of namespaceParts) {
        symRef = symRef?.Namespaces?.find(ns => ns.Name === namespacePart) || undefined;
    }
    if (!symRef) {
        output.log(`[Find Base Object]Could not find namespace ${baseObjectNamespace} in ${symbolReferenceRoot.Name}`, LogLevel.Verbose);
        return undefined;
    }
    let objects: SymbolReferenceObject[] = [];
    switch (baseObjectType) {
        case "table":
            objects = symRef.Tables || [];
            break;
        case "enum":
            objects = symRef.EnumTypes || [];
            break;
        default:
            return undefined;
    }
    const object = objects.find(obj => obj.Name.replace(/"/g, "").toLowerCase() === baseObjectName.replace(/"/g, "").toLowerCase());
    if (!object) {
        output.log(`[Find Base Object] Error: Could not find object ${baseObjectName} in ${symbolReferenceRoot.Name}`, LogLevel.Verbose);
        return undefined;
    }
    return { name: object.Name, id: object.Id, namespace: baseObjectNamespace };
}