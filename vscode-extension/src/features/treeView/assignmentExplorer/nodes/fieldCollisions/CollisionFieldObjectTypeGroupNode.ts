import { MarkdownString, TreeItemCollapsibleState } from "vscode";
import { NinjaIcon } from "../../../../../lib/NinjaIcon";
import { AppAwareNode, AppAwareDescendantNode } from "../../../AppAwareNode";
import { Node } from "../../../Node";
import { ALObjectType } from "../../../../../lib/types/ALObjectType";
import { CollisionObjectTypeNode } from "../CollisionObjectTypeNode";
import { ALObjectNamespace } from "../../../../../lib/types/ALObjectNamespace";
import { CollisionFieldObjectTypeNode } from "./CollisionFieldObjectTypeNode";

/**
 * Displays a node that shows "Conflicts Fields/Values" label under which either object types that have unassigned fields/values, or no conflicts nodes are shown.
 *
 * Contains children of {@link CollisionObjectTypeNode} type.
 */
export class CollisionFieldObjectTypeGroupNode extends AppAwareDescendantNode {
    private readonly _unassigned: ALObjectNamespace[];
    protected override _iconPath = NinjaIcon["al-collision"];
    protected override _uriPathPart = "collisionsFields";
    protected override _collapsibleState = TreeItemCollapsibleState.Expanded;
    protected override _description = "Manually assigned";
    protected override _label = "Conflicts Fields/Values";
    protected override _tooltip: string | MarkdownString = new MarkdownString(
        "Table field or enum value IDs that were **manually assigned** and are **not stored** in the back end.\n\nYou should avoid manually assigning IDs as they are not stored in the back end and can be overwritten by other developers.\n\n[Learn more...](https://github.com/vjekob/al-objid/wiki/Does-everyone-on-my-team-need-to-use-Ninja%3F)"
    );

    constructor(parent: AppAwareNode, unassigned: ALObjectNamespace[]) {
        super(parent);
        this._unassigned = unassigned;

        if (this._unassigned.length === 0) {
            this._collapsibleState = TreeItemCollapsibleState.None;
            this._iconPath = NinjaIcon["check"];
            this._description = "";
            this._label = "No manually assigned table field or enum value IDs";
            this._tooltip = "All table field and enum value IDs in this app are assigned using AL Object ID Ninja.";
        }
    }

    protected override getChildren(): Node[] {
        const children: Node[] = [];

        for (let key of Object.values<string>(ALObjectType)) {
            const objectsOfType = this._unassigned.filter(obj => obj.type === key);
            if (objectsOfType.length === 0) {
                continue;
            }
            children.push(new CollisionFieldObjectTypeNode(this, key as ALObjectType, objectsOfType));
        }

        return children;
    }
}
