import { TreeItemLabel, TreeItemCollapsibleState, Uri, TreeItem } from "vscode";
import { getSingleIconPath } from "../../../../../lib/NinjaIcon";
import { AppsAwareDescendantNode, AppsAwareNode } from "../../../AppsAwareNode";
import { DecorationSeverity } from "../../../DecorationSeverity";
import { AssignedALObject } from "../../../../../lib/types/AssignedALObject";
import { ContextValues } from "../../../ContextValues";
import { AssignmentIdContext } from "../../../../../commands/contexts/AssignmentContext";
import { ALObjectType } from "../../../../../lib/types/ALObjectType";
import { ALApp } from "../../../../../lib/ALApp";

/**
 * Represents a lost object node defined as an object ID that was previously assigned by Ninja, but is no longer in use.
 */
export class LostFieldNode extends AppsAwareDescendantNode implements AssignmentIdContext {
    private readonly _object: AssignedALObject;
    private readonly _fieldOrValueId: number;
    protected override readonly _iconPath = getSingleIconPath("al-lost");
    protected _uriPathPart: string;
    protected _label: string | TreeItemLabel;
    protected _collapsibleState = TreeItemCollapsibleState.None;
    protected _includeLogicalNameInDescription = false;
    protected _includeLogicalNameInLabel = false;

    constructor(parent: AppsAwareNode, object: AssignedALObject, fieldOrValueId: number) {
        super(parent);
        this._object = object;
        this._fieldOrValueId = fieldOrValueId;
        if (object.possiblePaths && object.possiblePaths.length === 1) {
            this._uri = Uri.file(object.possiblePaths[0]);
        }

        this._uriPathPart = fieldOrValueId.toString();
        this._label = fieldOrValueId.toString();
        this._description = "";
        this._tooltip = `ID ${fieldOrValueId} is no longer in use by any ${object.type.includes('enum') ? 'value' : 'field'}.`;
        this._decoration = {
            severity: DecorationSeverity.inactive,
        };

        if (this.apps.every(app => app.config.appPoolId === this.apps[0].config.appPoolId)) {
            this._contextValues.push(ContextValues.ReclaimId);
        }
    }

    protected override completeTreeItem(item: TreeItem): void {
        super.completeTreeItem(item);
        if (item.resourceUri) {
            item.command = {
                command: "vscode.open",
                arguments: [
                    item.resourceUri
                ],
                title: "",
            };
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
    public get fieldId(): number {
        return this._fieldOrValueId;
    }
}
