import { WorkspaceManager } from "./WorkspaceManager";
import { CodeActionProvider, TextDocument, Range, CodeActionContext, CodeAction, CodeActionKind, Uri } from "vscode";
import { ALObjectType } from "../lib/types/ALObjectType";
import { getSymbolAtPosition } from "../lib/functions/getSymbolAtPosition";
import { DIAGNOSTIC_CODE } from "./Diagnostics";
import { NinjaCommand } from "../commands/commands";

export class ObjIdConfigActionProvider implements CodeActionProvider {
    private createAction(
        actions: CodeAction[],
        command: string,
        args: any[],
        title: string,
        kind: CodeActionKind = CodeActionKind.QuickFix
    ) {
        const action = new CodeAction(title);
        action.kind = kind;
        action.command = { command, arguments: args, title };
        actions.push(action);
    }

    private actions(actions: CodeAction[]) {
        return {
            objectIdConfig: {
                fixInvalidProperty: async (uri: Uri, range: Range) => {
                    const symbol = await getSymbolAtPosition(uri, range.start);
                    if (!symbol) {
                        return;
                    }
                    this.createAction(
                        actions,
                        NinjaCommand.QuickFixRemoveProperty,
                        [uri, symbol],
                        "Remove property",
                        CodeActionKind.QuickFix
                    );
                },
            },
        };
    }

    public async provideCodeActions(
        document: TextDocument,
        range: Range,
        context: CodeActionContext
    ): Promise<CodeAction[] | undefined> {
        const ninjaIssues = context.diagnostics.filter(
            diagnostic => typeof diagnostic.code === "string" && diagnostic.code.startsWith("NIN")
        );
        if (ninjaIssues.length === 0) {
            return;
        }

        const app = WorkspaceManager.instance.getALAppFromUri(document.uri);
        if (!app) {
            return;
        }

        const actions: CodeAction[] = [];
        for (let issue of ninjaIssues) {
            switch (issue.code) {
                case DIAGNOSTIC_CODE.OBJIDCONFIG.INVALID_OBJECT_TYPE:
                    const symbol = (await getSymbolAtPosition(document.uri, range.start))!;
                    const existingTypes = app.config.objectTypesSpecified;
                    const remainingTypes = Object.values<string>(ALObjectType).filter(
                        type => !existingTypes.includes(type)
                    );
                    this.createAction(
                        actions,
                        NinjaCommand.QuickFixRemoveDeclaration,
                        [app, symbol.name],
                        "Remove declaration",
                        CodeActionKind.QuickFix
                    );
                    if (remainingTypes.length > 0) {
                        this.createAction(
                            actions,
                            NinjaCommand.QuickFixSelectValidType,
                            [document, symbol.selectionRange, remainingTypes],
                            "Select valid object type",
                            CodeActionKind.QuickFix
                        );
                    }
                    break;

                case DIAGNOSTIC_CODE.OBJIDCONFIG.LICENSE_FILE_NOT_FOUND:
                    this.createAction(actions, NinjaCommand.SelectBCLicense, [app], "Select a BC license file");
                    break;

                case DIAGNOSTIC_CODE.OBJIDCONFIG.INVALID_PROPERTY:
                    await this.actions(actions).objectIdConfig.fixInvalidProperty(document.uri, range);
                    break;
            }
        }
        return actions;
    }
}
