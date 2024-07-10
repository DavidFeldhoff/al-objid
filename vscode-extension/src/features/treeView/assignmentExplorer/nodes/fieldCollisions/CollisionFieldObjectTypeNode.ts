import { NinjaIcon } from "../../../../../lib/NinjaIcon";
import { AppAwareDescendantNode, AppAwareNode } from "../../../AppAwareNode";
import { TreeItemLabel, TreeItemCollapsibleState, MarkdownString } from "vscode";
import { ALObjectType } from "../../../../../lib/types/ALObjectType";
import { Node } from "../../../Node";
import { CollisionFieldObjectNode } from "./CollisionFieldObjectNode";
import { ALObjectNamespace } from "../../../../../lib/types/ALObjectNamespace";
import { getAlObjectEntityIds } from "../../../../../lib/functions/getAlObjectEntityIds";

/**
 * Represents an object type node under collision field group node.
 */
export class CollisionFieldObjectTypeNode extends AppAwareDescendantNode {
    protected override readonly _iconPath = NinjaIcon["object-collision"];
    protected override readonly _uriPathPart: string;
    protected override readonly _label: string | TreeItemLabel;
    protected override readonly _collapsibleState: TreeItemCollapsibleState = TreeItemCollapsibleState.Expanded;
    protected _includeLogicalNameInDescription = false;
    protected _includeLogicalNameInLabel = false;
    private _objects: ALObjectNamespace[];

    constructor(parent: AppAwareNode, objectType: ALObjectType, objects: ALObjectNamespace[]) {
        super(parent);
        this._label = objectType;
        this._uriPathPart = objectType;
        this._objects = objects;
        this._tooltip = new MarkdownString(`**${objects.reduce((sum, obj) => sum + getAlObjectEntityIds(obj).length, 0)}** manually assigned ${this._objects[0].values ? 'value' : 'field'}(s)`);
    }

    protected override getChildren(): Node[] {
        const children: Node[] = [];

        for (let object of this._objects) {
            children.push(new CollisionFieldObjectNode(this, object));
        }

        return children;
    }
}
