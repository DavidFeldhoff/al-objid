import { NinjaALRange } from "../../../../../lib/types/NinjaALRange";
import { AppsAwareNode } from "../../../AppsAwareNode";
import { ContextValues } from "../../../ContextValues";
import {
    GoToDefinitionCommandContext,
    GoToDefinitionContext,
    GoToDefinitionFile,
    GoToDefinitionType,
} from "../../../../../commands/contexts/GoToDefinitionCommandContext";
import { RangeNode } from "../RangeNode";
import { LogicalRangeGroupNode } from "./LogicalRangeGroupNode";

/**
 * Represents a logical range object defined as a `from..to` pair under `idRanges` in `.objidconfig` when there are
 * multiple `from..to` pairs all sharing the same logical name (`description`).
 *
 * This node is always shown as a child of {@link LogicalRangeGroupNode}
 */
export class LogicalRangeUnnamedNode
    extends RangeNode<NinjaALRange>
    implements GoToDefinitionCommandContext<NinjaALRange> {
    protected _includeLogicalNameInDescription = false;
    protected _includeLogicalNameInLabel = false;

    constructor(parent: AppsAwareNode, range: NinjaALRange) {
        super(parent, range);
        this._contextValues.push(ContextValues.GotoDef);
    }

    public get goto(): GoToDefinitionContext<NinjaALRange> {
        return {
            app: this.apps.find(app => app.config.idRanges.some(range => JSON.stringify(range) === JSON.stringify(this._range)))!,
            file: GoToDefinitionFile.Configuration,
            type: GoToDefinitionType.Range,
            range: this._range,
        };
    }
}
