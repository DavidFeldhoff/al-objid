import { NinjaIcon } from "../../../../../lib/NinjaIcon";
import { AppsAwareDescendantNode, AppsAwareNode } from "../../../AppsAwareNode";
import { TreeItemLabel, TreeItemCollapsibleState, MarkdownString } from "vscode";
import { ALObjectType } from "../../../../../lib/types/ALObjectType";
import { Node } from "../../../Node";
import { AssignedALObject } from "../../../../../lib/types/AssignedALObject";
import { LostFieldObjectNode } from "./LostFieldObjectNode";

/**
 * Represents an object type node under lost group node.
 * 
 * Contains children of {@link LostFieldObjectNode} type.
 */
export class LostFieldObjectTypeNode extends AppsAwareDescendantNode {
    protected override readonly _iconPath = NinjaIcon["object-lost"];
    protected override readonly _uriPathPart: string;
    protected override readonly _label: string | TreeItemLabel;
    protected override readonly _collapsibleState: TreeItemCollapsibleState = TreeItemCollapsibleState.Expanded;
    protected _includeLogicalNameInDescription = false;
    protected _includeLogicalNameInLabel = false;
    private _objects: AssignedALObject[];

    constructor(parent: AppsAwareNode, objectType: ALObjectType, objects: AssignedALObject[]) {
        super(parent);
        this._label = objectType;
        this._uriPathPart = objectType;
        this._objects = objects;
        this._tooltip = new MarkdownString(`**${objects.reduce((sum, obj) => sum + (obj.fieldOrValueIds || []).length, 0)}** unused ${objectType.includes('enum') ? 'value' : 'field'} ID(s)`);
    }

    protected override getChildren(): Node[] {
        return this._objects.map(object => new LostFieldObjectNode(this, object));
    }
}
