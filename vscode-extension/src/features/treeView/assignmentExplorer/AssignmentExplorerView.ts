import { ALApp } from "../../../lib/ALApp";
import { WorkspaceManager } from "../../WorkspaceManager";
import { AppsAwareNode } from "../AppsAwareNode";
import { DecorableNode } from "../DecorableNode";
import { Decoration } from "../Decoration";
import { NinjaTreeView } from "../NinjaTreeView";
import { Node } from "../Node";
import { TextNode } from "../TextNode";
import { ViewController } from "../ViewController";
import { AssignmentExplorerRootNode } from "./nodes/AssignmentExplorerRootNode";

export class AssignmentExplorerView extends NinjaTreeView {
    private _rootNodes: AssignmentExplorerRootNode[] = [];
    private _rootNodesInitialized: boolean = false;
    private _appRoots: WeakMap<ALApp, AssignmentExplorerRootNode> = new WeakMap();

    constructor(id: string) {
        super(id);
    }

    private createRootNode(app: ALApp, view: ViewController): AssignmentExplorerRootNode {
        return new AssignmentExplorerRootNode(app, view);
    }

    private getRootNode(app: ALApp): AssignmentExplorerRootNode | undefined {
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
        this._onDidChangeTreeData.fire(node);
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
        const filteredNodes = nodes.filter(node => node !== undefined) as AssignmentExplorerRootNode[];
        return filteredNodes;
    }

    protected override refreshAfterWorkspaceChange(added: ALApp[], removed: ALApp[]) {
        for (let app of removed) {
            this._appRoots.delete(app);
            for (let i = 0; i < this._rootNodes.length; i++) {
                const node = this._rootNodes[i];
                if (node.apps.every(nodeApp => removed.flatMap(r => r.hash).includes(nodeApp.hash))) {
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
    public update(node: AppsAwareNode): void {
        const apps = node.apps;
        if (apps) {
            apps.forEach(app => this._decorationsProvider.releaseDecorations(app));
        }
        this._onDidChangeTreeData.fire(node);
    }
}
