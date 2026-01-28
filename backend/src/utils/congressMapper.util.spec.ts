import type { Member } from "../schemas/congress/members.schema";
import {
	findChamberPartyCount,
	findMajorityAndMargin,
	mapToCongress,
} from "./congressMapper.util";

const mockMember = (
	partyName: string,
	chamber: "Senate" | "House of Representatives",
) =>
	({
		partyName,
		terms: {
			item: [
				{
					chamber,
				},
			],
		},
	}) as unknown as Member;

describe("findChamberPartyCount", () => {
	it("should return an empty map when no members are provided", () => {
		expect(findChamberPartyCount([], "Senate")).toEqual(new Map());
	});

	it("should count parties correctly", () => {
		const members = [
			mockMember("Democratic", "Senate"),
			mockMember("Democratic", "Senate"),
			mockMember("Republican", "Senate"),
			mockMember("Democratic", "House of Representatives"),
		];
		const result = findChamberPartyCount(members, "Senate");
		expect(result).toEqual(
			new Map([
				["Democratic", 2],
				["Republican", 1],
			]),
		);
	});
});

describe("findMajorityAndMargin", () => {
	it("should throw an error when the map is empty", () => {
		expect(() => findMajorityAndMargin(new Map())).toThrow(
			"No parties found in the given chamber",
		);
	});

	it("should return the majority party and margin correctly", () => {
		const partyCount = new Map([
			["Democratic", 10],
			["Republican", 8],
			["Independent", 2],
		]);
		const result = findMajorityAndMargin(partyCount);
		expect(result).toEqual(["Democratic", 2]);
	});
	it("should handle ties correctly", () => {
		const partyCount = new Map([
			["Democratic", 10],
			["Republican", 10],
			["Independent", 2],
		]);
		const result = findMajorityAndMargin(partyCount);
		expect(result).toEqual([null, 0]);
	});
});

describe("mapToCongress", () => {
	it("should map members to Congress correctly when a majority party exists", () => {
		const members = [
			mockMember("Democratic", "Senate"),
			mockMember("Democratic", "Senate"),
			mockMember("Republican", "Senate"),
			mockMember("Democratic", "House of Representatives"),
			mockMember("Republican", "House of Representatives"),
			mockMember("Republican", "House of Representatives"),
		];
		const introducedDate = new Date("2023-01-03");
		const result = mapToCongress(members, introducedDate);
		expect(result).toEqual({
			number: 118,
			partySenate: "Democratic",
			partyMarginSenate: 1,
			partyHouse: "Republican",
			partyMarginHouse: 1,
			unifiedGovernment: false,
		});
	});
	it("should map members to Congress correctly when no majority party exists", () => {
		const members = [
			mockMember("Democratic", "Senate"),
			mockMember("Republican", "Senate"),
			mockMember("Democratic", "House of Representatives"),
			mockMember("Republican", "House of Representatives"),
		];
		const introducedDate = new Date("2023-01-03");
		const result = mapToCongress(members, introducedDate);
		expect(result).toEqual({
			number: 118,
			partySenate: null,
			partyMarginSenate: 0,
			partyHouse: null,
			partyMarginHouse: 0,
			unifiedGovernment: true,
		});
	});
});
