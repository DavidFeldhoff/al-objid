import { TreeItemCollapsibleState } from "vscode";
import {
    GoToDefinitionCommandContext,
    GoToDefinitionContext,
    GoToDefinitionFile,
    GoToDefinitionType,
} from "../../../../commands/contexts/GoToDefinitionCommandContext";
import { NinjaIcon } from "../../../../lib/NinjaIcon";
import { NinjaALRange } from "../../../../lib/types/NinjaALRange";
import { AppAwareNode } from "../../AppAwareNode";
import { ContextValues } from "../../ContextValues";
import { Node } from "../../Node";
import { LogicalObjectTypeRangeConsumptionNode } from "./LogicalObjectTypeRangeConsumptionNode";
import { LogicalObjectTypeRangesNode } from "./LogicalObjectTypeRangesNode";
import { ObjectTypeNode } from "./ObjectTypeNode";
import { consumptionNodeProperty, getNodesOfRanges, rangesNodeProperty } from "../../../../lib/functions/getNodesOfRanges";

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

    constructor(parent: AppAwareNode, objectType: string) {
        super(parent, objectType);
        this._tooltip = `Logical ranges for ${objectType} objects, defined in .objidconfig`;
        this._contextValues.push(ContextValues.GotoDef);
    }

    protected override getChildren(): Node[] {
        const logicalRanges = this.app.config.getObjectTypeRanges(this._objectType);
        const { consumptionNodes, rangesNodes } = getNodesOfRanges(logicalRanges);

        const children: Node[] = [];
        consumptionNodes.map((consumptionNode: consumptionNodeProperty) => {
            children.push(new LogicalObjectTypeRangeConsumptionNode(this, this._objectType, consumptionNode.range, consumptionNode.includeNames));
        });
        rangesNodes.map((rangesNode: rangesNodeProperty) => {
            children.push(new LogicalObjectTypeRangesNode(this, this._objectType, rangesNode.name, rangesNode.ranges));
        });
        return children;
    }

    public get goto(): GoToDefinitionContext<NinjaALRange> {
        return {
            app: this.app,
            file: GoToDefinitionFile.Configuration,
            type: GoToDefinitionType.ObjectType,
            objectType: this._objectType,
        };
    }
}