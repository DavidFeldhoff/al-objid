import { TreeItemCollapsibleState } from "vscode";
import { NinjaIcon } from "../../../../../lib/NinjaIcon";
import { ALRange } from "../../../../../lib/types/ALRange";
import { AppsAwareNode, AppsAwareDescendantNode } from "../../../AppsAwareNode";
import { ContextValues } from "../../../ContextValues";
import { Node } from "../../../Node";
import {
    GoToDefinitionCommandContext,
    GoToDefinitionContext,
    GoToDefinitionFile,
    GoToDefinitionType,
} from "../../../../../commands/contexts/GoToDefinitionCommandContext";
import { PhysicalRangeNode } from "./PhysicalRangeNode";
import { AppsCommandContext } from "../../../../../commands/contexts/AppsCommandContext";

/**
 * Displays a node that shows "Ranges" label under which all physical ranges defined in `app.json` will be shown.
 *
 * Contains children of {@link PhysicalRangeNode} type.
 */
export class PhysicalRangesGroupNode
    extends AppsAwareDescendantNode
    implements GoToDefinitionCommandContext<ALRange>, AppsCommandContext {
    protected override _iconPath = NinjaIcon["physical-range"];
    protected override _uriPathPart = "ranges";
    protected override readonly _label = "Ranges";
    protected override readonly _collapsibleState = TreeItemCollapsibleState.Expanded;
    protected override readonly _description = "app.json";
    protected override readonly _tooltip = "Physical ranges defined in app.json";

    constructor(parent: AppsAwareNode) {
        super(parent);
        if (this._contextValues.length === 1)
            this._contextValues.push(ContextValues.GotoDef, ContextValues.CopyRanges);
    }

    protected override getChildren(): Node[] {
        const allRanges = this.apps.flatMap(app => app.manifest.idRanges);
        const uniqueRanges = Array.from(new Set(allRanges.map(range => JSON.stringify(range)))).map(range => JSON.parse(range)).sort((a, b) => a.from - b.from || a.to - b.to);
        return uniqueRanges.map(range => new PhysicalRangeNode(this.parent, range));
    }

    public get goto(): GoToDefinitionContext<ALRange> {
        return {
            app: this.apps[0],
            file: GoToDefinitionFile.Manifest,
            type: GoToDefinitionType.IdRanges,
        };
    }
}
