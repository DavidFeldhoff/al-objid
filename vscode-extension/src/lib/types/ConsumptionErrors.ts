export type GetConsumptionError = {
    repo: string;
    errorBranches: GetConsumptionErrorBranch[];
};
export type GetConsumptionErrorBranch = {
    branch: string;
    errorFolders: GetConsumptionErrorFolder[];
};
export type GetConsumptionErrorFolder = {
    folder: string;
    errorEntries: GetConsumptionErrorEntry[];
};
export type GetConsumptionErrorEntry = {
    object: string;
    reason: string;
};