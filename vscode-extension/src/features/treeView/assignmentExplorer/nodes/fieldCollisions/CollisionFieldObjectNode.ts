import { TreeItemLabel, TreeItemCollapsibleState, Uri, TreeItem, MarkdownString, ThemeIcon } from "vscode";
import { ALObject } from "@vjeko.com/al-parser-types-ninja";
import { AppsAwareDescendantNode, AppsAwareNode } from "../../../AppsAwareNode";
import { Node } from "../../../Node";
import { CollisionFieldNode } from "./CollisionFieldNode";
import { getAlObjectEntityIds } from "../../../../../lib/functions/getAlObjectEntityIds";

/**
 * Represents a collision object node which has field ids that were manually assigned.
 */
export class CollisionFieldObjectNode extends AppsAwareDescendantNode {
    private readonly _object: ALObject;
    protected override readonly _iconPath = ThemeIcon.File;
    protected _uriAuthority: string = "";
    protected _uriPathPart: string;
    protected _label: string | TreeItemLabel;
    protected _collapsibleState = TreeItemCollapsibleState.Expanded;
    protected _includeLogicalNameInDescription = false;
    protected _includeLogicalNameInLabel = false;

    constructor(parent: AppsAwareNode, object: ALObject) {
        super(parent);
        this._object = object;
        this._uri = Uri.file(object.path);
        this._uriPathPart = object.id.toString();
        this._label = object.path.split(/[\\|\/]/).pop()!;
        this._description = object.id.toString();
        this._tooltip = new MarkdownString(`**${getAlObjectEntityIds(object).length}** manually assigned ${object.values ? 'value' : 'field'}(s)`);
    }

    protected override completeTreeItem(item: TreeItem): void {
        super.completeTreeItem(item);
        item.command = {
            command: "vscode.open",
            arguments: [
                this._uri
            ],
            title: "",
        };
    }

    protected override getChildren(): Node[] {
        return getAlObjectEntityIds(this._object).map(fieldOrValue => new CollisionFieldNode(this, this._object, fieldOrValue));
    }
}
