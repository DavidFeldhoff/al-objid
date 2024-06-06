import { NinjaALRange } from "../types/NinjaALRange";

export function getNodesOfRanges(logicalRanges: NinjaALRange[]): { consumptionNodes: ConsumptionNodeProperty[]; rangesNodes: RangesNodeProperty[] } {
    const consumptionNodes: ConsumptionNodeProperty[] = [];
    const rangesNodes: RangesNodeProperty[] = [];
    const logicalRangeNames = logicalRanges.reduce<string[]>((results, range) => {
        if ((range.description || "").trim() === "") {
            return results;
        }
        if (
            results.find(
                left => left.toLowerCase().trim() === range.description.toLowerCase().trim()
            )
        ) {
            return results;
        }
        results.push(range.description);
        return results;
    }, []);

    logicalRangeNames.map(name => {
        const compareName = name.toLowerCase().trim();
        const ranges = logicalRanges.filter(
            range => (range.description || "").toLowerCase().trim() === compareName
        );
        ranges.length === 1
            ? consumptionNodes.push({ range: ranges[0], includeNames: true })
            : rangesNodes.push({ name: name, ranges: ranges });
    });

    const rangesWithoutDescription = logicalRanges.filter(range => (range.description || "").trim() === "");
    rangesWithoutDescription.map(range => {
        consumptionNodes.push({ range: range, includeNames: false });
    });
    return { consumptionNodes, rangesNodes };
}

export interface ConsumptionNodeProperty { range: NinjaALRange; includeNames: boolean; }
export interface RangesNodeProperty { name: string; ranges: NinjaALRange[]; }