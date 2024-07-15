import { ALApp } from "../../lib/ALApp";
import { ALRange } from "../../lib/types/ALRange";
import { NinjaALRange } from "../../lib/types/NinjaALRange";
import { DecorableDescendantNode } from "./DecorableNode";
import { Node } from "./Node";

export interface AppsAwareNode extends Node {
    readonly apps: ALApp[];
}

export abstract class AppsAwareDescendantNode extends DecorableDescendantNode {
    protected override readonly _uriAuthority: string;

    constructor(parent: AppsAwareNode) {
        super(parent);
        this._uriAuthority = parent.apps[0].appId;
    }

    public get apps() {
        return this.parent.apps;
    }

    public get parent(): AppsAwareNode {
        return this._parent as AppsAwareNode;
    }
}
