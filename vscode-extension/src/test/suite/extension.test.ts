import * as assert from 'assert';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
import { NinjaALRange } from '../../lib/types/NinjaALRange';
import { getChildrenOfLogicalObjectTypeNode } from '../../lib/functions/getChildrenOfLogicalObjectTypeNode';
import { getDescriptionOfRange } from '../../lib/functions/getDescriptionOfRange';
import { DEFAULT_RANGE_DESCRIPTION } from '../../lib/constants';
// import * as myExtension from '../../extension';

suite('RangeExplorer TestSuite', () => {
	vscode.window.showInformationMessage('Start all tests.');

	test('Single Range with description', () => {
		const ninjaALRanges: NinjaALRange[] = [];
		ninjaALRanges.push({
			from: 1,
			to: 2,
			description: "Sales"
		});
		const { consumptionNodes, rangesNodes } = callGetNodesOfRanges(ninjaALRanges);
		assert.strictEqual(consumptionNodes.length, 1);
		verifySingleEntry(consumptionNodes[0], true, 1, 2, "Sales");

		assert.strictEqual(rangesNodes.length, 0);
	});
	test('Single Range without description', () => {
		const ninjaALRanges: NinjaALRange[] = [];
		ninjaALRanges.push({
			from: 1,
			to: 2,
			description: ""
		});
		const { consumptionNodes, rangesNodes } = callGetNodesOfRanges(ninjaALRanges);
		assert.strictEqual(consumptionNodes.length, 1);
		verifySingleEntry(consumptionNodes[0], true, 1, 2, DEFAULT_RANGE_DESCRIPTION);

		assert.strictEqual(rangesNodes.length, 0);
	});
	test('Multiple Ranges with same description', () => {
		const ninjaALRanges: NinjaALRange[] = [];
		ninjaALRanges.push(
			{
				from: 1,
				to: 2,
				description: "Sales"
			},
			{
				from: 10,
				to: 20,
				description: "Sales"
			}
		);
		const { consumptionNodes, rangesNodes } = callGetNodesOfRanges(ninjaALRanges);
		assert.strictEqual(consumptionNodes.length, 0);

		assert.strictEqual(rangesNodes.length, 1);
		verifyMultiEntry(rangesNodes[0], "Sales", [{ "from": 1, "to": 2 }, { "from": 10, "to": 20 }]);
	});
	test('Multiple Ranges without description', () => {
		const ninjaALRanges: NinjaALRange[] = [];
		ninjaALRanges.push(
			{
				from: 1,
				to: 2,
				description: ""
			},
			{
				from: 10,
				to: 20,
				description: ""
			}
		);
		const { consumptionNodes, rangesNodes } = callGetNodesOfRanges(ninjaALRanges);
		assert.strictEqual(consumptionNodes.length, 2);
		verifySingleEntry(consumptionNodes[0], true, 1, 2, DEFAULT_RANGE_DESCRIPTION);
		verifySingleEntry(consumptionNodes[1], true, 10, 20, DEFAULT_RANGE_DESCRIPTION);

		assert.strictEqual(rangesNodes.length, 0);
	});
	test('Multiple Ranges with different description', () => {
		const ninjaALRanges: NinjaALRange[] = [];
		ninjaALRanges.push(
			{
				from: 1,
				to: 2,
				description: "Sales"
			},
			{
				from: 10,
				to: 20,
				description: "Purchase"
			}
		);
		const { consumptionNodes, rangesNodes } = callGetNodesOfRanges(ninjaALRanges);
		assert.strictEqual(consumptionNodes.length, 2);
		verifySingleEntry(consumptionNodes[0], true, 1, 2, "Sales");
		verifySingleEntry(consumptionNodes[1], true, 10, 20, "Purchase");

		assert.strictEqual(rangesNodes.length, 0);
	});
	test('One Range each with and without description', () => {
		const ninjaALRanges: NinjaALRange[] = [];
		ninjaALRanges.push(
			{
				from: 1,
				to: 2,
				description: "Sales"
			},
			{
				from: 10,
				to: 20,
				description: ""
			}
		);
		const { consumptionNodes, rangesNodes } = callGetNodesOfRanges(ninjaALRanges);
		assert.strictEqual(consumptionNodes.length, 2);
		verifySingleEntry(consumptionNodes[0], true, 1, 2, "Sales");
		verifySingleEntry(consumptionNodes[1], true, 10, 20, DEFAULT_RANGE_DESCRIPTION);

		assert.strictEqual(rangesNodes.length, 0);
	});
	test('Two Ranges each with and without description', () => {
		const ninjaALRanges: NinjaALRange[] = [];
		ninjaALRanges.push(
			{
				from: 1,
				to: 2,
				description: "Sales"
			},
			{
				from: 10,
				to: 20,
				description: ""
			},
			{
				from: 21,
				to: 30,
				description: "Sales"
			},
			{
				from: 31,
				to: 40,
				description: ""
			}
		);
		const { consumptionNodes, rangesNodes } = callGetNodesOfRanges(ninjaALRanges);
		assert.strictEqual(consumptionNodes.length, 0);

		assert.strictEqual(rangesNodes.length, 2);
		verifyMultiEntry(rangesNodes[0], "Sales", [{ "from": 1, "to": 2 }, { "from": 21, "to": 30 }]);
		verifyMultiEntry(rangesNodes[1], DEFAULT_RANGE_DESCRIPTION, [{ "from": 10, "to": 20 }, { "from": 31, "to": 40 }]);
	});
});

function callGetNodesOfRanges(ninjaALRanges: NinjaALRange[]) {
	const consumptionNodes: ConsumptionNodeProperty[] = [];
	const rangesNodes: RangesNodeProperty[] = [];
	getChildrenOfLogicalObjectTypeNode(ninjaALRanges,
		(range: NinjaALRange, includeNames: boolean) => consumptionNodes.push({ range, includeNames }),
		(name: string, ranges: NinjaALRange[]) => rangesNodes.push({ name, ranges }));
	return { consumptionNodes, rangesNodes };
}

function verifySingleEntry(consumptionNode: ConsumptionNodeProperty, includeName: boolean, from: number, to: number, description?: string) {
	assert.strictEqual(consumptionNode.includeNames, includeName);
	assert.strictEqual(consumptionNode.range.from, from);
	assert.strictEqual(consumptionNode.range.to, to);
	if (includeName) {
		assert.notStrictEqual(consumptionNode.range.description, undefined);
		assert.strictEqual(getDescriptionOfRange(consumptionNode.range), description);
	}
}
function verifyMultiEntry(rangesNode: RangesNodeProperty, expectedName: string, expectedRanges: { from: number, to: number }[]) {
	assert.strictEqual(rangesNode.name, expectedName);
	assert.strictEqual(rangesNode.ranges.length, expectedRanges.length);
	for (let i = 0; i < expectedRanges.length; i++) {
		assert.strictEqual(rangesNode.ranges[i].from, expectedRanges[i].from);
		assert.strictEqual(rangesNode.ranges[i].to, expectedRanges[i].to);
	}
}
interface ConsumptionNodeProperty { range: NinjaALRange; includeNames: boolean; }
interface RangesNodeProperty { name: string; ranges: NinjaALRange[]; }