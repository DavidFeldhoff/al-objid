import { dirname } from "path";
import { Uri } from "vscode";
import { WorkspaceManager } from "../../features/WorkspaceManager";
import { SymbolReferenceNamespace, SymbolReferenceObject, SymbolReferenceRoot } from "../types/SymbolReferenceSchema";


const baseObjectLookupTable: Record<string, number> = {};

const regexp = /(tableextension|enumextension)\s+\d+\s+(\w+|"[^"]+")\s+extends\s+(\w+|"[^"]+")/i;
export async function getExtendedId(uri: Uri, documentText: string): Promise<number | null> {
    const regexpMatchArr = documentText.match(regexp);
    if (!regexpMatchArr || regexpMatchArr.index === undefined) {
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
        return null;
    }
    for (const dependencyPackage of await app.getDependencies()) {
        const baseObject = findBaseObject(dependencyPackage.symbolReference, baseObjectType, baseObjectName)
        if (baseObject) {
            console.log(`Found base object for ${baseObjectType} ${baseObjectName} in ${dependencyPackage.symbolReference.Name} with id ${baseObject.id}`)
            baseObjectLookupTable[`${baseObjectType} ${baseObjectName}`] = baseObject.id;
            return baseObject.id;
        }
    }
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