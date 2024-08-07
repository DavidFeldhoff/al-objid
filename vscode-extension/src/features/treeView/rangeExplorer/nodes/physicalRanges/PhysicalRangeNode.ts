import { ALRange } from "../../../../../lib/types/ALRange";
import { AppsAwareNode } from "../../../AppsAwareNode";
import { ContextValues } from "../../../ContextValues";
import {
    GoToDefinitionCommandContext,
    GoToDefinitionContext,
    GoToDefinitionFile,
    GoToDefinitionType,
} from "../../../../../commands/contexts/GoToDefinitionCommandContext";
import { RangeNode } from "../RangeNode";

/**
 * Represents a range object defined as a `from..to` pair under `idRanges` in `app.json`.
 */
export class PhysicalRangeNode extends RangeNode<ALRange> implements GoToDefinitionCommandContext<ALRange> {
    protected _includeLogicalNameInDescription = false;
    protected _includeLogicalNameInLabel = false;

    constructor(parent: AppsAwareNode, range: ALRange) {
        super(parent, range);
        this._contextValues.push(ContextValues.GotoDef);
    }

    public get goto(): GoToDefinitionContext<ALRange> {
        return {
            app: this.apps.find(app => app.manifest.idRanges.some(range => JSON.stringify(range) === JSON.stringify(this.range)))!,
            file: GoToDefinitionFile.Manifest,
            type: GoToDefinitionType.Range,
            range: this._range,
        };
    }
}
