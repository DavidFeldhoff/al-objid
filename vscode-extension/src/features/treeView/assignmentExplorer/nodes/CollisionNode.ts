import { TreeItemLabel, TreeItemCollapsibleState, Uri, TreeItem, Range, Position } from "vscode";
import { ALObject } from "@vjeko.com/al-parser-types-ninja";
import { ContextValues } from "../../ContextValues";
import { AssignmentIdContext } from "../../../../commands/contexts/AssignmentContext";
import { AppsAwareDescendantNode, AppsAwareNode } from "../../AppsAwareNode";
import { ALObjectType } from "../../../../lib/types/ALObjectType";
import { ALApp } from "../../../../lib/ALApp";

/**
 * Represents a collision object node defined as an object ID that was manually assigned.
 */
export class CollisionNode extends AppsAwareDescendantNode implements AssignmentIdContext {
    private readonly _object: ALObject;
    protected _iconPath = undefined as unknown as string;
    protected _uriAuthority: string = "";
    protected _uriPathPart: string = "";
    protected _label: string | TreeItemLabel;
    protected _collapsibleState = TreeItemCollapsibleState.None;
    protected _includeLogicalNameInDescription = false;
    protected _includeLogicalNameInLabel = false;

    constructor(parent: AppsAwareNode, object: ALObject) {
        super(parent);
        this._object = object;
        this._uri = Uri.file(object.path);
        this._label = object.path.split(/[\\|\/]/).pop()!;
        this._description = object.id.toString();
        if (this.apps.every(app => app.config.appPoolId === this.apps[0].config.appPoolId)) {
            this._contextValues.push(ContextValues.StoreAssignment);
        }
    }

    protected override completeTreeItem(item: TreeItem): void {
        item.resourceUri = Uri.parse(this._object.path);
        item.tooltip = `Object ID ${this._object.id} has been assigned manually`;
        item.command = {
            command: "vscode.open",
            arguments: [
                this._uri,
                {
                    selection: new Range(
                        new Position(this._object.line, this._object.character),
                        new Position(this._object.line, this._object.character + this._object.id.toString().length)
                    ),
                },
            ],
            title: "",
        };
    }

    // AssignmentIdContext implementation
    public get app(): ALApp {
        return this.apps[0];
    }

    public get objectType(): ALObjectType {
        return this._object.type as ALObjectType;
    }

    public get objectId(): number {
        return this._object.id;
    }
}
