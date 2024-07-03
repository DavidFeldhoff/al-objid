// Root interface for the entire XML structure
export interface NavxManifest {
    Package: Package;
}
export interface Package {
    App: App[];
    IdRanges: IdRange[];
    Dependencies: Dependencies;
}
export interface App {
    $: AppProperties;
}
export interface AppProperties {
    Id: string;
    Name: string;
    Publisher: string;
    Brief: string;
    Description: string;
    Version: string;
    CompatibilityId: string;
    PrivacyStatement: string;
    EULA: string;
    Help: string;
    HelpBaseUrl: string;
    Url: string;
    Logo: string;
    Runtime: string;
    Target: string;
    ShowMyCode: string;
}

export interface IdRange {
    MinObjectId: string;
    MaxObjectId: string;
}

export interface Dependencies {
    Dependency: Dependency[];
}
export interface Dependency {
    Id: string;
    Name: string;
    Publisher: string;
    MinVersion: string;
    CompatibilityId: string;
}