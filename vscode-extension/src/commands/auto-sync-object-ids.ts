import { ProgressLocation, Uri, window, workspace } from "vscode";
import { AuthorizedAppConsumption } from "../lib/backend/AuthorizedAppConsumption";
import { ConsumptionInfo } from "../lib/types/ConsumptionInfo";
import { LABELS, URLS } from "../lib/constants";
import { Git, GitBranchInfo } from "../lib/Git";
import { getObjectDefinitions, getWorkspaceFolderFiles, updateActualConsumption } from "../lib/ObjectIds";
import { PropertyBag } from "../lib/types/PropertyBag";
import { QuickPickWrapper } from "../lib/QuickPickWrapper";
import { UI } from "../lib/UI";
import { Backend } from "../lib/backend/Backend";
import { LogLevel, output } from "../features/Output";
import { Telemetry } from "../lib/Telemetry";
import { WorkspaceManager } from "../features/WorkspaceManager";
import { ALApp } from "../lib/ALApp";
import { NinjaCommand } from "./commands";
import openExternal from "../lib/functions/openExternal";
import { Config } from "../lib/Config";
import { PollingHandler } from "../features/PollingHandler";
import { GetConsumptionError, GetConsumptionErrorBranch, GetConsumptionErrorFolder } from "../lib/types/ConsumptionErrors";
import { TempParserFix } from "../lib/types/TempParserFix";

const BranchInfo = {
    getName(branch: GitBranchInfo) {
        let name = "";
        if (branch.name) {
            name = branch.name;
            if (branch.tracks) {
                name += ` $(arrow-right) ${branch.tracks}`;
            }
        } else {
            name = `${branch.tracks!}`;
        }
        return name;
    },
    getDetail(branch: GitBranchInfo) {
        if (branch.name) {
            if (!branch.tracks) {
                return "Local-only branch";
            }
            if (branch.ahead === 0 && branch.behind === 0) {
                return "Local and remote branches are in sync";
            }
            if (branch.ahead) {
                let result = `Local is ahead of remote by ${branch.ahead} commit(s)`;
                if (branch.behind) {
                    result += ` and behind it by ${branch.behind} commits`;
                }
                return result;
            }
            if (branch.behind > 0) {
                return `Local is behind remote by ${branch.behind} commit(s)`;
            }
        } else {
            return "Remote-only branch";
        }
    },
    getChooseLocalText(branch: GitBranchInfo) {
        return branch.behind ? `omit ${branch.behind} remote commits` : `includes more information than remote`;
    },
    getChooseRemoteText(branch: GitBranchInfo) {
        return branch.ahead ? `omit ${branch.ahead} local commits` : `includes more information than local`;
    },
};

interface AutoSyncConfiguration {
    repo?: Uri;
    branchesLocal: string[];
    branchesRemote: string[];
    folders: Uri[];
}

function createNewConfig(repo?: Uri): AutoSyncConfiguration {
    return { repo, branchesLocal: [], branchesRemote: [], folders: [] };
}

function getRepoName(repo: Uri) {
    let parts = repo.path.split("/");
    return parts.length === 0 ? repo.toString() : parts[parts.length - 1];
}

async function updateObjectDefinitions(uri: Uri, consumption: ConsumptionInfo) {
    const uris = await getWorkspaceFolderFiles(uri);
    const objects = await getObjectDefinitions(uris, <TempParserFix>{ shouldFixFullyQualifiedName: true, updateDependencyCache: false });
    return await updateActualConsumption(objects, consumption, false);
}

async function syncFoldersForConfiguration(config: AutoSyncConfiguration, consumptions: PropertyBag<ConsumptionInfo>) {
    const errorFolders: GetConsumptionErrorFolder[] = [];
    for (let folder of config.folders) {
        if (!consumptions[folder.fsPath]) {
            consumptions[folder.fsPath] = {};
        }
        output.log(`[auto-sync-object-ids] Start updating object definitions for ${folder.fsPath}...`, LogLevel.Verbose);
        const errorEntries = await updateObjectDefinitions(folder, consumptions[folder.fsPath]);
        if (errorEntries.length > 0) {
            errorFolders.push({ folder: folder.fsPath, errorEntries });
        }
        output.log(`[auto-sync-object-ids] Updating object definitions for ${folder.fsPath} done.`, LogLevel.Verbose);
    }
    return errorFolders;
}

async function syncSingleConfiguration(config: AutoSyncConfiguration, consumptions: PropertyBag<ConsumptionInfo>) {
    const { repo, branchesLocal, branchesRemote } = config;
    let branchErrors: GetConsumptionErrorBranch[] = [];
    if (repo) {
        output.log(`[auto-sync-object-ids] Get current branch name of ${getRepoName(repo)}...`, LogLevel.Verbose);
        let currentBranch = await Git.instance.getCurrentBranchName(repo);
        output.log(`[auto-sync-object-ids] Current branch name of ${getRepoName(repo)} is ${currentBranch}.`, LogLevel.Verbose);
        if (branchesLocal) {
            output.log(`[auto-sync-object-ids] Start iterating over local branches`, LogLevel.Verbose);
            for (let branch of branchesLocal) {
                if (branch !== currentBranch) {
                    output.log(`[auto-sync-object-ids] Switching to branch ${branch}...`, LogLevel.Verbose);
                    await Git.instance.checkout(repo, branch);
                }
                output.log(`[auto-sync-object-ids] Synchronizing folders for branch ${branch}...`, LogLevel.Verbose);

                const errorFolders = await syncFoldersForConfiguration(config, consumptions);
                if (errorFolders.length > 0) {
                    branchErrors.push({ branch, errorFolders });
                }

                if (branch !== currentBranch) {
                    output.log(`[auto-sync-object-ids] Switching back to branch ${currentBranch}...`, LogLevel.Verbose);
                    await Git.instance.checkout(repo, currentBranch);
                }
            }
        }
        if (branchesRemote) {
            output.log(`[auto-sync-object-ids] Start iterating over remote branches`, LogLevel.Verbose);
            for (let branch of branchesRemote) {
                let newBranch = `al-object-id-ninja-remote/${Date.now()}/${branch}`;
                output.log(`[auto-sync-object-ids] Creating temporary branch ${newBranch}...`, LogLevel.Verbose);
                await Git.instance.trackRemoteBranch(repo, branch, newBranch);
                output.log(`[auto-sync-object-ids] Switching to new branch ${newBranch}...`, LogLevel.Verbose);
                await Git.instance.checkout(repo, newBranch);

                output.log(`[auto-sync-object-ids] Synchronizing folders for branch ${newBranch}...`, LogLevel.Verbose);
                const errorFolders = await syncFoldersForConfiguration(config, consumptions);
                if (errorFolders.length > 0) {
                    branchErrors.push({ branch, errorFolders });
                }

                output.log(`[auto-sync-object-ids] Switching back to branch ${currentBranch}...`, LogLevel.Verbose);
                await Git.instance.checkout(repo, currentBranch);
                output.log(`[auto-sync-object-ids] Delete created branch ${newBranch}...`, LogLevel.Verbose);
                await Git.instance.deleteBranch(repo, newBranch);
            }
        }
        return branchErrors;
    }
    output.log(`[auto-sync-object-ids] Synchronizing folders without repo (Config: ${JSON.stringify(config)})`, LogLevel.Verbose);
    const errorFolders = await syncFoldersForConfiguration(config, consumptions);
    if (errorFolders.length > 0) {
        branchErrors.push({ branch: "no git repo", errorFolders });
    }
    return branchErrors;
}

function compressConsumption(consumption: ConsumptionInfo) {
    for (let key of Object.keys(consumption)) {
        consumption[key] = [...new Set(consumption[key])].sort();
    }
}

function compressConsumptions(consumptions: PropertyBag<ConsumptionInfo>, apps: ALApp[]) {
    // First pass: consolidate per app pool
    const appMap: PropertyBag<string> = {};
    for (let key of Object.keys(consumptions)) {
        let app = apps.find(app => app.uri.fsPath === key)!;
        const { appPoolId } = app.config;
        if (!appPoolId) {
            continue;
        }

        if (!appMap[appPoolId]) {
            appMap[appPoolId] = key;
            continue;
        }

        const poolConsumption = consumptions[appMap[appPoolId]];
        const appConsumption = consumptions[key];
        delete consumptions[key];

        for (let type of Object.keys(appConsumption)) {
            if (poolConsumption[type]) {
                poolConsumption[type] = [...poolConsumption[type], ...appConsumption[type]];
            } else {
                poolConsumption[type] = appConsumption[type];
            }
        }
    }

    // Second pass: compress
    for (let key of Object.keys(consumptions)) {
        compressConsumption(consumptions[key]);
    }
}

function authorizeConsumptions(consumptions: PropertyBag<ConsumptionInfo>, apps: ALApp[]): AuthorizedAppConsumption[] {
    let result: AuthorizedAppConsumption[] = [];
    for (let key of Object.keys(consumptions)) {
        let app = apps.find(app => app.uri.fsPath === key)!;
        result.push({
            appId: app.appId,
            authKey: app.config.authKey,
            ids: consumptions[key],
        });
    }

    return result;
}

const AutoSyncResult = {
    Success: Symbol("Success"),
    SuccessWithWarnings: Symbol("SuccessWithWarnings"),
    NoALFolders: Symbol("NoALFolders"),
    SilentFailure: Symbol("SilentFailure"),
    GitDirty: Symbol("GitDirty"),
};

function autoSyncResult(status: symbol, context?: any): { status: symbol; context: any } {
    return { status, context };
}

export const autoSyncObjectIds = async () => {
    let auto = false;
    switch (await UI.sync.showHowToAutoSync()) {
        case LABELS.AUTO_SYNC_PICK.FULL_AUTO:
            auto = true;
            break;
        case LABELS.AUTO_SYNC_PICK.LEARN_MORE:
            openExternal(URLS.AUTO_SYNC);
            return;
        case LABELS.AUTO_SYNC_PICK.INTERACTIVE:
            break;
        default:
            return;
    }

    let result = await window.withProgress({ location: ProgressLocation.Notification }, async progress => {
        if (!workspace.workspaceFolders || !workspace.workspaceFolders.length) {
            return autoSyncResult(AutoSyncResult.NoALFolders);
        }

        // Pick folders
        let apps = auto ? WorkspaceManager.instance.alApps : await WorkspaceManager.instance.pickFolders();
        if (!apps || !apps.length) {
            return autoSyncResult(AutoSyncResult.SilentFailure);
        }

        // Load dependencies once to use the cached ones later
        for (let app of apps) {
            await app.getDependencies();
        }

        // Deactivate updates due avoid conflicts on heavy branch switching
        apps.forEach(app => app.setUpdatesPaused(true));
        Config.instance.setUpdatesPaused(true);
        PollingHandler.instance.setUpdatesPaused(true);

        // Find git repos that match picked folders
        progress.report({ message: "Connecting to Git..." });
        let repos: Uri[] = [];
        let repoFolders: PropertyBag<Uri[]> = {};
        let setup: AutoSyncConfiguration[] = [];
        let nonGit = createNewConfig();
        setup.push(nonGit);
        for (let app of apps) {
            let root = await Git.instance.getRepositoryRootUri(app.uri);
            if (!root) {
                nonGit.folders.push(app.uri);
                continue;
            }

            let repoPath = root.fsPath;
            if (!repoFolders[repoPath]) {
                repoFolders[repoPath] = [];
            }
            repoFolders[repoPath].push(app.uri);

            if (repos.find(repo => repo.fsPath === repoPath)) {
                continue;
            }

            if (!(await Git.instance.isClean(root))) {
                return autoSyncResult(AutoSyncResult.GitDirty, root);
            }
            repos.push(root);
        }

        // Iterate through all repos to obtain branch information
        let branches: PropertyBag<GitBranchInfo[] | null> = {};
        let i = 0;
        for (let repo of repos) {
            progress.report({
                message: `Fetching branch information for ${getRepoName(repo)} (${++i} of ${repos.length})...`,
            });

            // Fetch
            await Git.instance.fetch(repo);

            // Obtain branches
            branches[repo.fsPath] = await Git.instance.branches(repo);
            if (branches === null) {
                // For some reason, repository reports no branches
                continue;
            }
        }

        // Iterate through all repos and pick the branches
        for (let repo of repos) {
            let repoBranches = branches[repo.fsPath];
            if (repoBranches === null) {
                continue;
            }

            // Pick from list of branches
            if (repoBranches.length > 1 && !auto) {
                progress.report({
                    message: "Waiting for your branches selection...",
                });
                let quickPick = new QuickPickWrapper<GitBranchInfo>(
                    repoBranches.map(branch => ({
                        label: BranchInfo.getName(branch),
                        detail: BranchInfo.getDetail(branch),
                        description: "",
                        data: branch,
                    }))
                );
                quickPick.placeholder = `Which branches would you like to synchronize for ${getRepoName(repo)}?`;
                let picked = await quickPick.pickMany();
                if (!picked.length) {
                    continue;
                }
                repoBranches = picked;
            }

            // For each branch, if local is ahead/behind, ask whether to use local, remote, or both (and also indicate how many commits is difference)
            let config: AutoSyncConfiguration = createNewConfig(repo);
            for (let branch of repoBranches) {
                progress.report({
                    message: `Progressing branch ${branch.name || branch.tracks} of ${getRepoName(repo)}`,
                });
                if (branch.ahead || branch.behind) {
                    if (auto) {
                        if (branch.ahead) {
                            config.branchesLocal.push(branch.name!);
                        }
                        if (branch.behind) {
                            config.branchesRemote.push(branch.name!);
                        }
                    } else {
                        let picks = [
                            `Local (${BranchInfo.getChooseLocalText(branch)})`,
                            `Remote (${BranchInfo.getChooseRemoteText(branch)})`,
                        ];
                        if (branch.ahead && branch.behind) {
                            picks.push(`Both (includes all information from local and remote)`);
                        }
                        let choice = await window.showQuickPick(picks, {
                            placeHolder: `How do you want to synchronize branch ${branch.name} of ${getRepoName(
                                repo
                            )}?`,
                        });
                        if (!choice) {
                            continue;
                        }
                        switch (choice.split(" ")[0]) {
                            case "Local":
                                config.branchesLocal.push(branch.name!);
                                break;
                            case "Remote":
                                config.branchesRemote.push(branch.tracks!);
                                break;
                            case "Both":
                                config.branchesRemote.push(branch.tracks!);
                                config.branchesLocal.push(branch.name!);
                                break;
                        }
                    }
                } else {
                    if (branch.name) {
                        // If local branch exists, then it's used even if remote exists
                        config.branchesLocal.push(branch.name);
                    } else {
                        // If local branch does not exist, then it's a remote branch and must be used
                        config.branchesRemote.push(branch.tracks!);
                    }
                }
            }
            config.folders = repoFolders[repo.fsPath];
            setup.push(config);
        }

        let consumptions: PropertyBag<ConsumptionInfo> = {};
        const syncErrors: GetConsumptionError[] = [];
        for (let config of setup.filter(config => config.folders.length > 0)) {
            progress.report({
                message: `Finding object IDs in ${config.repo ? `repo ${getRepoName(config.repo)}` : "workspace"}...`,
            });
            const errorBranches = await syncSingleConfiguration(config, consumptions);
            if (Object.keys(errorBranches).length > 0) {
                syncErrors.push({ repo: config.repo?.fsPath || "workspace", errorBranches });
            }
        }

        // Activate updates again after heavy branch switching
        apps.forEach(app => app.setUpdatesPaused(false));
        Config.instance.setUpdatesPaused(false);
        PollingHandler.instance.setUpdatesPaused(false);

        compressConsumptions(consumptions, apps);
        let payload = authorizeConsumptions(consumptions, apps);

        Telemetry.instance.logCommand(NinjaCommand.AutoSyncObjectIds);
        await Backend.autoSyncIds(payload, false);
        if (Object.keys(syncErrors).length === 0) {
            return autoSyncResult(AutoSyncResult.Success);
        } else {
            return autoSyncResult(AutoSyncResult.SuccessWithWarnings, syncErrors);
        }

    });

    switch (result.status) {
        case AutoSyncResult.Success:
            output.log("[auto-sync-object-ids] Completed successfully.", LogLevel.Info);
            UI.sync.showSuccessInfo();
            break;
        case AutoSyncResult.SuccessWithWarnings:
            output.log(`[auto-sync-object-ids] Completed successfully, but with warnings. ${JSON.stringify(result.context)}`, LogLevel.Info);
            await window.showTextDocument(await workspace.openTextDocument({ language: 'json', content: JSON.stringify(result.context, null, 2) }));
            UI.sync.showSuccessWithWarning();
            break;
        case AutoSyncResult.NoALFolders:
            output.log("[auto-sync-object-ids] No AL folders found in the workspace.", LogLevel.Info);
            break;
        case AutoSyncResult.GitDirty:
            let repoName = getRepoName(result.context);
            output.log(`[auto-sync-object-ids] Git repository ${repoName} is dirty. Cannot auto sync.`, LogLevel.Info);
            if ((await UI.sync.showRepoNotClean(repoName)) === LABELS.BUTTON_LEARN_MORE) {
                openExternal(URLS.AUTO_SYNC_DIRTY);
            }
            break;
    }
};