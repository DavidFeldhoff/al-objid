import { DEFAULT_RANGE_DESCRIPTION } from "../constants";
import { NinjaALRange } from "../types/NinjaALRange";
import { getDescriptionOfRange } from "./getDescriptionOfRange";

export function getChildrenOfLogicalRangesGroupNode(logicalRangeNames: string[], logicalRanges: NinjaALRange[], newNamedNode: (range: NinjaALRange) => void, newGroupNode: (name: string, ranges: NinjaALRange[]) => void) {
    logicalRangeNames.map(name => {
        const compareName = (name || "").toLowerCase().trim();
        const ranges = logicalRanges.filter(
            range => getDescriptionOfRange(range).toLowerCase().trim() === compareName
        );
        const notUsingLogicalNames = name === DEFAULT_RANGE_DESCRIPTION && ranges.length === logicalRanges.length
        return ranges.length === 1
            ? newNamedNode(ranges[0])
            : notUsingLogicalNames
                ? ranges.forEach(range => newNamedNode(range))
                : newGroupNode(name, ranges);
    });
}