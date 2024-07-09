import { Disposable } from "vscode";
import { ALApp } from "../../../../lib/ALApp";
import { AppAwareNode } from "../../AppAwareNode";
import { ContextValues } from "../../ContextValues";
import { Node } from "../../Node";
import { RootNode } from "../../RootNode";
import { ViewController } from "../../ViewController";
import { CollisionsGroupNode } from "./CollisionsGroupNode";
import { AssignedALObject } from "../../../../lib/types/AssignedALObject";
import { ALObject, ALUniqueEntity } from "@vjeko.com/al-parser-types-ninja";
import { LostGroupNode } from "./LostGroupNode";
import { ALObjectNamespace } from "../../../../lib/types/ALObjectNamespace";

/**
 * Represents a root node for assignment explorer.
 */
export class AssignmentExplorerRootNode extends RootNode implements AppAwareNode, Disposable {
    protected readonly _app: ALApp;
    private readonly _hasLogical: boolean;
    private readonly _hasObject: boolean;
    private readonly _subscriptions: Disposable[] = [];
    protected override readonly _uriAuthority: string;
    protected override readonly _label: string;
    protected override readonly _description: string;
    protected override readonly _tooltip: string;
    private _assigned: AssignedALObject[] = [];
    private _unassigned: ALObject[] = [];
    private _assignedPerApp: Record<string, AssignedALObject[]> = {};
    private _unassignedPerApp: Record<string, ALObject[]> = {};
    private _unassignedFieldsPerApp: Record<string, { object: ALObjectNamespace, fields: ALUniqueEntity[] }[]> = {};
    private _lostFieldsPerApp: Record<string, { objectType: string, objectId: number, fieldIds: number[] }[]> = {};

    constructor(app: ALApp, view: ViewController) {
        super(view);

        this._app = app;
        if (app.config.appPoolId) {
            this._label = `App Pool ${app.config.appPoolId.substring(0, 8)}`;
            this._description = "";
            this._tooltip = app.config.appPoolId;
            this._uriAuthority = app.config.appPoolId;
        } else {
            this._label = app.name || app.manifest.name;
            this._description = app.manifest.version;
            this._tooltip = `${app.manifest.name} v${app.manifest.version}`;
            this._uriAuthority = app.hash;
        }
        this._contextValues.push(ContextValues.Sync);

        this._hasLogical = this._app.config.idRanges.length > 0;
        this._hasObject = this._app.config.objectTypesSpecified.length > 0;

        this._contextValues.push(ContextValues.Sync);
        if (!this._hasLogical && !this._hasObject) {
            this._contextValues.push(ContextValues.CopyRanges);
        }

        this.attachPoolApp(app);
        this.populateAssignments(app.assignmentMonitor.assigned, app.assignmentMonitor.unassigned, app.assignmentMonitor.lostFieldIds, app.assignmentMonitor.unassignedFields, app.hash);
    }

    private populateAssignments(assigned: AssignedALObject[], unassigned: ALObject[], lostFieldIds: { objectType: string, objectId: number, fieldIds: number[] }[], unassignedFieldIds: { object: ALObjectNamespace, fields: ALUniqueEntity[] }[], hash: string) {
        this._assignedPerApp[hash] = assigned;
        this._unassignedPerApp[hash] = unassigned;
        this._lostFieldsPerApp[hash] = lostFieldIds;
        this._unassignedFieldsPerApp[hash] = unassignedFieldIds;
        this.mergeAssignments();
    }

    private mergeAssignments() {
        this._assigned = [];
        this._unassigned = [];
        //TODO: this._assigned not working for app pool as it should only show assigned objects of current app to see which one are lost
        for (let hash in this._assignedPerApp) {
            this._assigned.push(...this._assignedPerApp[hash]);
        }
        for (let hash in this._unassignedPerApp) {
            this._unassigned.push(...this._unassignedPerApp[hash]);
        }
    }

    protected override getChildren(): Node[] {
        let children: Node[] = [];

        children.push(new CollisionsGroupNode(this, this._unassigned));
        if (!this._app.config.appPoolId) {
            children.push(new LostGroupNode(this, this._assigned));
        }
        return children;
    }

    public get app() {
        return this._app;
    }

    public get appId() {
        return this.app.appId;
    }

    public attachPoolApp(app: ALApp) {
        this._subscriptions.push(app.assignmentMonitor.onAssignmentChanged((data) => {
            this.populateAssignments(data.assigned, data.unassigned, data.lostFieldIds, data.unassignedFieldIds, app.hash);
            this._view.update(this);
        }));
    }

    public dispose(): void {
        this._subscriptions.forEach(subscription => subscription.dispose());
    }
}
