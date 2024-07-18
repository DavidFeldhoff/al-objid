import { Disposable } from "vscode";
import { AppsCommandContext } from "../../../../commands/contexts/AppsCommandContext";
import { ALApp } from "../../../../lib/ALApp";
import { ConsumptionCache } from "../../../ConsumptionCache";
import { AppsAwareNode } from "../../AppsAwareNode";
import { ContextValues } from "../../ContextValues";
import { Node } from "../../Node";
import { RootNode } from "../../RootNode";
import { ViewController } from "../../ViewController";
import { LogicalRangesGroupNode } from "./logicalRanges/LogicalRangesGroupNode";
import { ObjectRangesGroupNode } from "./objectTypes/ObjectRangesGroupNode";
import { PhysicalRangesGroupNode } from "./physicalRanges/PhysicalRangesGroupNode";
import { Config } from "../../../../lib/Config";
import { RangeToShow } from "../../../../lib/types/RangeToShow";

/**
 * Represents a root node for range explorer.
 */
export class RangeExplorerRootNode extends RootNode implements AppsAwareNode, AppsCommandContext, Disposable {
    protected readonly _apps: ALApp[];
    private readonly _hasLogical: boolean;
    private readonly _hasObject: boolean;
    private readonly _subscription: Disposable;
    private readonly _configSubscription: Disposable;
    protected override readonly _uriAuthority: string;
    protected override readonly _label: string;
    protected override readonly _description: string;
    protected override readonly _tooltip: string;

    constructor(app: ALApp, view: ViewController) {
        super(view);

        this._apps = [app];
        if (app.config.appPoolId) {
            this._label = `App Pool ${app.config.appPoolId.substring(0, 8)}`;
            this._description = "";
            this._tooltip = app.config.appPoolId;
            this._uriAuthority = app.config.appPoolId;
        } else {
            this._label = app.name || app.manifest.name;
            this._description = app.manifest.version;
            this._tooltip = `${app.manifest.name} v${app.manifest.version}`;
            this._uriAuthority = app.hash;
        }
        this._contextValues.push(ContextValues.Sync);

        this._hasLogical = this._apps.flatMap(app => app.config.idRanges).length > 0;
        this._hasObject = this._apps.flatMap(app => app.config.objectTypesSpecified).length > 0;

        if (!this._hasLogical && !this._hasObject) {
            this._contextValues.push(ContextValues.CopyRanges);
        }

        // Consumptions are done based on pool or app hash, so appId (hash or pool hash) is the right choice here
        this._subscription = ConsumptionCache.instance.onConsumptionUpdate(app.appId, () => {
            this._view.update(this);
        });

        this._configSubscription = Config.instance.onConfigChanged(() =>
            this._view.update(this)
        );
    }
    attachPoolApp(app: ALApp) {
        this._apps.push(app);
        this._contextValues.filter(value => value !== ContextValues.CopyRanges);
        this._view.update(this);
    }

    protected override getChildren(): Node[] {
        let children: Node[] = [];

        const rangesToShow = Config.instance.rangesToShowInRangeExplorer;
        if (rangesToShow.includes(RangeToShow.ManifestRanges)) {
            if ((!this._hasLogical && !this._hasObject) || rangesToShow.length === 1) {
                children = new PhysicalRangesGroupNode(this).getChildren();
            } else {
                children.push(new PhysicalRangesGroupNode(this));
            }
        }

        if (this._hasLogical && rangesToShow.includes(RangeToShow.LogicalRanges)) {
            if ((children.length === 0 && !this._hasObject) || rangesToShow.length === 1) {
                children = new LogicalRangesGroupNode(this).getChildren();
            } else {
                children.push(new LogicalRangesGroupNode(this));
            }
        }

        if (this._hasObject && rangesToShow.includes(RangeToShow.ObjectRanges)) {
            if (children.length === 0) {
                children = new ObjectRangesGroupNode(this).getChildren();
            } else {
                children.push(new ObjectRangesGroupNode(this));
            }
        }

        return children;
    }

    public get apps() {
        return this._apps;
    }

    public dispose(): void {
        this._subscription.dispose();
        this._configSubscription.dispose();
    }
}
