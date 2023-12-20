import * as assert from 'assert';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
import { NinjaALRange } from '../../lib/types/NinjaALRange';
import { consumptionNodeProperty, getNodesOfRanges, rangesNodeProperty } from '../../lib/functions/getNodesOfRanges';
// import * as myExtension from '../../extension';

suite('RangeExplorer TestSuite', () => {
	vscode.window.showInformationMessage('Start all tests.');

	test('Single Range with description', () => {
		const ninjaALRanges: NinjaALRange[] = [];
		ninjaALRanges.push({
			from: 1,
			to: 2,
			description: "Sales"
		})
		let { consumptionNodes, rangesNodes } = getNodesOfRanges(ninjaALRanges)
		assert.strictEqual(consumptionNodes.length, 1)
		verifySingleEntry(consumptionNodes[0], true, 1, 2, "Sales");

		assert.strictEqual(rangesNodes.length, 0)
	});
	test('Single Range without description', () => {
		const ninjaALRanges: NinjaALRange[] = [];
		ninjaALRanges.push({
			from: 1,
			to: 2,
			description: ""
		})
		let { consumptionNodes, rangesNodes } = getNodesOfRanges(ninjaALRanges)
		assert.strictEqual(consumptionNodes.length, 1)
		verifySingleEntry(consumptionNodes[0], false, 1, 2);

		assert.strictEqual(rangesNodes.length, 0)
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
		)
		let { consumptionNodes, rangesNodes } = getNodesOfRanges(ninjaALRanges)
		assert.strictEqual(consumptionNodes.length, 0)

		assert.strictEqual(rangesNodes.length, 1)
		verifyMultiEntry(rangesNodes[0], "Sales", [{ "from": 1, "to": 2 }, { "from": 10, "to": 20 }])
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
		)
		let { consumptionNodes, rangesNodes } = getNodesOfRanges(ninjaALRanges)
		assert.strictEqual(consumptionNodes.length, 2)
		verifySingleEntry(consumptionNodes[0], false, 1, 2)
		verifySingleEntry(consumptionNodes[1], false, 10, 20)

		assert.strictEqual(rangesNodes.length, 0)
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
		)
		let { consumptionNodes, rangesNodes } = getNodesOfRanges(ninjaALRanges)
		assert.strictEqual(consumptionNodes.length, 2)
		verifySingleEntry(consumptionNodes[0], true, 1, 2, "Sales")
		verifySingleEntry(consumptionNodes[1], true, 10, 20, "Purchase")

		assert.strictEqual(rangesNodes.length, 0)
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
		)
		let { consumptionNodes, rangesNodes } = getNodesOfRanges(ninjaALRanges)
		assert.strictEqual(consumptionNodes.length, 2)
		verifySingleEntry(consumptionNodes[0], true, 1, 2, "Sales")
		verifySingleEntry(consumptionNodes[1], false, 10, 20)

		assert.strictEqual(rangesNodes.length, 0)
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
		)
		let { consumptionNodes, rangesNodes } = getNodesOfRanges(ninjaALRanges)
		assert.strictEqual(consumptionNodes.length, 2)
		verifySingleEntry(consumptionNodes[0], false, 10, 20)
		verifySingleEntry(consumptionNodes[1], false, 31, 40)

		assert.strictEqual(rangesNodes.length, 1)
		verifyMultiEntry(rangesNodes[0], "Sales", [{ "from": 1, "to": 2 }, { "from": 21, "to": 30 }])
	});
});

function verifySingleEntry(consumptionNode: consumptionNodeProperty, includeName: boolean, from: number, to: number, description?: string) {
	assert.strictEqual(consumptionNode.includeNames, includeName)
	assert.strictEqual(consumptionNode.range.from, from)
	assert.strictEqual(consumptionNode.range.to, to)
	if (includeName) {
		assert.notStrictEqual(consumptionNode.range.description, undefined)
		assert.strictEqual(consumptionNode.range.description, description)
	}
}
function verifyMultiEntry(rangesNode: rangesNodeProperty, expectedName: string, expectedRanges: { from: number, to: number }[]) {
	assert.strictEqual(rangesNode.name, expectedName)
	assert.strictEqual(rangesNode.ranges.length, expectedRanges.length)
	for (let i = 0; i < expectedRanges.length; i++) {
		assert.strictEqual(rangesNode.ranges[i].from, expectedRanges[i].from)
		assert.strictEqual(rangesNode.ranges[i].to, expectedRanges[i].to)
	}
}