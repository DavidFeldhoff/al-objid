import { TreeItemCollapsibleState } from "vscode";
import { NinjaALRange } from "../../../../../lib/types/NinjaALRange";
import { AppsAwareNode, AppsAwareDescendantNode } from "../../../AppsAwareNode";
import { ContextValues } from "../../../ContextValues";
import { Node } from "../../../Node";
import {
    GoToDefinitionCommandContext,
    GoToDefinitionContext,
    GoToDefinitionFile,
    GoToDefinitionType,
} from "../../../../../commands/contexts/GoToDefinitionCommandContext";
import { LogicalRangeGroupNode } from "./LogicalRangeGroupNode";
import { LogicalRangeNamedNode } from "./LogicalRangeNamedNode";
import { NinjaIcon } from "../../../../../lib/NinjaIcon";
import { AppsCommandContext } from "../../../../../commands/contexts/AppsCommandContext";
import { getChildrenOfLogicalRangesGroupNode } from "../../../../../lib/functions/getChildrenOfLogicalRangesGroupNode";

/**
 * Displays a node that shows "Logical Ranges" label and contains the list of logical ranges.
 *
 * It contains list of children, one per logical name, where each child is one of these types:
 * - {@link LogicalRangeGroupNode} when multiple ranges (`from..to` pairs) share the same logical name (`description`)
 * - {@link LogicalRangeNamedNode} when only one range (`from..to` pair) has this logical name (`description`)
 */
export class LogicalRangesGroupNode
    extends AppsAwareDescendantNode
    implements GoToDefinitionCommandContext<NinjaALRange>, AppsCommandContext {
    protected override _iconPath = NinjaIcon["logical-range"];
    protected override _uriPathPart = "logicalranges";
    protected override readonly _label = "Logical Ranges";
    protected override readonly _collapsibleState = TreeItemCollapsibleState.Expanded;
    protected override readonly _description = ".objidconfig";
    protected override readonly _tooltip = "Logical ranges defined in .objidconfig";

    constructor(parent: AppsAwareNode) {
        super(parent);
        if (this.apps.length === 1)
            this._contextValues.push(ContextValues.GotoDef, ContextValues.ConsolidateRanges);
    }

    public override getChildren(): Node[] {
        const children: Node[] = [];
        const uniquelogicalRangeNames = Array.from(new Set(this.apps.flatMap(app => app.config.logicalRangeNames))).sort();
        const allIdRanges = this.apps.flatMap(app => app.config.idRanges);
        const uniqueIdRanges = Array.from(new Set(allIdRanges.map(range => JSON.stringify(range)))).map(range => JSON.parse(range)).sort((a, b) => a.from - b.from || a.to - b.to);
        getChildrenOfLogicalRangesGroupNode(uniquelogicalRangeNames,
            uniqueIdRanges,
            (range: NinjaALRange) => children.push(new LogicalRangeNamedNode(this, range)),
            (name: string, ranges: NinjaALRange[]) => children.push(new LogicalRangeGroupNode(this, name, ranges)));

        return children;
    }

    public get goto(): GoToDefinitionContext<NinjaALRange> {
        return {
            app: this.apps[0],
            file: GoToDefinitionFile.Configuration,
            type: GoToDefinitionType.IdRanges,
        };
    }
}
