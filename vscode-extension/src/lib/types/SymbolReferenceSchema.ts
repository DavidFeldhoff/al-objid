export interface SymbolReferenceRoot {
    RuntimeVersion: string;
    Namespaces?: SymbolReferenceNamespace[];
    Tables?: SymbolReferenceTable[];
    Codeunits: SymbolReferenceCodeunit[];
    Pages?: SymbolReferencePage[];
    Reports: Record<string, any>[];
    XmlPorts: Record<string, any>[];
    Queries: SymbolReferenceQuery[];
    ControlAddIns: Record<string, any>[];
    EnumTypes: SymbolReferenceEnumType[];
    DotNetPackages: Record<string, any>[];
    Interfaces: SymbolReferenceInterface[];
    PermissionSets: SymbolReferencePermission[];
    PermissionSetExtensions: Record<string, any>[];
    ReportExtensions: Record<string, any>[];
    Name: string;
}
export interface SymbolReferenceNamespace {
    Namespaces?: SymbolReferenceNamespace[];
    Tables?: SymbolReferenceTable[];
    Codeunits: SymbolReferenceCodeunit[];
    Pages?: SymbolReferencePage[];
    Reports: Record<string, any>[];
    XmlPorts: Record<string, any>[];
    Queries: SymbolReferenceQuery[];
    ControlAddIns: Record<string, any>[];
    EnumTypes: SymbolReferenceEnumType[];
    DotNetPackages: Record<string, any>[];
    Interfaces: SymbolReferenceInterface[];
    PermissionSets: SymbolReferencePermission[];
    PermissionSetExtensions: Record<string, any>[];
    ReportExtensions: Record<string, any>[];
    Name: string;
}
export interface SymbolReferenceObject {
    ReferenceSourceFileName: string;
    Properties: Record<string, any>;
    Id: number;
    Name: string;
}
export interface SymbolReferenceTable extends SymbolReferenceObject {
    Fields: Record<string, any>[];
    Keys: Record<string, any>[];
}
export interface SymbolReferenceCodeunit extends SymbolReferenceObject {
    Variables: Record<string, any>[];
    Methods: Record<string, any>[];
}
export interface SymbolReferenceInterface {
    Methods: Record<string, any>[];
    ReferenceSourceFileName: string;
    Name: string;
}
export interface SymbolReferencePermission extends SymbolReferenceObject {
    Permissions: Record<string, any>[];
}
export interface SymbolReferenceEnumType extends SymbolReferenceObject {
    Values: Record<string, any>[];
}
export interface SymbolReferenceEnumExtensionTypeSchema {
    ReferenceSourceFileName: string;
    Id: number;
    Name: string;
    Values: Record<string, any>[];
    TargetObject: string;
}
export interface SymbolReferenceQuery extends SymbolReferenceObject {
    Elements: Record<string, any>[];
}
export interface SymbolReferencePage extends SymbolReferenceObject {
    Methods: Record<string, any>[];
    Controls: Record<string, any>[];
}