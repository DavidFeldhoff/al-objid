import { ALApp } from "../../../lib/ALApp";
import { WorkspaceManager } from "../../WorkspaceManager";
import { AppsAwareNode } from "../AppsAwareNode";
import { DecorableNode } from "../DecorableNode";
import { Decoration } from "../Decoration";
import { NinjaTreeView } from "../NinjaTreeView";
import { Node } from "../Node";
import { TextNode } from "../TextNode";
import { ViewController } from "../ViewController";
import { RangeExplorerRootNode } from "./nodes/RangeExplorerRootNode";

// TODO Show individual IDs in range explorer, title = object id, description = file path
// When clicking on object id, opens the document and selects that id
// For any object consumed not by this repo, indicate with a different color that it comes from another repo
// For any such object, add commands:
// - "Investigate": checks if the object is in another branch, and if not, adds an "investigation token" in
//                  the back end that every other user will pick up and report back if they have this object
//                  in their repos, and if not, back end reports back and indicates that this object id is
//                  probably safe to release. For this we SHOULD keep name, date, time, of every object id
//                  assignment made through Ninja
// - "Release":     releases the ID in the back end and makes it available for re-assignment

export class RangeExplorerView extends NinjaTreeView {
    private _rootNodes: RangeExplorerRootNode[] = [];
    private _rootNodesInitialized: boolean = false;
    private _appRoots: WeakMap<ALApp, RangeExplorerRootNode> = new WeakMap();

    constructor(id: string) {
        super(id);
    }

    private createRootNode(app: ALApp, view: ViewController): RangeExplorerRootNode {
        return new RangeExplorerRootNode(app, view);
    }

    private getRootNode(app: ALApp): RangeExplorerRootNode | undefined {
        const existingNode = this._rootNodes.find(rootNode => rootNode.apps.some(rootNodeApp => rootNodeApp.config.appPoolId && rootNodeApp.config.appPoolId === app.config.appPoolId));
        if (existingNode) {
            // We are inside an app pool, obviously
            existingNode.attachPoolApp(app);
            return;
        }

        const rootNode = this.createRootNode(app, this);

        this._appRoots.set(app, rootNode);
        this._rootNodes.push(rootNode);
        return rootNode;
    }

    protected override refreshAfterConfigChange(app: ALApp): void {
        const node = this._appRoots.get(app);
        if (node && node.uri.authority === app.appId) {
            this._onDidChangeTreeData.fire(node);
        } else {
            // uri.authority which is app.hash or poolId has changed = root node has changed
            this._rootNodesInitialized = false;
            this._onDidChangeTreeData.fire();
        }
        return;
    }

    protected override getRootNodes(): Node[] | Promise<Node[]> {
        if (this._rootNodesInitialized) {
            return this._rootNodes;
        }

        this.disposeRootNodes();

        this._appRoots = new WeakMap();
        this._rootNodes = [];
        this._rootNodesInitialized = true;

        let apps = WorkspaceManager.instance.alApps;
        if (apps.length === 0) {
            return [new TextNode("No AL workspaces are open.", "There is nothing to show here.")];
        }

        const nodes = apps.map(app => this.getRootNode(app));
        const filteredNodes = nodes.filter(node => node !== undefined) as RangeExplorerRootNode[];
        return filteredNodes;
    }

    protected override refreshAfterWorkspaceChange(added: ALApp[], removed: ALApp[]) {
        for (let app of removed) {
            this._appRoots.delete(app);
            for (let i = 0; i < this._rootNodes.length; i++) {
                const node = this._rootNodes[i];
                if (node.apps.every(app => removed.flatMap(r => r.hash).includes(app.hash))) {
                    this._rootNodes.splice(i, 1);
                    node.dispose();
                    break;
                }
            }
        }

        for (let app of added) {
            this.getRootNode(app);
        }

        this._expandCollapseController.reset();
        this.refresh();
    }

    protected override decorate(element: DecorableNode, decoration: Decoration): void {
        this._decorationsProvider.decorate(element.uri, decoration);
    }

    private disposeRootNodes(): void {
        for (let node of this._rootNodes) {
            node.dispose();
        }
    }

    protected override disposeExtended(): void {
        this.disposeRootNodes();
    }

    // Implements ViewController
    public update(node: Node): void {
        const apps = (node as AppsAwareNode).apps;
        if (apps) {
            apps.forEach(app => this._decorationsProvider.releaseDecorations(app));
        }
        this._onDidChangeTreeData.fire(node);
    }
}
