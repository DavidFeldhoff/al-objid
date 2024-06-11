import { ALApp } from "../ALApp";
import { SymbolReferenceSchema } from "./SymbolReferenceSchema";

export interface SymbolReference {
    app: ALApp;
    fsPath: string;
    fileLastModified: Date;
    symbolReferenceSchema: SymbolReferenceSchema;
}