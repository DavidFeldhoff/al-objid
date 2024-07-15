import { Disposable } from "vscode";
import { ALApp } from "../../../../lib/ALApp";
import { AppsAwareNode } from "../../AppsAwareNode";
import { ContextValues } from "../../ContextValues";
import { Node } from "../../Node";
import { RootNode } from "../../RootNode";
import { ViewController } from "../../ViewController";
import { CollisionsGroupNode } from "./CollisionsGroupNode";
import { AssignedALObject } from "../../../../lib/types/AssignedALObject";
import { ALObject } from "@vjeko.com/al-parser-types-ninja";
import { LostGroupNode } from "./LostGroupNode";
import { ALObjectNamespace } from "../../../../lib/types/ALObjectNamespace";
import { CollisionFieldObjectTypeGroupNode } from "./fieldCollisions/CollisionFieldObjectTypeGroupNode";
import { LostFieldObjectTypeGroupNode } from "./fieldLostNodes/LostFieldObjectTypeGroupNode";

/**
 * Represents a root node for assignment explorer.
 */
export class AssignmentExplorerRootNode extends RootNode implements AppsAwareNode, Disposable {
    protected readonly _apps: ALApp[];
    private readonly _hasLogical: boolean;
    private readonly _hasObject: boolean;
    private readonly _subscriptions: Disposable[] = [];
    protected override readonly _uriAuthority: string;
    protected override readonly _label: string;
    protected override readonly _description: string;
    protected override readonly _tooltip: string;
    private _lost: AssignedALObject[] = [];
    private _unassigned: ALObject[] = [];
    private _unassignedFields: ALObjectNamespace[] = [];
    private _lostFields: AssignedALObject[] = [];
    private _lostPerApp: Record<string, AssignedALObject[]> = {};
    private _unassignedPerApp: Record<string, ALObject[]> = {};
    private _unassignedFieldsPerApp: Record<string, ALObjectNamespace[]> = {};
    private _lostFieldsPerApp: Record<string, AssignedALObject[]> = {};

    constructor(app: ALApp, view: ViewController) {
        super(view);

        this._apps = [app];
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

        this._hasLogical = this._apps.flatMap(app => app.config.idRanges).length > 0;
        this._hasObject = this._apps.flatMap(app => app.config.objectTypesSpecified).length > 0;

        this._contextValues.push(ContextValues.Sync);
        if (!this._hasLogical && !this._hasObject) {
            this._contextValues.push(ContextValues.CopyRanges);
        }

        this.attachPoolApp(app);
        this.populateAssignments(app.assignmentMonitor.lost, app.assignmentMonitor.unassigned, app.assignmentMonitor.lostFieldIds, app.assignmentMonitor.unassignedFields, app.hash);
    }

    private populateAssignments(lost: AssignedALObject[], unassigned: ALObject[], lostFieldIds: AssignedALObject[], unassignedFieldIds: ALObjectNamespace[], hash: string) {
        this._lostPerApp[hash] = lost;
        this._unassignedPerApp[hash] = unassigned;
        this._lostFieldsPerApp[hash] = lostFieldIds;
        this._unassignedFieldsPerApp[hash] = unassignedFieldIds;
        this.mergeAssignments();
    }

    private mergeAssignments() {
        this._lost = [];
        this._unassigned = [];
        //TODO: this._assigned not working for app pool as it should only show assigned objects of current app to see which one are lost
        for (let hash in this._lostPerApp) {
            this._lost.push(...this._lostPerApp[hash]);
        }
        for (let hash in this._unassignedPerApp) {
            this._unassigned.push(...this._unassignedPerApp[hash]);
        }

        this._unassignedFields = [];
        for (let hash in this._unassignedFieldsPerApp) {
            this._unassignedFields.push(...this._unassignedFieldsPerApp[hash]);
        }
        this._lostFields = [];
        for (let hash in this._lostFieldsPerApp) {
            this._lostFields.push(...this._lostFieldsPerApp[hash]);
        }
    }

    protected override getChildren(): Node[] {
        let children: Node[] = [];

        children.push(new CollisionsGroupNode(this, this._unassigned));
        if (!this._apps.some(app => app.config.appPoolId))
            children.push(new LostGroupNode(this, this._lost));

        children.push(new CollisionFieldObjectTypeGroupNode(this, this._unassignedFields));
        if (!this._apps.some(app => app.config.appPoolId))
            children.push(new LostFieldObjectTypeGroupNode(this, this._lostFields));

        return children;
    }

    public get apps() {
        return this._apps;
    }

    public attachPoolApp(app: ALApp) {
        this._apps.push(app);
        this._subscriptions.push(app.assignmentMonitor.onAssignmentChanged((data) => {
            this.populateAssignments(data.lost, data.unassigned, data.lostFieldIds, data.unassignedFieldIds, app.hash);
            this._view.update(this);
        }));
    }

    public dispose(): void {
        this._subscriptions.forEach(subscription => subscription.dispose());
    }
}
