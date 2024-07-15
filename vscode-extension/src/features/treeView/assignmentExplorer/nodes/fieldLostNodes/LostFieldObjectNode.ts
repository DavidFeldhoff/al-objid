import { TreeItemLabel, TreeItemCollapsibleState, TreeItem, Uri } from "vscode";
import { getSingleIconPath } from "../../../../../lib/NinjaIcon";
import { AppsAwareDescendantNode, AppsAwareNode } from "../../../AppsAwareNode";
import { AssignedALObject } from "../../../../../lib/types/AssignedALObject";
import { Node } from "../../../Node";
import { LostFieldNode } from "./LostFieldNode";

/**
 * Represents a lost object node defined as an object ID that has fields or values that were previously assigned by Ninja, but are no longer in use.
 * 
 * Contains children of {@link LostFieldNode} type.
 */
export class LostFieldObjectNode extends AppsAwareDescendantNode {
    private readonly _object: AssignedALObject;
    protected override readonly _iconPath = getSingleIconPath("al-lost");
    protected _uriPathPart: string;
    protected _label: string | TreeItemLabel;
    protected _collapsibleState = TreeItemCollapsibleState.Expanded;
    protected _includeLogicalNameInDescription = false;
    protected _includeLogicalNameInLabel = false;
    private _entityName: string;

    constructor(parent: AppsAwareNode, object: AssignedALObject) {
        super(parent);
        this._object = object;
        if (object.possiblePaths && object.possiblePaths.length === 1)
            this._uri = Uri.file(object.possiblePaths[0]);
        this._uriPathPart = object.id.toString();
        this._label = object.name || object.id.toString();
        this._description = object.name ? object.id.toString() : "";
        this._entityName = object.type.includes('enum') ? 'value' : 'field';
        this._tooltip = `${object.type} ${this._label} has ${this._entityName}s that are no longer in use by any ${this._entityName}.`;
    }

    protected override getChildren(): Node[] {
        const children: Node[] = [];
        for (let fieldOrValue of this._object.fieldOrValueIds || []) {
            children.push(new LostFieldNode(this, this._object, fieldOrValue));
        }
        return children;
    }
    protected override completeTreeItem(item: TreeItem): void {
        super.completeTreeItem(item);
        if (item.resourceUri)
            item.command = {
                command: "vscode.open",
                arguments: [
                    item.resourceUri
                ],
                title: "",
            };
        //TODO: Show paths of possible files as quickpick and then open document
    }
}
