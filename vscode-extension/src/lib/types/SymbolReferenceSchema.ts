export interface SymbolReferenceSchema {
    RuntimeVersion: string;
    Namespaces?: SymbolReferenceNamespaceSchema[];
    Tables?: SymbolReferenceTableSchema[];
    Codeunits: SymbolReferenceCodeunitSchema[];
    Pages?: SymbolReferencePageSchema[];
    Reports: Record<string, any>[];
    XmlPorts: Record<string, any>[];
    Queries: SymbolReferenceQuerySchema[];
    ControlAddIns: Record<string, any>[];
    EnumTypes: SymbolReferenceEnumTypeSchema[];
    DotNetPackages: Record<string, any>[];
    Interfaces: SymbolReferenceInterfaceSchema[];
    PermissionSets: SymbolReferencePermissionSchema[];
    PermissionSetExtensions: Record<string, any>[];
    ReportExtensions: Record<string, any>[];
    Name: string;
}
export interface SymbolReferenceNamespaceSchema {
    Namespaces?: SymbolReferenceNamespaceSchema[];
    Tables?: SymbolReferenceTableSchema[];
    Codeunits: SymbolReferenceCodeunitSchema[];
    Pages?: SymbolReferencePageSchema[];
    Reports: Record<string, any>[];
    XmlPorts: Record<string, any>[];
    Queries: SymbolReferenceQuerySchema[];
    ControlAddIns: Record<string, any>[];
    EnumTypes: SymbolReferenceEnumTypeSchema[];
    DotNetPackages: Record<string, any>[];
    Interfaces: SymbolReferenceInterfaceSchema[];
    PermissionSets: SymbolReferencePermissionSchema[];
    PermissionSetExtensions: Record<string, any>[];
    ReportExtensions: Record<string, any>[];
    Name: string;
}
export interface SymbolReferenceObjectSchema {
    ReferenceSourceFileName: string;
    Properties: Record<string, any>;
    Id: number;
    Name: string;
}
export interface SymbolReferenceTableSchema extends SymbolReferenceObjectSchema {
    Fields: Record<string, any>[];
    Keys: Record<string, any>[];
}
export interface SymbolReferenceCodeunitSchema extends SymbolReferenceObjectSchema {
    Variables: Record<string, any>[];
    Methods: Record<string, any>[];
}
export interface SymbolReferenceInterfaceSchema {
    Methods: Record<string, any>[];
    ReferenceSourceFileName: string;
    Name: string;
}
export interface SymbolReferencePermissionSchema extends SymbolReferenceObjectSchema {
    Permissions: Record<string, any>[];
}
export interface SymbolReferenceEnumTypeSchema extends SymbolReferenceObjectSchema {
    Values: Record<string, any>[];
}
export interface SymbolReferenceEnumExtensionTypeSchema {
    ReferenceSourceFileName: string;
    Id: number;
    Name: string;
    Values: Record<string, any>[];
    TargetObject: string;
}
export interface SymbolReferenceQuerySchema extends SymbolReferenceObjectSchema {
    Elements: Record<string, any>[];
}
export interface SymbolReferencePageSchema extends SymbolReferenceObjectSchema {
    Methods: Record<string, any>[];
    Controls: Record<string, any>[];
}