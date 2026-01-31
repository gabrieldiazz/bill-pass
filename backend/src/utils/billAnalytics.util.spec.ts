import type { BillCosponsor } from "../schemas/bill/cosponsors.schema.js";
import type { DetailedBill } from "../schemas/bill/detailed.schema.js";
import {
	calculateBipartisanCosponsorsCount,
	calculateDaysSinceSessionStart,
	calculateTotalOriginalCosponsors,
	isSponsorInMajorityParty,
} from "./billAnalytics.util.js";
import {
	findChamberPartyCount,
	findMajorityAndMargin,
} from "./congressMapper.util.js";

// mock helper functions for isSponsorInMajorityParty function
jest.mock("./congressMapper.util", () => ({
	findChamberPartyCount: jest.fn(),
	findMajorityAndMargin: jest.fn(),
}));

const mockedFindChamberPartyCount = findChamberPartyCount as jest.Mock;
const mockedFindMajorityAndMargin = findMajorityAndMargin as jest.Mock;

const mockBill = (
	congress?: number,
	introducedDate?: Date,
	originChamber?: "House" | "Senate",
	party?: "D" | "R" | "I",
): DetailedBill =>
	({
		congress,
		introducedDate,
		originChamber,
		sponsors: [
			{
				party,
			},
		],
	}) as unknown as DetailedBill;

const mockCosponsor = (
	party: "D" | "R" | "I" = "D",
	isOriginalCosponsor: boolean = true,
): BillCosponsor =>
	({
		party,
		isOriginalCosponsor,
	}) as unknown as BillCosponsor;

describe("calculateDaysSinceSessionStart", () => {
	it("should return the correct number of days months after", () => {
		const bill = mockBill(119, new Date("2025-09-23"));
		const result = calculateDaysSinceSessionStart(bill);
		expect(result).toEqual(263);
	});
	it("should return no days on the session date", () => {
		const bill = mockBill(118, new Date("2023-01-03"));
		const result = calculateDaysSinceSessionStart(bill);
		expect(result).toEqual(0);
	});
});

describe("isSponsorInMajorityParty", () => {
	beforeEach(() => jest.clearAllMocks());
	it("should return true if the sponsor is in the majority project", () => {
		mockedFindChamberPartyCount.mockReturnValue({
			Democratic: 220,
			Republican: 215,
		});

		mockedFindMajorityAndMargin.mockReturnValue(["Democratic", 5]);

		const result = isSponsorInMajorityParty(
			mockBill(undefined, undefined, "House", "D"),
			[],
		);
		expect(result).toBeTruthy();
	});
	it("should return false if the sponsor is not in the majority project", () => {
		mockedFindChamberPartyCount.mockReturnValue({
			Democratic: 225,
			Republican: 210,
		});

		mockedFindMajorityAndMargin.mockReturnValue(["Democratic", 15]);

		const result = isSponsorInMajorityParty(
			mockBill(undefined, undefined, "House", "R"),
			[],
		);
		expect(result).toBeFalsy();
	});
});

describe("calculateBipartisanCosponsorsCount", () => {
	it("counts cosponsors from a different party than the sponsor", () => {
		const bill = mockBill(undefined, undefined, "House", "D"); // Sponsor is D
		const cosponsors = [
			mockCosponsor("R"), // bipartisan
			mockCosponsor("D"), // same party
			mockCosponsor("I"), // independent, counts as bipartisan
		];

		expect(calculateBipartisanCosponsorsCount(bill, cosponsors)).toBe(2); // R + I
	});

	it("returns zero when all cosponsors are from the sponsor's party", () => {
		const bill = mockBill(undefined, undefined, "House", "R"); // Sponsor is R
		const cosponsors = [mockCosponsor("R"), mockCosponsor("R")];

		expect(calculateBipartisanCosponsorsCount(bill, cosponsors)).toBe(0);
	});

	it("returns zero when there are no cosponsors", () => {
		const bill = mockBill(undefined, undefined, "Senate", "D");
		const cosponsors: BillCosponsor[] = [];

		expect(calculateBipartisanCosponsorsCount(bill, cosponsors)).toBe(0);
	});
});

describe("calculateTotalOriginalCosponsors", () => {
	it("should return the correct count of original cosponsors", () => {
		const cosponsors = [
			mockCosponsor("D", true),
			mockCosponsor("R", false),
			mockCosponsor("I", true),
		];

		const result = calculateTotalOriginalCosponsors(cosponsors);
		expect(result).toBe(2); // only two are original
	});

	it("should return zero when no cosponsors are original", () => {
		const cosponsors = [mockCosponsor("D", false), mockCosponsor("R", false)];

		const result = calculateTotalOriginalCosponsors(cosponsors);
		expect(result).toBe(0);
	});

	it("should return zero when there are no cosponsors", () => {
		const cosponsors: BillCosponsor[] = [];
		const result = calculateTotalOriginalCosponsors(cosponsors);
		expect(result).toBe(0);
	});
});
