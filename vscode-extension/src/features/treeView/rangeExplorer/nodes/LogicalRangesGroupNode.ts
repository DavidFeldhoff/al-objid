import { ThemeIcon, TreeItemCollapsibleState } from "vscode";
import { NinjaALRange } from "../../../../lib/types/NinjaALRange";
import { AppAwareNode, AppAwareDescendantNode } from "../../AppAwareNode";
import { ContextValues } from "../../ContextValues";
import { Node } from "../../Node";
import {
    GoToDefinitionCommandContext,
    GoToDefinitionContext,
    GoToDefinitionFile,
    GoToDefinitionType,
} from "../../../../commands/contexts/GoToDefinitionCommandContext";
import { LogicalRangeGroupNode } from "./LogicalRangeGroupNode";
import { LogicalRangeNamedNode } from "./LogicalRangeNamedNode";
import { NinjaIcon } from "../../../../lib/NinjaIcon";
import { AppCommandContext } from "../../../../commands/contexts/AppCommandContext";
import { getChildrenOfLogicalRangesGroupNode } from "../../../../lib/functions/getChildrenOfLogicalRangesGroupNode";

/**
 * Displays a node that shows "Logical Ranges" label and contains the list of logical ranges.
 *
 * It contains list of children, one per logical name, where each child is one of these types:
 * - {@link LogicalRangeGroupNode} when multiple ranges (`from..to` pairs) share the same logical name (`description`)
 * - {@link LogicalRangeNamedNode} when only one range (`from..to` pair) has this logical name (`description`)
 */
export class LogicalRangesGroupNode
    extends AppAwareDescendantNode
    implements GoToDefinitionCommandContext<NinjaALRange>, AppCommandContext {
    protected override _iconPath = NinjaIcon["logical-range"];
    protected override _uriPathPart = "logicalranges";
    protected override readonly _label = "Logical Ranges";
    protected override readonly _collapsibleState = TreeItemCollapsibleState.Expanded;
    protected override readonly _description = ".objidconfig";
    protected override readonly _tooltip = "Logical ranges defined in .objidconfig";

    constructor(parent: AppAwareNode) {
        super(parent);
        this._contextValues.push(ContextValues.GotoDef, ContextValues.ConsolidateRanges);
    }

    protected override getChildren(): Node[] {
        const children: Node[] = [];
        getChildrenOfLogicalRangesGroupNode(this.app.config.logicalRangeNames,
            this.app.config.idRanges,
            (range: NinjaALRange) => children.push(new LogicalRangeNamedNode(this, range)),
            (name: string, ranges: NinjaALRange[]) => children.push(new LogicalRangeGroupNode(this, name, ranges)));

        return children;
    }

    public get goto(): GoToDefinitionContext<NinjaALRange> {
        return {
            app: this.app,
            file: GoToDefinitionFile.Configuration,
            type: GoToDefinitionType.IdRanges,
        };
    }
}
