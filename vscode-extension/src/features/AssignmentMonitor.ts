import { Diagnostics, DIAGNOSTIC_CODE } from "./diagnostics/Diagnostics";
import { DiagnosticSeverity, Disposable, FileSystemWatcher, Position, Range, Uri, workspace } from "vscode";
import { getObjectDefinitions, getWorkspaceFolderFiles } from "../lib/ObjectIds";
import { LogLevel, output } from "./Output";
import { ALObject } from "@vjeko.com/al-parser-types-ninja";
import { ConsumptionCache } from "./ConsumptionCache";
import { consumptionToObjects } from "../lib/functions/consumptionToObjects";
import { ConsumptionDataOfObject } from "../lib/types/ConsumptionDataOfObject";
import { PropertyBag } from "../lib/types/PropertyBag";
import { EventEmitter } from "vscode";
import { AssignedALObject } from "../lib/types/AssignedALObject";
import { ConsumptionDataOfField } from "../lib/types/ConsumptionDataOfFields";
import { fieldConsumptionToObjects } from "../lib/functions/fieldConsumptionToObjects";
import { ALObjectNamespace } from "../lib/types/ALObjectNamespace";
import { getStorageIdLight } from "../lib/functions/getStorageIdLight";
import { getAlObjectEntityIds } from "../lib/functions/getAlObjectEntityIds";

export class AssigmentMonitor implements Disposable {
    private _lost: AssignedALObject[] = [];
    private _unassigned: ALObject[] = [];
    private _lostFieldIds: AssignedALObject[] = [];
    private _unassignedFields: ALObjectNamespace[] = [];
    private readonly _onAssignmentChanged = new EventEmitter<{ lost: AssignedALObject[], unassigned: ALObject[], lostFieldIds: AssignedALObject[], unassignedFieldIds: ALObjectNamespace[] }>();
    public readonly onAssignmentChanged = this._onAssignmentChanged.event;
    readonly _uri: Uri;
    readonly _hash: string;
    readonly _watcher: FileSystemWatcher;
    readonly _disposables: Disposable[] = [];
    private _refreshPromise: Promise<void> | undefined;
    private _updatesPaused: boolean = false;

    readonly _pending = {
        changed: [] as Uri[],
        created: [] as Uri[],
        deleted: [] as Uri[],
    };

    _timeout: NodeJS.Timeout | undefined;
    _objects: ALObjectNamespace[] | undefined;
    _consumption: ConsumptionDataOfObject | undefined;
    _fieldConsumption: ConsumptionDataOfField | undefined;
    _diagnosedUris: Uri[] = [];
    _disposed: boolean = false;

    constructor(uri: Uri, hash: string) {
        this._uri = uri;
        this._hash = hash;

        this._watcher = workspace.createFileSystemWatcher(`${this._uri.fsPath}/**/*.al`, false, false, false);

        this._watcher.onDidChange(this.onDidChange, this, this._disposables);
        this._watcher.onDidCreate(this.onDidCreate, this, this._disposables);
        this._watcher.onDidDelete(this.onDidDelete, this, this._disposables);

        this.scheduleRefreshObjects();
        this._disposables.push(
            ConsumptionCache.instance.onConsumptionUpdate(hash, (consumption, fieldConsumption) => this.refreshConsumption(consumption, fieldConsumption)),
        );
    }

    private onDidCreate(uri: Uri) {
        if (this._updatesPaused) return;
        if (this._pending.created.some(u => u.fsPath === uri.fsPath)) {
            return;
        }
        this._pending.created.push(uri);
        this.scheduleRefreshObjects();
    }

    private onDidChange(uri: Uri) {
        if (this._updatesPaused) return;
        if (this._pending.changed.some(u => u.fsPath === uri.fsPath)) {
            return;
        }
        this._pending.changed.push(uri);
        this.scheduleRefreshObjects();
    }

    private onDidDelete(uri: Uri) {
        if (this._updatesPaused) return;
        if (this._pending.deleted.some(u => u.fsPath === uri.fsPath)) {
            return;
        }
        this._pending.deleted.push(uri);
        this.scheduleRefreshObjects();
    }

    private scheduleRefreshObjects() {
        if (this._updatesPaused) return;
        if (this._timeout) {
            clearTimeout(this._timeout);
        }
        this._timeout = setTimeout(async () => {
            this._timeout = undefined;
            await this.refreshObjects();
            this.refresh();
        }, 125);
    }

    private async getPendingUris() {
        const actualUris = await getWorkspaceFolderFiles(this._uri);

        this._objects =
            this._objects &&
            this._objects.filter(
                object =>
                    actualUris.some(u => u.fsPath === object.path) &&
                    !this._pending.created.some(u => u.fsPath === object.path) &&
                    !this._pending.deleted.some(u => u.fsPath === object.path) &&
                    !this._pending.changed.some(u => u.fsPath === object.path)
            );

        const uris = [
            ...this._pending.created,
            ...this._pending.changed,
            ...actualUris.filter(
                u =>
                    !(this._objects || []).some(o => o.path === u.fsPath) &&
                    !this._pending.created.some(pu => u.fsPath === pu.fsPath) &&
                    !this._pending.deleted.some(pu => u.fsPath === pu.fsPath) &&
                    !this._pending.changed.some(pu => u.fsPath === pu.fsPath)
            ),
        ];

        this._pending.created = [];
        this._pending.changed = [];
        this._pending.deleted = [];

        return uris;
    }

    private async refreshObjects() {
        if (this._refreshPromise)
            return this._refreshPromise;
        this._refreshPromise = new Promise<void>(async (resolve, reject) => {
            try {
                output.log("Refreshing object ID consumption after change in workspace AL files", LogLevel.Verbose);
                const uris = await this.getPendingUris();
                const objects = await getObjectDefinitions(uris);

                if (!this._objects) {
                    this._objects = [];
                }
                this._objects.push(...objects);
                resolve();
            } catch (error) {
                reject(error);
            }
        }).then(() => this._refreshPromise = undefined);
        return this._refreshPromise;
    }

    private async refreshConsumption(consumption: ConsumptionDataOfObject, fieldConsumption: ConsumptionDataOfField) {
        if (this._updatesPaused) return;
        await this.refreshObjects();
        this._consumption = consumption;
        this._fieldConsumption = fieldConsumption;
        this.refresh();
    }

    private refresh() {
        if (!this._objects || !this._consumption) {
            return;
        }

        const consumedObjects = consumptionToObjects(this._consumption);

        // Array of object IDs that are assigned (consumed) but do not exist in the workspace
        const lost = consumedObjects.filter(
            consumedObject =>
                !this._objects!.some(object => object.id === consumedObject.id && object.type === consumedObject.type)
        );
        this._lost = lost;

        // Array of object IDs that are not assigned by Ninja but exist in the workspace
        const unassigned = this._objects.filter(
            object =>
                !consumedObjects.some(
                    assignedObject => object.id === assignedObject.id && object.type === assignedObject.type
                ) && typeof object.id === "number"
        );
        this._unassigned = unassigned;

        if (this._fieldConsumption) {
            const consumedObjectsAndFields = fieldConsumptionToObjects(this._fieldConsumption);

            this._lostFieldIds = [];
            for (const consumedObject of consumedObjectsAndFields) {
                const objects = this._objects.filter(object => {
                    const storageId = getStorageIdLight(object);
                    return storageId.type === consumedObject.type && storageId.id === consumedObject.objectId;
                });
                if (objects.length === 0) {
                    this._lostFieldIds.push({ type: consumedObject.type, id: consumedObject.objectId, fieldOrValueIds: consumedObject.ids });
                } else {
                    let name: string | undefined;
                    let lostIds = consumedObject.ids;
                    for (const object of objects) {
                        if (!name)
                            if (consumedObject.type.includes('extension') || !object.type.includes('extension'))
                                name = object.name;
                            else if (object.type.includes('extension') && object.extends)
                                name = object.extends;
                        const objectEntityIds = getAlObjectEntityIds(object);
                        lostIds = lostIds.filter(id => !objectEntityIds.map(e => e.id).includes(id));
                    }
                    if (lostIds.length > 0)
                        this._lostFieldIds.push({ type: consumedObject.type, id: consumedObject.objectId, name: name, possiblePaths: objects.map(o => o.path), fieldOrValueIds: lostIds });
                }
            }

            this._unassignedFields = [];
            for (const object of this._objects) {
                const entities = getAlObjectEntityIds(object);
                if (entities.length === 0)
                    continue;
                const storageId = getStorageIdLight(object);
                const consumedObject = consumedObjectsAndFields.find(consumedObject => consumedObject.type === storageId.type && consumedObject.objectId === storageId.id);
                if (!consumedObject) {
                    this._unassignedFields.push(object);
                } else {
                    const unassignedFieldIds = entities.filter(fieldOrValue => !consumedObject.ids.includes(fieldOrValue.id));
                    if (unassignedFieldIds.length > 0) {
                        const objCopy: ALObjectNamespace = JSON.parse(JSON.stringify(object));
                        if (objCopy.fields)
                            objCopy.fields = unassignedFieldIds;
                        else
                            objCopy.values = unassignedFieldIds;
                        this._unassignedFields.push(objCopy);
                    }
                }
            }
        }

        this._onAssignmentChanged.fire({ lost, unassigned, lostFieldIds: this._lostFieldIds, unassignedFieldIds: this._unassignedFields });

        this.clearDiagnostics();

        this.createObjectDiagnostics(unassigned);
        this.createFieldDiagnostics();
    }

    private createObjectDiagnostics(unassigned: ALObjectNamespace[]) {
        let uriCache: PropertyBag<Uri> = {};
        for (let object of unassigned) {
            if (object.hasError) {
                continue;
            }
            if (!uriCache[object.path]) {
                const uri = Uri.file(object.path);
                uriCache[object.path] = uri;
            }

            const objectUri = uriCache[object.path];
            const diagnose = Diagnostics.instance.createDiagnostics(
                objectUri,
                `ninjaunassigned.${object.type}.${object.id}`
            );
            if (!this._diagnosedUris.some(u => u.fsPath === objectUri.fsPath)) {
                this._diagnosedUris.push(objectUri);
            }

            const diagnostic = diagnose(
                new Range(
                    new Position(object.line, object.character),
                    new Position(object.line, object.character + object.id.toString().length)
                ),
                `${object.type} ${object.id} is not assigned with AL Object ID Ninja`,
                DiagnosticSeverity.Warning,
                DIAGNOSTIC_CODE.CONSUMPTION.UNASSIGNED
            );
            diagnostic.data = object;
        }
    }
    private createFieldDiagnostics() {
        let uriCache: PropertyBag<Uri> = {};
        for (let object of this.unassignedFields) {
            if (object.hasError) {
                continue;
            }
            if (!uriCache[object.path]) {
                const uri = Uri.file(object.path);
                uriCache[object.path] = uri;
            }

            const objectUri = uriCache[object.path];
            for (const unassignedFieldOrValue of getAlObjectEntityIds(object)) {
                const diagnose = Diagnostics.instance.createDiagnostics(
                    objectUri,
                    `ninjaunassigned.${object.type}.${object.id}.${unassignedFieldOrValue.id}`
                );
                if (!this._diagnosedUris.some(u => u.fsPath === objectUri.fsPath)) {
                    this._diagnosedUris.push(objectUri);
                }

                const diagnostic = diagnose(
                    new Range(
                        new Position(unassignedFieldOrValue.line, unassignedFieldOrValue.character),
                        new Position(unassignedFieldOrValue.line, unassignedFieldOrValue.character + unassignedFieldOrValue.id.toString().length)
                    ),
                    `${object.values ? 'Value' : 'Field'} ${unassignedFieldOrValue.id} of ${object.type} ${object.name} is not assigned with AL Object ID Ninja`,
                    DiagnosticSeverity.Warning,
                    DIAGNOSTIC_CODE.CONSUMPTION.FIELD_UNASSIGNED
                );
                diagnostic.data = { object: object, field: unassignedFieldOrValue };
            }
        }
    }

    public get lost() {
        return this._lost;
    }

    public get unassigned() {
        return this._unassigned;
    }
    public get lostFieldIds() {
        return this._lostFieldIds;
    }
    public get unassignedFields() {
        return this._unassignedFields;
    }

    private clearDiagnostics() {
        for (let uri of this._diagnosedUris) {
            Diagnostics.instance.resetForUri(uri);
        }
        this._diagnosedUris = [];
    }

    public setUpdatesPaused(value: boolean) {
        this._updatesPaused = value;
    }

    dispose() {
        if (this._disposed) {
            return;
        }

        this._watcher.dispose();
        this._disposables.forEach(disposable => disposable.dispose());
        this.clearDiagnostics();
        this._onAssignmentChanged.dispose();

        this._disposed = true;
    }
}
