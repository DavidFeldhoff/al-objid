import { TreeItemLabel, TreeItemCollapsibleState } from "vscode";
import { getSingleIconPath } from "../../../../lib/NinjaIcon";
import { AppsAwareDescendantNode, AppsAwareNode } from "../../AppsAwareNode";
import { DecorationSeverity } from "../../DecorationSeverity";
import { AssignedALObject } from "../../../../lib/types/AssignedALObject";
import { ContextValues } from "../../ContextValues";
import { AssignmentIdContext } from "../../../../commands/contexts/AssignmentContext";
import { ALObjectType } from "../../../../lib/types/ALObjectType";
import { ALApp } from "../../../../lib/ALApp";

/**
 * Represents a lost object node defined as an object ID that was previously assigned by Ninja, but is no longer in use.
 */
export class LostNode extends AppsAwareDescendantNode implements AssignmentIdContext {
    private readonly _object: AssignedALObject;
    protected override readonly _iconPath = getSingleIconPath("al-lost");
    protected _uriPathPart: string;
    protected _label: string | TreeItemLabel;
    protected _collapsibleState = TreeItemCollapsibleState.None;
    protected _includeLogicalNameInDescription = false;
    protected _includeLogicalNameInLabel = false;

    constructor(parent: AppsAwareNode, object: AssignedALObject) {
        super(parent);
        this._object = object;
        this._uriPathPart = object.id.toString();
        this._label = object.id.toString();
        this._description = "";
        this._tooltip = `${object.id} is no longer in use by any ${object.type} object.`;
        this._decoration = {
            severity: DecorationSeverity.inactive,
        };
        if (this.apps.every(app => app.config.appPoolId === this.apps[0].config.appPoolId)) {
            this._contextValues.push(ContextValues.ReclaimId);
        }
    }

    // AssignmentIdContext implementation
    public get app(): ALApp {
        return this.apps[0];
    }

    public get objectType(): ALObjectType {
        return this._object.type;
    }

    public get objectId(): number {
        return this._object.id;
    }
}
