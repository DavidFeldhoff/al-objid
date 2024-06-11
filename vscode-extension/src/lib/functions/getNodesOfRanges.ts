import { NinjaALRange } from "../types/NinjaALRange";

export function getNodesOfRanges(logicalRanges: NinjaALRange[], newConsumptionNode: (range: NinjaALRange, includeNames: boolean) => void, newRangesNode: (name: string, ranges: NinjaALRange[]) => void) {
    const getDescriptionFromRange = (range: NinjaALRange) => range.description || "Unknown Range";
    const logicalRangeNames = logicalRanges.reduce<string[]>((results, range) => {
        if (
            results.find(
                left => left.toLowerCase().trim() === getDescriptionFromRange(range).toLowerCase().trim()
            )
        ) {
            return results;
        }
        results.push(getDescriptionFromRange(range));
        return results;
    }, []);

    logicalRangeNames.map(name => {
        const compareName = name.toLowerCase().trim();
        const ranges = logicalRanges.filter(
            range => getDescriptionFromRange(range).toLowerCase().trim() === compareName
        );
        ranges.length === 1
            ? newConsumptionNode(ranges[0], true)
            : newRangesNode(name, ranges);
    });
}