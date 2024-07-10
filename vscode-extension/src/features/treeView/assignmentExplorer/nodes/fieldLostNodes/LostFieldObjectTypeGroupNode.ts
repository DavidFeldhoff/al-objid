import { LostFieldObjectTypeNode } from "./LostFieldObjectTypeNode";
import { MarkdownString, TreeItemCollapsibleState } from "vscode";
import { NinjaIcon } from "../../../../../lib/NinjaIcon";
import { AppAwareNode, AppAwareDescendantNode } from "../../../AppAwareNode";
import { Node } from "../../../Node";
import { ALObjectType } from "../../../../../lib/types/ALObjectType";
import { AssignedALObject } from "../../../../../lib/types/AssignedALObject";

/**
 * Displays a node that shows "Lost Fields/Values" label under which either object types that have field/value conflicts, or no conflicts nodes are shown.
 *
 * Contains children of {@link LostFieldObjectTypeNode} type.
 */
export class LostFieldObjectTypeGroupNode extends AppAwareDescendantNode {
    private readonly _assigned: AssignedALObject[];
    protected override _iconPath = NinjaIcon["al-lost"];
    protected override _uriPathPart = "lostFields";
    protected override _collapsibleState = TreeItemCollapsibleState.Expanded;
    protected override _description = "Not used by any table field or enum value";
    protected override _label = "Lost Fields/Values";

    constructor(parent: AppAwareNode, assigned: AssignedALObject[]) {
        super(parent);
        this._assigned = assigned;

        if (this.parent.app.config.appPoolId) {
            this._description = "Possibly defined in another app from this pool";
            this._label = "Unknown";
        }

        if (this._assigned.length === 0) {
            this._collapsibleState = TreeItemCollapsibleState.None;
            this._iconPath = NinjaIcon["check"];
            this._description = "";
            this._label = "No lost table field or enum value IDs";
            this._tooltip = "All table fields and enum values assigned to this app using AL Object ID Ninja are currently in use";
        } else {
            this._tooltip = new MarkdownString(
                `Table field or enum value IDs that were assigned by AL Object ID Ninja but are no longer used by any object.\n\nMost likely these IDs have been assigned by a developer in the past, but the object file for which they were used has been deleted, or another ID has been assigned.\n\n**Be careful!** These IDs may also represent IDs assigned by other developers in their local branches, that have not yet been pushed and merged to the mainline. Before reclaiming these IDs, make sure they are not in use by another branch.${parent.app.config.appPoolId ? "\n\n**Be extra careful:** Since you are using app pools feature, if any IDs are assigned by an app that belongs to this pool, but is not currently loaded in your workspace, such IDs are also going to be shown here." : ""}`
            );
        }
    }

    protected override getChildren(): Node[] {
        const children: Node[] = [];

        for (let key of Object.values<string>(ALObjectType)) {
            const objectsOfType = this._assigned.filter(obj => obj.type === key);
            if (objectsOfType.length === 0) {
                continue;
            }
            children.push(new LostFieldObjectTypeNode(this, key as ALObjectType, objectsOfType));
        }

        return children;
    }
}
