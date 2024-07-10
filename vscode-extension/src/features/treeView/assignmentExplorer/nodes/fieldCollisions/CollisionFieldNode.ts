import { TreeItemLabel, TreeItemCollapsibleState, Uri, TreeItem, Range, Position } from "vscode";
import { ALObject, ALUniqueEntity } from "@vjeko.com/al-parser-types-ninja";
import { ContextValues } from "../../../ContextValues";
import { AssignmentIdContext } from "../../../../../commands/contexts/AssignmentContext";
import { AppAwareDescendantNode, AppAwareNode } from "../../../AppAwareNode";
import { ALObjectType } from "../../../../../lib/types/ALObjectType";
import { getStorageIdLight } from "../../../../../lib/functions/getStorageIdLight";

/**
 * Represents a collision object field node defined as a field ID that was manually assigned.
 */
export class CollisionFieldNode extends AppAwareDescendantNode implements AssignmentIdContext {
    private readonly _object: ALObject;
    private readonly _fieldOrValue: ALUniqueEntity;
    protected _iconPath = undefined as unknown as string;
    protected _uriAuthority: string = "";
    protected _uriPathPart: string;
    protected _label: string | TreeItemLabel;
    protected _collapsibleState = TreeItemCollapsibleState.None;
    protected _includeLogicalNameInDescription = false;
    protected _includeLogicalNameInLabel = false;
    private _storageId: { type: string, id: number } | undefined;

    constructor(parent: AppAwareNode, object: ALObject, fieldOrValue: ALUniqueEntity) {
        super(parent);
        this._object = object;
        this._fieldOrValue = fieldOrValue;
        this._uri = Uri.file(object.path);
        this._uriPathPart = fieldOrValue.id.toString();
        this._label = fieldOrValue.name;
        this._description = fieldOrValue.id.toString();
        this._contextValues.push(ContextValues.StoreAssignment);
        this._storageId = getStorageIdLight(object);
    }

    protected override completeTreeItem(item: TreeItem): void {
        super.completeTreeItem(item);
        item.tooltip = `${this._object.values ? 'Value' : 'Field'} ID ${this._fieldOrValue.id} of ${this.objectType} ${this.objectId} has been assigned manually.`;
        item.command = {
            command: "vscode.open",
            arguments: [
                this._uri,
                {
                    selection: new Range(
                        new Position(this._fieldOrValue.line, this._fieldOrValue.character),
                        new Position(this._fieldOrValue.line, this._fieldOrValue.character + this._fieldOrValue.id.toString().length)
                    ),
                },
            ],
            title: "",
        };
    }

    public get objectType(): ALObjectType {
        return (this._storageId?.type || this._object.type) as ALObjectType;
    }

    public get objectId(): number {
        return this._storageId?.id || this._object.id;
    }

    public get fieldId(): number {
        return this._fieldOrValue.id;
    }
}
