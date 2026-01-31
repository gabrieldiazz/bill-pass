import type { BillAction } from "../schemas/bill/actions.schema.js";
import type { BillCommittee } from "../schemas/bill/committees.schema.js";
import type { BillCosponsor } from "../schemas/bill/cosponsors.schema.js";
import type { DetailedBill } from "../schemas/bill/detailed.schema.js";
import type { BillSubjects } from "../schemas/bill/subjects.schema.js";
import type { SummarizedBill } from "../schemas/bill/summaries.schema.js";
import type { Member } from "../schemas/congress/members.schema.js";
import type { Bill } from "../types/bill.type.js";

import {
	mapSponsor,
	mapToActions,
	mapToBill,
	mapToCommittees,
	mapToSponsorsAndCosponsors,
} from "./billMapper.util.js";

jest.mock("./status.util", () => ({
	deriveBillStatus: jest.fn(() => "INTRODUCED"),
}));
jest.mock("./congressMapper.util", () => ({
	mapToCongress: jest.fn(() => ({
		number: 118,
		partySenate: "D",
		partyMarginSenate: 10,
		partyHouse: "D",
		partyMarginHouse: 20,
		unifiedCongress: true,
	})),
}));
jest.mock("./billAnalytics.util", () => ({
	calculateDaysSinceSessionStart: jest.fn(() => 5),
	calculateTotalOriginalCosponsors: jest.fn(() => 2),
	calculateBipartisanCosponsorsCount: jest.fn(() => 1),
	isSponsorInMajorityParty: jest.fn(() => true),
}));

// mock data
const mockAction = (code: string): BillAction => ({
	actionCode: code,
	actionDate: "2026-01-01",
	actionTime: "00:00:00",
	text: "Mock action",
	type: "MockType",
	sourceSystem: { name: "MockSource", code: 1 },
});

const mockCosponsor: BillCosponsor = {
	bioguideId: "A000123",
	firstName: "Jane",
	fullName: "Jane Smith",
	lastName: "Smith",
	party: "R",
	state: "CA",
	isOriginalCosponsor: true,
	sponsorshipDate: "2026-01-01",
	url: "http://example.com",
	district: 12,
};

const mockDetails: DetailedBill = {
	number: "HR123",
	type: "bill",
	congress: 118,
	originChamber: "House",
	originChamberCode: "H",
	policyArea: { name: "Healthcare" },
	title: "Mock Bill",
	introducedDate: "2026-01-01",
	updateDate: "2026-01-02",
	updateDateIncludingText: "2026-01-02",
	legislationUrl: "http://example.com/legislation/HR123",
	sponsors: [
		{
			bioguideId: "B000001",
			fullName: "John Doe",
			firstName: "John",
			lastName: "Doe",
			middleName: "A",
			party: "D",
			state: "NY",
			url: "http://example.com/member/B000001",
			isByRequest: "N",
			district: 5,
		},
	],
	actions: { count: 0, url: "http://example.com/actions" },
	cboCostEstimates: [],
	committees: { count: 0, url: "http://example.com/committees" },
	cosponsors: {
		count: 0,
		countIncludingWithdrawnCosponsors: 0,
		url: "http://example.com/cosponsors",
	},
	latestAction: { actionDate: "2026-01-01", text: "Introduced" },
	relatedBills: { count: 0, url: "http://example.com/related" },
	subjects: { count: 0, url: "http://example.com/subjects" },
	summaries: { count: 0, url: "http://example.com/summaries" },
};

const mockSubjects: BillSubjects = {
	legislativeSubjects: [{ name: "Healthcare", updateDate: "2026-01-01" }],
	policyArea: { name: "Healthcare", updateDate: "2026-01-01" },
};

const mockSummaries: SummarizedBill[] = [
	{
		text: "Latest summary",
		updateDate: "2026-01-01",
		actionDate: "2026-01-01",
		actionDesc: "desc",
		versionCode: "v1",
	},
];

const mockCommittees: BillCommittee[] = [
	{
		name: "Health Committee",
		chamber: "House",
		activities: [{ date: "2026-01-01", name: "Activity1" }],
		systemCode: "sys1",
		type: "type1",
		url: "http://example.com",
	},
];

const mockMembers: Member[] = [
	{
		partyName: "Democratic",
		terms: { item: [{ startYear: 2020, chamber: "House of Representatives" }] },
	},
];

describe("billMapper.util", () => {
	it("mapToActions should map BillAction correctly", () => {
		const actions = [mockAction("1000")];
		const result = mapToActions(actions);
		expect(result[0]?.text).toBe("Mock action");
		expect(result[0]?.type).toBe("MockType");
		expect(result[0]?.actionDate).toEqual(new Date("2026-01-01"));
	});

	it("mapSponsor should map a sponsor correctly", () => {
		const sponsor = mockDetails.sponsors[0];
		if (!sponsor) throw new Error("Sponsor missing"); // just for type safety
		const result = mapSponsor(sponsor, "SPONSOR");
		expect(result.fullName).toBe("John Doe");
		expect(result.role).toBe("SPONSOR");
	});

	it("mapToSponsorsAndCosponsors should combine sponsors and cosponsors", () => {
		const result = mapToSponsorsAndCosponsors(mockDetails, [mockCosponsor]);
		expect(result).toHaveLength(2);
		expect(result[0]?.role).toBe("SPONSOR");
		expect(result[1]?.role).toBe("COSPONSOR");
	});

	it("mapToCommittees should map committees correctly", () => {
		const result = mapToCommittees(mockCommittees);
		expect(result[0]?.name).toBe("Health Committee");
		expect(result[0]?.chamber).toBe("House");
	});

	it("mapToBill should return a fully mapped Bill object", () => {
		const result: Bill = mapToBill(
			mockDetails,
			[mockAction("1000")],
			mockSubjects,
			[mockCosponsor],
			mockSummaries,
			mockCommittees,
			mockMembers,
		);
		expect(result.title).toBe("Mock Bill");
		expect(result.congressMakeup.number).toBe(118);
		expect(result.actions).toHaveLength(1);
		expect(result.billSponsors).toHaveLength(2);
		expect(result.committees).toHaveLength(1);
		expect(result.summary).toBe("Latest summary");
	});
});
