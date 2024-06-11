import { DEFAULT_RANGE_DESCRIPTION } from "../constants";
import { NinjaALRange } from "../types/NinjaALRange";
import { getDescriptionOfRange } from "./getDescriptionOfRange";

export function getChildrenOfLogicalObjectTypeNode(logicalRanges: NinjaALRange[], newConsumptionNode: (range: NinjaALRange, includeNames: boolean) => void, newRangesNode: (name: string, ranges: NinjaALRange[]) => void) {
    const logicalRangeNames = logicalRanges.reduce<string[]>((results, range) => {
        if (
            results.find(
                left => left.toLowerCase().trim() === getDescriptionOfRange(range).toLowerCase().trim()
            )
        ) {
            return results;
        }
        results.push(getDescriptionOfRange(range));
        return results;
    }, []);

    logicalRangeNames.map(name => {
        const compareName = name.toLowerCase().trim();
        const ranges = logicalRanges.filter(
            range => getDescriptionOfRange(range).toLowerCase().trim() === compareName
        );
        const notUsingLogicalNames = name === DEFAULT_RANGE_DESCRIPTION && ranges.length === logicalRanges.length
        ranges.length === 1
            ? newConsumptionNode(ranges[0], true)
            : notUsingLogicalNames
                ? ranges.forEach(range => newConsumptionNode(range, true))
                : newRangesNode(name, ranges);
    });
}