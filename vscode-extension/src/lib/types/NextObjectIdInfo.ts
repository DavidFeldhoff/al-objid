export interface NextObjectIdInfo {
    _appInfo: any;
    id: number | number[];
    updated: boolean;
    available: boolean;
    updateAttempts: number;
    hasConsumption: boolean;
    perRange?: boolean;
    require?: number;
    redirectExtensions?: true;
}
