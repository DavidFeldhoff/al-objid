import { TreeItemCollapsibleState } from "vscode";
import {
    GoToDefinitionCommandContext,
    GoToDefinitionContext,
    GoToDefinitionFile,
    GoToDefinitionType,
} from "../../../../../commands/contexts/GoToDefinitionCommandContext";
import { NinjaIcon } from "../../../../../lib/NinjaIcon";
import { NinjaALRange } from "../../../../../lib/types/NinjaALRange";
import { AppsAwareNode } from "../../../AppsAwareNode";
import { ContextValues } from "../../../ContextValues";
import { Node } from "../../../Node";
import { LogicalObjectTypeRangeConsumptionNode } from "./LogicalObjectTypeRangeConsumptionNode";
import { LogicalObjectTypeRangesNode } from "./LogicalObjectTypeRangesNode";
import { ObjectTypeNode } from "../ObjectTypeNode";
import { getChildrenOfLogicalObjectTypeNode } from "../../../../../lib/functions/getChildrenOfLogicalObjectTypeNode";

/**
 * Represents an individual logical object type specified under `objectTypes` in `.objidconfig`.
 *
 * The label for this node is always equal to object type.
 *
 * This node contains children, one per each unique `description` represented among ranges defined for this object
 * type, where child type can be:
 * - {@link LogicalObjectTypeRangeNode} if multiple ranges all have this same `description` property, there is only
 * one child node of this type, that will then have its subchildren of {@link LogicalObjectTypeRangeConsumptionNode}
 * type
 * - {@link LogicalObjectTypeRangeConsumptionNode} if only a single range has this `description`
 */
export class LogicalObjectTypeNode extends ObjectTypeNode implements GoToDefinitionCommandContext<NinjaALRange> {
    protected override readonly _iconPath = NinjaIcon["object-ranges-type"];
    protected override readonly _collapsibleState = TreeItemCollapsibleState.Expanded;

    constructor(parent: AppsAwareNode, objectType: string) {
        super(parent, objectType);
        this._tooltip = `Logical ranges for ${objectType} objects, defined in .objidconfig`;
        if (this.apps.length === 1)
            this._contextValues.push(ContextValues.GotoDef);
    }

    protected override getChildren(): Node[] {
        const children: Node[] = [];
        const allRanges = this.apps.flatMap(app => app.config.getObjectTypeRanges(this._objectType));
        const uniqueRanges = Array.from(new Set(allRanges.map(range => JSON.stringify(range)))).map(range => JSON.parse(range)).sort((a, b) => a.from - b.from || a.to - b.to);
        getChildrenOfLogicalObjectTypeNode(uniqueRanges,
            (range: NinjaALRange, includeNames: boolean) => children.push(new LogicalObjectTypeRangeConsumptionNode(this, this._objectType, range, includeNames)),
            (name: string, ranges: NinjaALRange[]) => children.push(new LogicalObjectTypeRangesNode(this, this._objectType, name, ranges)));
        return children;
    }

    public get goto(): GoToDefinitionContext<NinjaALRange> {
        return {
            app: this.apps[0],
            file: GoToDefinitionFile.Configuration,
            type: GoToDefinitionType.ObjectType,
            objectType: this._objectType,
        };
    }
}