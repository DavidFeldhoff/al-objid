import { ALObjectType } from "./ALObjectType";

export type ConsumptionDataOfObject = {
    [key in ALObjectType]: number[];
};
