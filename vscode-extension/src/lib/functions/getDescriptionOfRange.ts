import { DEFAULT_RANGE_DESCRIPTION } from "../constants";
import { NinjaALRange } from "../types/NinjaALRange";

export function getDescriptionOfRange(range: NinjaALRange) {
    return range.description || DEFAULT_RANGE_DESCRIPTION
};
