import { Uri } from "vscode";
import { LogLevel, output } from "../../features/Output";
import { readFileSync } from "fs";
import { WorkspaceManager } from "../../features/WorkspaceManager";
import { ALObjectType } from "@vjeko.com/al-parser-types";

export async function findNamespaceAndIdInDependencyPackages(uri: Uri, objectDeclarationLineNo: number, extensionObjectType: string, baseObjectName: string, updateDependencyCache: boolean): Promise<{ id: number, namespace: string } | undefined> {
    const lines: string[] = readFileSync(uri.fsPath, 'utf8').split('\n');
    const possibleUsingLines = lines.slice(0, objectDeclarationLineNo);
    const regexUsing = /using ([^;]+);/i;
    const usings: string[] = [];
    for (const line of possibleUsingLines) {
        const match = line.match(regexUsing);
        if (match) {
            usings.push(match[1]);
        }
    }
    const alAppPackages = await WorkspaceManager.instance.getALAppFromUri(uri)?.getDependencies(updateDependencyCache) || [];
    const objectOfInterest = extensionObjectType.toLowerCase() === "tableextension" ? ALObjectType.table : ALObjectType.enum;
    for (const alAppPackage of alAppPackages) {
        const baseObject = alAppPackage.flattenDependencies([objectOfInterest]).find(obj =>
            (obj.namespace === undefined || obj.namespace === "" || usings.length === 0 || usings.some(using => using.toLowerCase() === obj.namespace.toLowerCase())) &&
            obj.name && obj.name.replace(/"/g, "").toLowerCase() === baseObjectName.replace(/"/g, "").toLowerCase());
        if (baseObject) {
            return { id: baseObject.id, namespace: baseObject.namespace };
        }
    }

    output.log(`[Get Namespace] Error: Could not find namespace for ${uri.fsPath}`, LogLevel.Info);
    return undefined;
};