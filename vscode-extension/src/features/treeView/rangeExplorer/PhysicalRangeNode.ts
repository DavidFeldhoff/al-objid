import { ALRange } from "../../../lib/types/ALRange";
import { AppAwareNode } from "../AppAwareNode";
import { ContextValues } from "../ContextValues";
import { GoToDefinitionCommandContext, GoToDefinitionContext } from "./commandContexts/GoToDefinitionCommandContext";
import { RangeNode } from "./RangeNode";

/**
 * Represents a range object defined as a [`from`, `to`] pair under `idRanges` property in `app.json`.
 */
export class PhysicalRangeNode extends RangeNode implements GoToDefinitionCommandContext {
    protected _includeLogicalNameInDescription = false;
    protected _includeLogicalNameInLabel = false;

    constructor(parent: AppAwareNode, range: ALRange) {
        super(parent, range);
        this._contextValues.push(ContextValues.gotoDef);
    }

    public get goto(): GoToDefinitionContext {
        return {
            app: this.app,
            file: "manifest",
            type: "range",
            range: this._range,
        };
    }
}
