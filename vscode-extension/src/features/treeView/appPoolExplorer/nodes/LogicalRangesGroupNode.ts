import { TreeItemCollapsibleState } from "vscode";
import { NinjaALRange } from "../../../../lib/types/NinjaALRange";
import { Node } from "../../Node";
import { LogicalRangeGroupNode } from "./LogicalRangeGroupNode";
import { LogicalRangeNamedNode } from "./LogicalRangeNamedNode";
import { NinjaIcon } from "../../../../lib/NinjaIcon";
import { AppPoolAwareDescendantNode, AppPoolAwareNode } from "./AppPoolAwareNode";
import { getChildrenOfLogicalRangesGroupNode } from "../../../../lib/functions/getChildrenOfLogicalRangesGroupNode";

/**
 * Displays a node that shows "Logical Ranges" label and contains the list of logical ranges.
 *
 * It contains list of children, one per logical name, where each child is one of these types:
 * - {@link LogicalRangeGroupNode} when multiple ranges (`from..to` pairs) share the same logical name (`description`)
 * - {@link LogicalRangeNamedNode} when only one range (`from..to` pair) has this logical name (`description`)
 */
export class LogicalRangesGroupNode extends AppPoolAwareDescendantNode {
    protected override _iconPath = NinjaIcon["logical-range"];
    protected override _uriPathPart = "logicalranges";
    protected override readonly _label = "Logical Ranges";
    protected override readonly _collapsibleState = TreeItemCollapsibleState.Expanded;
    protected override readonly _description = ".objidconfig";
    protected override readonly _tooltip = "Logical ranges defined in .objidconfig";

    constructor(parent: AppPoolAwareNode) {
        super(parent);
    }

    protected override getChildren(): Node[] {
        const children: Node[] = [];
        getChildrenOfLogicalRangesGroupNode(this.rootNode.logicalRangeNames,
            this.rootNode.logicalRanges,
            (range: NinjaALRange) => children.push(new LogicalRangeNamedNode(this, range)),
            (name: string, ranges: NinjaALRange[]) => children.push(new LogicalRangeGroupNode(this, name, ranges)));

        return children;
    }
}
