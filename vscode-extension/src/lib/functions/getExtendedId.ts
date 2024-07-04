import { dirname } from "path";
import { Uri } from "vscode";
import { WorkspaceManager } from "../../features/WorkspaceManager";
import { SymbolReferenceNamespace, SymbolReferenceObject, SymbolReferenceRoot } from "../types/SymbolReferenceSchema";
import { LogLevel, output } from "../../features/Output";


const baseObjectLookupTable: Record<string, number> = {};

const regexp = /(tableextension|enumextension)\s+\d+\s+(\w+|"[^"]+")\s+extends\s+(\w+|"[^"]+")/i;
/**
 * Get the id of the base table or base enum if it is a tableextension or enumextension, respectively.
 * Always works with the latest dependencies and therefore might update the workspace dependency cache.
 * @param uri Uri of the current document
 * @param documentText file content of the current document
 * @returns Id of the base table or base enum if it is a tableextension or enumextension, respectively. Otherwise, null.
 */
export async function getExtendedId(uri: Uri, documentText: string): Promise<number | null> {
    const regexpMatchArr = documentText.match(regexp);
    if (!regexpMatchArr || regexpMatchArr.index === undefined) {
        if (documentText.includes("extends")) {
            output.log(`[Get Extended Id] Error: Regex did not match on current file content`, LogLevel.Info)
        }
        return null;
    }

    const baseObjectType = regexpMatchArr[1].toLowerCase();
    const baseObjectName = regexpMatchArr[3].replace(/"/g, '');
    const resolvedId = baseObjectLookupTable[`${baseObjectType} ${baseObjectName}`];
    if (resolvedId) {
        return resolvedId;
    }
    const app = WorkspaceManager.instance.alApps.find(app => dirname(uri.fsPath).startsWith(dirname(app.uri.fsPath)))
    if (!app) {
        output.log(`[Get Extended Id] Error: Could not find app for ${uri.fsPath}. Available apps were ${WorkspaceManager.instance.alApps.map(app => app.uri.fsPath).join(', ')}`, LogLevel.Info)
        return null;
    }
    const dependencies = await app.getDependencies();
    for (const dependencyPackage of dependencies) {
        const baseObject = findBaseObject(dependencyPackage.symbolReference, baseObjectType, baseObjectName)
        if (baseObject) {
            output.log(`[Get Extended Id] Found base object for ${baseObjectType} ${baseObjectName} in ${dependencyPackage.symbolReference.Name} with id ${baseObject.id}`, LogLevel.Verbose)
            baseObjectLookupTable[`${baseObjectType} ${baseObjectName}`] = baseObject.id;
            return baseObject.id;
        }
    }
    output.log(`[Get Extended Id] Error: Could not find base object for ${baseObjectType} ${baseObjectName}. Checked the following dependency files: ${dependencies.map(dep => dep.fsPath).join(', ')}`, LogLevel.Info)
    return null;
}

function findBaseObject(symbolReference: SymbolReferenceRoot | SymbolReferenceNamespace, baseObjectType: string, baseObjectName: string): { name: string, id: number, namespace?: string } | undefined {
    let objects: SymbolReferenceObject[] = [];
    switch (baseObjectType) {
        case "tableextension":
            objects = symbolReference.Tables || [];
            break;
        case "enumextension":
            objects = symbolReference.EnumTypes || [];
            break;
        default:
            return undefined;
    }
    for (const object of objects) {
        if (object.Name === baseObjectName) {
            return { name: object.Name, id: object.Id, namespace: symbolReference.Name || "" };
        }
    }
    if (symbolReference.Namespaces) {
        for (const namespace of symbolReference.Namespaces) {
            const result = findBaseObject(namespace, baseObjectType, baseObjectName);
            if (result) {
                return result.namespace ? { id: result.id, name: result.name, namespace: `${symbolReference.Name}.${result.namespace}` } : result;
            }
        }
    }
    return undefined;
}